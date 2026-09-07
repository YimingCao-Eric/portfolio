/* bayer-core.js — Bayer mosaic / Malvar–He–Cutler demosaic / PSNR, in plain JS.
   Reimplements the maths used in the EECE 541 project (which itself adapted
   colour-demosaicing's malvar2004 to PyTorch). Works on Float32Array planes.
   Exposed as window.BayerCore in the browser, module.exports in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BayerCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PATTERNS = ["rggb", "bggr", "grbg", "gbrg"];

  // Per-pattern channel index at (row parity, col parity): 0 = R, 1 = G, 2 = B.
  function patternGrid(p) {
    const m = { r: 0, g: 1, b: 2 };
    return [[m[p[0]], m[p[1]]], [m[p[2]], m[p[3]]]];
  }

  // Split interleaved RGB(A) bytes into three Float32 planes.
  function planesFromRGBA(data, w, h, stride) {
    stride = stride || 4;
    const n = w * h, R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += stride) { R[i] = data[j]; G[i] = data[j + 1]; B[i] = data[j + 2]; }
    return { R, G, B, w, h };
  }

  // RGB -> single-plane CFA by keeping one channel per pixel.
  function mosaic(img, p) {
    const g = patternGrid(p), { w, h } = img, out = new Float32Array(w * h);
    const ch = [img.R, img.G, img.B];
    for (let y = 0; y < h; y++) {
      const gy = g[y & 1];
      for (let x = 0; x < w; x++) out[y * w + x] = ch[gy[x & 1]][y * w + x];
    }
    return out;
  }

  // 5x5 convolution with reflect padding (PyTorch ReflectionPad2d semantics: edge not repeated).
  function conv5(src, w, h, k) {
    const out = new Float32Array(w * h);
    const rx = (x) => (x < 0 ? -x : x >= w ? 2 * w - 2 - x : x);
    const ry = (y) => (y < 0 ? -y : y >= h ? 2 * h - 2 - y : y);
    for (let y = 0; y < h; y++) {
      const rows = [ry(y - 2), ry(y - 1), y, ry(y + 1), ry(y + 2)];
      for (let x = 0; x < w; x++) {
        const cols = [rx(x - 2), rx(x - 1), x, rx(x + 1), rx(x + 2)];
        let s = 0;
        for (let i = 0; i < 5; i++) {
          const ro = rows[i] * w, kr = k[i];
          for (let j = 0; j < 5; j++) { const kv = kr[j]; if (kv !== 0) s += kv * src[ro + cols[j]]; }
        }
        out[y * w + x] = s;
      }
    }
    return out;
  }

  const K_GR_GB = [[0, 0, -1, 0, 0], [0, 0, 2, 0, 0], [-1, 2, 4, 2, -1], [0, 0, 2, 0, 0], [0, 0, -1, 0, 0]].map(r => r.map(v => v / 8));
  const K_Rg_RB_Bg_BR = [[0, 0, 0.5, 0, 0], [0, -1, 0, -1, 0], [-1, 4, 5, 4, -1], [0, -1, 0, -1, 0], [0, 0, 0.5, 0, 0]].map(r => r.map(v => v / 8));
  const K_Rg_BR_Bg_RB = K_Rg_RB_Bg_BR[0].map((_, j) => K_Rg_RB_Bg_BR.map(r => r[j])); // transpose
  const K_Rb_BB_Br_RR = [[0, 0, -1.5, 0, 0], [0, 2, 0, 2, 0], [-1.5, 0, 6, 0, -1.5], [0, 2, 0, 2, 0], [0, 0, -1.5, 0, 0]].map(r => r.map(v => v / 8));

  // Malvar, He & Cutler (2004) gradient-corrected linear demosaic. Returns planes (unclamped floats).
  function demosaicMalvar(cfa, w, h, p) {
    const g = patternGrid(p), n = w * h;
    const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
    const c_GRGB = conv5(cfa, w, h, K_GR_GB);
    const c_RBg_RBBR = conv5(cfa, w, h, K_Rg_RB_Bg_BR);
    const c_RBg_BRRB = conv5(cfa, w, h, K_Rg_BR_Bg_RB);
    const c_RBgr_BBRR = conv5(cfa, w, h, K_Rb_BB_Br_RR);
    // Which row parity / column parity carries red or blue samples.
    const rRow = [g[0].includes(0), g[1].includes(0)], rCol = [g[0][0] === 0 || g[1][0] === 0, g[0][1] === 0 || g[1][1] === 0];
    const bRow = [g[0].includes(2), g[1].includes(2)], bCol = [g[0][0] === 2 || g[1][0] === 2, g[0][1] === 2 || g[1][1] === 2];
    for (let y = 0; y < h; y++) {
      const yp = y & 1;
      for (let x = 0; x < w; x++) {
        const xp = x & 1, i = y * w + x, ch = g[yp][xp], v = cfa[i];
        // Green
        G[i] = ch === 1 ? v : c_GRGB[i];
        // Red
        if (ch === 0) R[i] = v;
        else if (rRow[yp] && bCol[xp]) R[i] = c_RBg_RBBR[i];      // green pixel in a red row: R along the row
        else if (bRow[yp] && rCol[xp]) R[i] = c_RBg_BRRB[i];      // green pixel in a blue row: R along the column
        else R[i] = c_RBgr_BBRR[i];                                 // blue pixel: R from diagonals
        // Blue
        if (ch === 2) B[i] = v;
        else if (bRow[yp] && rCol[xp]) B[i] = c_RBg_RBBR[i];
        else if (rRow[yp] && bCol[xp]) B[i] = c_RBg_BRRB[i];
        else B[i] = c_RBgr_BBRR[i];
      }
    }
    return { R, G, B, w, h };
  }

  function clampRound(img) {
    const f = (a) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) { let v = Math.round(a[i]); o[i] = v < 0 ? 0 : v > 255 ? 255 : v; } return o; };
    return { R: f(img.R), G: f(img.G), B: f(img.B), w: img.w, h: img.h };
  }

  // PSNR over all three channels (MAX = 255). Returns Infinity for identical images.
  function psnr(a, b) {
    let se = 0; const n = a.w * a.h;
    for (let i = 0; i < n; i++) { const dr = a.R[i] - b.R[i], dg = a.G[i] - b.G[i], db = a.B[i] - b.B[i]; se += dr * dr + dg * dg + db * db; }
    const mse = se / (3 * n);
    return mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse);
  }

  // Redemosaic under one pattern: mosaic -> Malvar -> clamp/round.
  function redemosaic(img, p) { return clampRound(demosaicMalvar(mosaic(img, p), img.w, img.h, p)); }

  // The project's test statistic: PSNR under all four patterns and their (population) std.
  function redemosaicStats(img) {
    const out = {};
    const vals = PATTERNS.map(p => { const r = redemosaic(img, p); const v = psnr(img, r); out[p] = { psnr: v, image: r }; return v; });
    const finite = vals.map(v => Math.min(v, 100));
    const mean = finite.reduce((a, b) => a + b, 0) / 4;
    const std = Math.sqrt(finite.reduce((a, b) => a + (b - mean) * (b - mean), 0) / 4);
    let best = PATTERNS[0]; for (const p of PATTERNS) if (out[p].psnr > out[best].psnr) best = p;
    return { perPattern: out, std, best };
  }

  // --- A small camera pipeline, for the "simulate a camera" control ---------------
  // scene -> optical low-pass (Gaussian σ 0.8) -> CFA samples + sensor noise (σ 2)
  //       -> Malvar demosaic -> chroma denoise (σ 1.0) + saturation -> luma sharpen -> noise (σ 0.5) -> 8-bit.
  // Tuned so a sharp 512-px image lands where RAISE-1k photographs land (spread ≈ 1–2 dB,
  // RGGB ≈ BGGR above GRBG ≈ GBRG); chroma processing is what keeps R/B from being reproduced exactly.
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gaussianNoise(n, sigma, seed) {
    const rnd = mulberry32(seed || 1), out = new Float32Array(n);
    for (let i = 0; i < n; i += 2) {
      const u = Math.max(rnd(), 1e-12), v = rnd(), m = Math.sqrt(-2 * Math.log(u));
      out[i] = sigma * m * Math.cos(2 * Math.PI * v); if (i + 1 < n) out[i + 1] = sigma * m * Math.sin(2 * Math.PI * v);
    }
    return out;
  }
  // Separable Gaussian blur, reflect boundary (scipy's default).
  function gaussBlur(a, w, h, sigma) {
    const r = Math.max(1, Math.ceil(3 * sigma)), k = new Float32Array(2 * r + 1); let ks = 0;
    for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-0.5 * i * i / (sigma * sigma)); ks += k[i + r]; }
    for (let i = 0; i < k.length; i++) k[i] /= ks;
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    const rx = (x) => (x < 0 ? -x - 1 : x >= w ? 2 * w - 1 - x : x), ry = (y) => (y < 0 ? -y - 1 : y >= h ? 2 * h - 1 - y : y);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) s += k[i + r] * a[y * w + rx(x + i)]; tmp[y * w + x] = s; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) s += k[i + r] * tmp[ry(y + i) * w + x]; out[y * w + x] = s; }
    return out;
  }
  function simulateCamera(img, p, opts) {
    opts = opts || {};
    const { w, h } = img, n = w * h;
    const olpf = opts.olpf == null ? 0.8 : opts.olpf, sigmaPre = opts.noise == null ? 2 : opts.noise, chroma = opts.chroma == null ? 1.0 : opts.chroma,
      sat = opts.sat == null ? 1.15 : opts.sat, sharpen = opts.sharpen == null ? 0.5 : opts.sharpen, sigmaPost = opts.noisePost == null ? 0.5 : opts.noisePost;
    // optical low-pass filter in front of the sensor
    const scene = olpf > 0 ? { R: gaussBlur(img.R, w, h, olpf), G: gaussBlur(img.G, w, h, olpf), B: gaussBlur(img.B, w, h, olpf), w, h } : img;
    const cfa = mosaic(scene, p), nz = gaussianNoise(n, sigmaPre, 7);
    for (let i = 0; i < n; i++) cfa[i] += nz[i];
    const d = demosaicMalvar(cfa, w, h, p);
    // in-camera colour processing works in a luma/chroma space
    let Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = d.R[i], g = d.G[i], b = d.B[i];
      Y[i] = 0.299 * r + 0.587 * g + 0.114 * b; Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b; Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
    if (chroma > 0) { Cb = gaussBlur(Cb, w, h, chroma); Cr = gaussBlur(Cr, w, h, chroma); }
    if (sharpen > 0) { const Yb = gaussBlur(Y, w, h, 1.0); for (let i = 0; i < n; i++) Y[i] = Y[i] + sharpen * (Y[i] - Yb[i]); }
    const out = { R: new Float32Array(n), G: new Float32Array(n), B: new Float32Array(n), w, h }, nz2 = sigmaPost > 0 ? gaussianNoise(3 * n, sigmaPost, 11) : null;
    for (let i = 0; i < n; i++) {
      const cb = Cb[i] * sat, cr = Cr[i] * sat, y = Y[i];
      out.R[i] = y + 1.402 * cr; out.G[i] = y - 0.344136 * cb - 0.714136 * cr; out.B[i] = y + 1.772 * cb;
      if (nz2) { out.R[i] += nz2[3 * i]; out.G[i] += nz2[3 * i + 1]; out.B[i] += nz2[3 * i + 2]; }
    }
    return clampRound(out);
  }

  return { PATTERNS, patternGrid, planesFromRGBA, mosaic, demosaicMalvar, clampRound, psnr, redemosaic, redemosaicStats, simulateCamera };
});
