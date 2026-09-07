/* ============================================================
   k-means vs GMM-EM, side by side, on synthetic "tissue" data.

   Four populations in a 2-D feature space stand in for background,
   white+grey matter, CSF and tumour — very different sizes, shapes
   and orientations, which is what makes real voxel intensities hard
   for k-means. Both algorithms are run with the same K on the same
   points; the GMM is initialised from the k-means centroids, exactly
   as the project did. EM is animated one iteration per frame.

   Everything here is synthetic. No BraTS voxels are used.
   ============================================================ */
(function () {
  "use strict";

  var PAL = {
    light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
    dark:  ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"]
  };
  function isDark() { var t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function pal() { return isDark() ? PAL.dark : PAL.light; }
  function css(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* ---------- data ---------- */
  var TISSUES = [
    { name: "background", n: 240, c: [-1.05, -0.95], sx: 0.13, sy: 0.11, rot: 0.2 },
    { name: "WM & GM",    n: 300, c: [0.15, -0.15],  sx: 0.62, sy: 0.17, rot: 0.55 },
    { name: "CSF",        n: 90,  c: [-0.55, 0.78],  sx: 0.26, sy: 0.13, rot: -0.4 },
    { name: "tumour",     n: 40,  c: [1.05, 0.72],   sx: 0.30, sy: 0.09, rot: 0.9 }
  ];
  function makeData(seed, tumourN) {
    var r = mulberry32(seed), pts = [];
    TISSUES.forEach(function (t, ti) {
      var n = ti === 3 ? tumourN : t.n, cr = Math.cos(t.rot), sr = Math.sin(t.rot);
      for (var i = 0; i < n; i++) {
        var u = t.sx * gauss(r), v = t.sy * gauss(r);
        pts.push({ x: t.c[0] + u * cr - v * sr, y: t.c[1] + u * sr + v * cr, t: ti });
      }
    });
    return pts;
  }

  /* ---------- k-means (k-means++ init, Lloyd) ---------- */
  function kmeans(pts, K, seed) {
    var r = mulberry32(seed + 1), cent = [pts[Math.floor(r() * pts.length)]].map(function (p) { return [p.x, p.y]; });
    while (cent.length < K) {
      var d2 = pts.map(function (p) { return Math.min.apply(null, cent.map(function (c) { return (p.x - c[0]) * (p.x - c[0]) + (p.y - c[1]) * (p.y - c[1]); })); });
      var sum = d2.reduce(function (a, b) { return a + b; }, 0), acc = 0, pick = r() * sum, idx = 0;
      for (idx = 0; idx < pts.length; idx++) { acc += d2[idx]; if (acc >= pick) break; }
      cent.push([pts[Math.min(idx, pts.length - 1)].x, pts[Math.min(idx, pts.length - 1)].y]);
    }
    var lab = new Array(pts.length).fill(0);
    for (var it = 0; it < 60; it++) {
      var changed = 0;
      pts.forEach(function (p, i) {
        var best = 0, bd = Infinity;
        cent.forEach(function (c, k) { var d = (p.x - c[0]) * (p.x - c[0]) + (p.y - c[1]) * (p.y - c[1]); if (d < bd) { bd = d; best = k; } });
        if (lab[i] !== best) { lab[i] = best; changed++; }
      });
      var sx = new Array(K).fill(0), sy = new Array(K).fill(0), n = new Array(K).fill(0);
      pts.forEach(function (p, i) { sx[lab[i]] += p.x; sy[lab[i]] += p.y; n[lab[i]]++; });
      for (var k = 0; k < K; k++) if (n[k]) cent[k] = [sx[k] / n[k], sy[k] / n[k]];
      if (!changed) break;
    }
    return { labels: lab, centroids: cent };
  }

  /* ---------- GMM with full 2x2 covariance, EM ---------- */
  function gmmInit(pts, K, centroids) {
    return { K: K, pi: new Array(K).fill(1 / K), mu: centroids.map(function (c) { return c.slice(); }),
      cov: centroids.map(function () { return [0.08, 0, 0, 0.08]; }), ll: -Infinity, iter: 0, done: false, resp: null };
  }
  function logpdf(p, mu, S) {
    var det = S[0] * S[3] - S[1] * S[2]; if (det < 1e-9) det = 1e-9;
    var a = S[3] / det, b = -S[1] / det, d = S[0] / det, dx = p.x - mu[0], dy = p.y - mu[1];
    var q = a * dx * dx + 2 * b * dx * dy + d * dy * dy;
    return -Math.log(2 * Math.PI) - 0.5 * Math.log(det) - 0.5 * q;
  }
  function emStep(g, pts) {
    var K = g.K, N = pts.length, resp = new Array(N), ll = 0;
    for (var i = 0; i < N; i++) {                                   // E-step (log-sum-exp)
      var lp = new Array(K), m = -Infinity;
      for (var k = 0; k < K; k++) { lp[k] = Math.log(g.pi[k] + 1e-12) + logpdf(pts[i], g.mu[k], g.cov[k]); if (lp[k] > m) m = lp[k]; }
      var s = 0; for (k = 0; k < K; k++) s += Math.exp(lp[k] - m);
      var lse = m + Math.log(s); ll += lse;
      resp[i] = lp.map(function (v) { return Math.exp(v - lse); });
    }
    for (k = 0; k < K; k++) {                                       // M-step
      var Nk = 0, mx = 0, my = 0;
      for (i = 0; i < N; i++) { Nk += resp[i][k]; mx += resp[i][k] * pts[i].x; my += resp[i][k] * pts[i].y; }
      Nk = Math.max(Nk, 1e-6); mx /= Nk; my /= Nk;
      var sxx = 0, sxy = 0, syy = 0;
      for (i = 0; i < N; i++) { var dx = pts[i].x - mx, dy = pts[i].y - my, w = resp[i][k]; sxx += w * dx * dx; sxy += w * dx * dy; syy += w * dy * dy; }
      g.pi[k] = Nk / N; g.mu[k] = [mx, my];
      g.cov[k] = [sxx / Nk + 1e-4, sxy / Nk, sxy / Nk, syy / Nk + 1e-4];
    }
    var prev = g.ll; g.ll = ll / N; g.iter++; g.resp = resp;
    if (g.iter >= 80 || Math.abs(g.ll - prev) < 1e-5) g.done = true;
    return g;
  }
  function gmmLabels(g) { return g.resp ? g.resp.map(function (r) { var b = 0; for (var k = 1; k < r.length; k++) if (r[k] > r[b]) b = k; return b; }) : null; }

  /* ---------- Dice of the best-matching cluster against the true tumour ---------- */
  function bestDice(labels, pts, K) {
    var best = { dice: 0, k: -1 };
    for (var k = 0; k < K; k++) {
      var inter = 0, pred = 0, truth = 0;
      pts.forEach(function (p, i) { var isP = labels[i] === k, isT = p.t === 3; if (isP) pred++; if (isT) truth++; if (isP && isT) inter++; });
      var d = pred + truth ? 2 * inter / (pred + truth) : 0;
      if (d > best.dice) best = { dice: d, k: k };
    }
    return best;
  }

  /* ============================================================ */
  function initLab(root) {
    var kmC = root.querySelector("[data-gmm-kmeans]"), emC = root.querySelector("[data-gmm-em]"),
      kSel = root.querySelector("[data-gmm-k]"), tumour = root.querySelector("[data-gmm-tumour]"),
      resample = root.querySelector("[data-gmm-resample]"), play = root.querySelector("[data-gmm-play]"),
      outKm = root.querySelector("[data-out-km]"), outEm = root.querySelector("[data-out-em]"),
      outIter = root.querySelector("[data-out-iter]"), outLL = root.querySelector("[data-out-ll]"),
      outN = root.querySelector("[data-out-tumour-n]");
    if (!kmC || !emC) return;

    var seed = 3, K = 4, tN = 40, pts, km, g, S = 1, timer = null;

    function setup() {
      pts = makeData(seed, tN);
      km = kmeans(pts, K, seed);
      g = gmmInit(pts, K, km.centroids);
      emStep(g, pts);                                             // one step so the panel isn't empty
    }
    function toPx(c, p) { var W = c.width, H = c.height, s = Math.min(W, H) / 3.6; return [W / 2 + p[0] * s, H / 2 - p[1] * s]; }

    function drawPanel(canvas, labels, title, dice, extra) {
      var ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height, P = pal(),
        surface = css("--bg-sunken", "#f4f4f2"), ring = css("--bg-elev", "#fff"), ink = css("--text", "#1a1a18"), faint = css("--text-faint", "#86867e");
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = surface; ctx.fillRect(0, 0, W, H);
      var r = 2.6 * S;
      pts.forEach(function (p, i) {
        var q = toPx(canvas, [p.x, p.y]);
        ctx.fillStyle = P[labels ? labels[i] % P.length : 0]; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
        if (p.t === 3) { ctx.strokeStyle = ink; ctx.lineWidth = 1.1 * S; ctx.beginPath(); ctx.arc(q[0], q[1], r + 2 * S, 0, 6.283); ctx.stroke(); }
      });
      if (extra) extra(ctx, P);
      ctx.font = "600 " + 12 * S + "px " + css("--font-sans", "sans-serif"); ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillStyle = ink;
      ctx.fillText(title, 9 * S, 8 * S);
      ctx.font = 11.5 * S + "px " + css("--font-mono", "monospace"); ctx.textAlign = "right"; ctx.fillStyle = faint;
      ctx.fillText("tumour Dice " + dice.toFixed(2), W - 9 * S, 8 * S);
    }

    function drawKm() {
      var d = bestDice(km.labels, pts, K);
      drawPanel(kmC, km.labels, "k-means", d.dice, function (ctx, P) {
        km.centroids.forEach(function (c, k) {
          var q = toPx(kmC, c); ctx.fillStyle = css("--bg-elev", "#fff"); ctx.strokeStyle = P[k % P.length]; ctx.lineWidth = 3 * S;
          ctx.beginPath(); ctx.arc(q[0], q[1], 7 * S, 0, 6.283); ctx.fill(); ctx.stroke();
          ctx.fillStyle = P[k % P.length]; ctx.beginPath(); ctx.arc(q[0], q[1], 2.5 * S, 0, 6.283); ctx.fill();
        });
      });
      if (outKm) outKm.textContent = d.dice.toFixed(3);
    }
    function drawEm() {
      var lab = gmmLabels(g), d = lab ? bestDice(lab, pts, K) : { dice: 0 };
      drawPanel(emC, lab, "GMM-EM", d.dice, function (ctx, P) {
        g.mu.forEach(function (mu, k) {                            // 1-sigma and 2-sigma ellipses
          var S2 = g.cov[k], tr = S2[0] + S2[3], det = S2[0] * S2[3] - S2[1] * S2[2],
            l1 = tr / 2 + Math.sqrt(Math.max(tr * tr / 4 - det, 0)), l2 = tr / 2 - Math.sqrt(Math.max(tr * tr / 4 - det, 0)),
            ang = Math.atan2(l1 - S2[0], S2[1] || 1e-9), q = toPx(emC, mu), s = Math.min(emC.width, emC.height) / 3.6;
          [1, 2].forEach(function (m) {
            ctx.beginPath(); ctx.ellipse(q[0], q[1], Math.sqrt(Math.max(l1, 1e-6)) * s * m, Math.sqrt(Math.max(l2, 1e-6)) * s * m, -ang, 0, 6.283);
            ctx.strokeStyle = P[k % P.length]; ctx.lineWidth = (m === 1 ? 2 : 1) * S; ctx.setLineDash(m === 1 ? [] : [3 * S, 3 * S]); ctx.stroke(); ctx.setLineDash([]);
          });
          ctx.fillStyle = P[k % P.length]; ctx.beginPath(); ctx.arc(q[0], q[1], 3 * S, 0, 6.283); ctx.fill();
        });
      });
      if (outEm) outEm.textContent = d.dice.toFixed(3);
      if (outIter) outIter.textContent = g.iter + (g.done ? " (converged)" : "");
      if (outLL) outLL.textContent = isFinite(g.ll) ? g.ll.toFixed(4) : "—";
    }
    function render() { drawKm(); drawEm(); if (outN) outN.textContent = tN; }

    function stopAnim() { if (timer) { cancelAnimationFrame(timer); timer = null; } if (play) play.dataset.state = "paused"; }
    function animate() {
      if (g.done) { stopAnim(); return; }
      emStep(g, pts); drawEm();
      timer = requestAnimationFrame(function () { setTimeout(animate, 90); });
    }
    function restart() { stopAnim(); setup(); while (!g.done) emStep(g, pts); render(); }

    if (kSel) kSel.addEventListener("change", function () { K = +kSel.value; restart(); });
    if (tumour) tumour.addEventListener("input", function () { tN = +tumour.value; restart(); });
    if (resample) resample.addEventListener("click", function () { seed = (seed * 7919 + 29) % 100003; restart(); });
    if (play) play.addEventListener("click", function () {
      if (timer) { stopAnim(); return; }
      if (g.done) { g = gmmInit(pts, K, km.centroids); }
      play.dataset.state = "playing"; animate();
    });

    function fit(c) { var dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth || 320, h = Math.round(w * 0.8); c.style.height = h + "px"; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); S = dpr; }
    function resize() { fit(kmC); fit(emC); render(); }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(root); else window.addEventListener("resize", resize);
    document.addEventListener("themechange", render);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

    setup(); while (!g.done) emStep(g, pts);   // the default view is the converged fit
    resize();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-gmm-lab]").forEach(initLab);
  });
})();
