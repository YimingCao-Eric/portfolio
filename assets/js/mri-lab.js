/* ============================================================
   Live DCT denoiser for a diffusion-weighted MRI slice.

   This is the DCT half of the 523 project, reimplemented in the
   browser. For each 8x8 patch:

       B      = DCT2(patch)                    (type-II, orthonormal)
       B[i,j] = 0   where  i >= d  or  j >= d+1
       patch' = IDCT2(B)

   Keeping only the top-left d by (d+1) coefficients is a low-pass
   filter in the frequency domain: noise lives in the high-frequency
   corner, image structure in the low-frequency corner. Turning d
   down removes more noise and more detail at the same time — which
   is the whole point of the figure.

   SSIM is computed between the original and the denoised result on
   8x8 windows, the standard formulation with k1 = 0.01, k2 = 0.03.
   ============================================================ */
(function () {
  "use strict";

  var P = 8;                     // patch size
  var COS = null;                // COS[k][n] = basis, built once

  function buildBasis() {
    COS = [];
    for (var k = 0; k < P; k++) {
      COS[k] = new Float64Array(P);
      var s = k === 0 ? Math.sqrt(1 / P) : Math.sqrt(2 / P);
      for (var n = 0; n < P; n++) {
        COS[k][n] = s * Math.cos((Math.PI * (2 * n + 1) * k) / (2 * P));
      }
    }
  }

  /* separable 2-D DCT-II / inverse, on a P*P Float64Array */
  var tmp = new Float64Array(P * P);

  function dct2(block, out) {
    var u, x, y, v, sum;
    for (y = 0; y < P; y++) {          // rows
      for (u = 0; u < P; u++) {
        sum = 0;
        for (x = 0; x < P; x++) sum += block[y * P + x] * COS[u][x];
        tmp[y * P + u] = sum;
      }
    }
    for (u = 0; u < P; u++) {          // columns
      for (v = 0; v < P; v++) {
        sum = 0;
        for (y = 0; y < P; y++) sum += tmp[y * P + u] * COS[v][y];
        out[v * P + u] = sum;
      }
    }
  }

  function idct2(coef, out) {
    var u, x, y, v, sum;
    for (v = 0; v < P; v++) {
      for (x = 0; x < P; x++) {
        sum = 0;
        for (u = 0; u < P; u++) sum += coef[v * P + u] * COS[u][x];
        tmp[v * P + x] = sum;
      }
    }
    for (x = 0; x < P; x++) {
      for (y = 0; y < P; y++) {
        sum = 0;
        for (v = 0; v < P; v++) sum += tmp[v * P + x] * COS[v][y];
        out[y * P + x] = sum;
      }
    }
  }

  /* denoise a whole plane (Float64Array, w*h) at parameter d */
  function denoise(src, w, h, d) {
    var out = new Float64Array(w * h),
      block = new Float64Array(P * P),
      coef = new Float64Array(P * P),
      res = new Float64Array(P * P),
      bx, by, x, y, i, j;

    for (by = 0; by + P <= h; by += P) {
      for (bx = 0; bx + P <= w; bx += P) {
        for (y = 0; y < P; y++)
          for (x = 0; x < P; x++)
            block[y * P + x] = src[(by + y) * w + bx + x];

        dct2(block, coef);

        // keep the top-left d by (d+1) coefficients, zero the rest
        for (i = 0; i < P; i++)
          for (j = 0; j < P; j++)
            if (i >= d || j >= d + 1) coef[i * P + j] = 0;

        idct2(coef, res);

        for (y = 0; y < P; y++)
          for (x = 0; x < P; x++)
            out[(by + y) * w + bx + x] = res[y * P + x];
      }
    }
    return out;
  }

  /* SSIM over 8x8 windows, stride 4 */
  function ssim(a, b, w, h) {
    var L = 255, c1 = Math.pow(0.01 * L, 2), c2 = Math.pow(0.03 * L, 2),
      W = 8, S = 4, total = 0, count = 0,
      x, y, i, j, va, vb, n = W * W;

    for (y = 0; y + W <= h; y += S) {
      for (x = 0; x + W <= w; x += S) {
        var sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
        for (i = 0; i < W; i++) {
          for (j = 0; j < W; j++) {
            va = a[(y + i) * w + x + j];
            vb = b[(y + i) * w + x + j];
            sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
          }
        }
        var ma = sa / n, mb = sb / n,
          vaa = saa / n - ma * ma,
          vbb = sbb / n - mb * mb,
          cov = sab / n - ma * mb;
        total += ((2 * ma * mb + c1) * (2 * cov + c2)) /
                 ((ma * ma + mb * mb + c1) * (vaa + vbb + c2));
        count++;
      }
    }
    return count ? total / count : 1;
  }

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ---------- the lab ---------- */

  function initLab(root) {
    var origC = root.querySelector("[data-mri-original]"),
      denC = root.querySelector("[data-mri-denoised]"),
      maskC = root.querySelector("[data-mri-mask]"),
      chartC = root.querySelector("[data-mri-chart]"),
      slider = root.querySelector("[data-mri-slider]"),
      outD = root.querySelector("[data-out-d]"),
      outKept = root.querySelector("[data-out-kept]"),
      outSsim = root.querySelector("[data-out-ssim]");

    if (!origC || !slider) return;
    buildBasis();

    var W = 0, H = 0, gray = null, ssimByD = [], ready = false;

    var img = new Image();
    img.onload = function () {
      W = img.naturalWidth; H = img.naturalHeight;

      var off = document.createElement("canvas");
      off.width = W; off.height = H;
      var octx = off.getContext("2d");
      octx.drawImage(img, 0, 0);

      var data;
      try {
        data = octx.getImageData(0, 0, W, H).data;
      } catch (e) {
        root.classList.add("is-unavailable");   // tainted canvas; bail gracefully
        return;
      }

      gray = new Float64Array(W * H);
      for (var i = 0, k = 0; i < data.length; i += 4, k++) {
        gray[k] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // precompute the SSIM curve once
      for (var d = 1; d <= 7; d++) {
        ssimByD[d] = ssim(gray, denoise(gray, W, H, d), W, H);
      }

      ready = true;
      resize();
    };
    img.onerror = function () { root.classList.add("is-unavailable"); };
    img.src = window.DWI_SLICE || root.dataset.mriSrc || "";

    function paint(canvas, plane) {
      var ctx = canvas.getContext("2d"),
        im = ctx.createImageData(W, H),
        d = im.data;
      for (var i = 0, k = 0; k < plane.length; k++, i += 4) {
        var v = Math.max(0, Math.min(255, plane[k]));
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      var off = document.createElement("canvas");
      off.width = W; off.height = H;
      off.getContext("2d").putImageData(im, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    }

    /* the 8x8 coefficient mask — which frequencies survive */
    function drawMask(d) {
      var ctx = maskC.getContext("2d"),
        S = maskC.width, cell = S / P,
        gap = Math.max(1, S / 120),
        keep = css("--accent", "#2f5d50"),
        drop = css("--border-strong", "#d2d2cc");
      ctx.clearRect(0, 0, S, S);
      for (var i = 0; i < P; i++) {
        for (var j = 0; j < P; j++) {
          var kept = i < d && j < d + 1;
          // every one of the 64 cells is drawn, so the ratio stays legible
          ctx.fillStyle = kept ? keep : drop;
          ctx.globalAlpha = kept ? 1 - (i + j) / 22 : 0.4;
          ctx.fillRect(j * cell + gap, i * cell + gap, cell - gap * 2, cell - gap * 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* SSIM against d, computed above from this very image */
    function drawChart(d) {
      var ctx = chartC.getContext("2d"),
        Wc = chartC.width, Hc = chartC.height,
        S = Wc / (chartC.clientWidth || Wc),
        padL = 30 * S, padR = 10 * S, padT = 10 * S, padB = 22 * S,
        iw = Wc - padL - padR, ih = Hc - padT - padB,
        accent = css("--accent", "#2f5d50"),
        faint = css("--text-faint", "#86867e"),
        border = css("--border", "#e4e4e0");

      ctx.clearRect(0, 0, Wc, Hc);
      ctx.font = (9 * S) + "px " + css("--font-mono", "monospace");
      ctx.fillStyle = faint; ctx.strokeStyle = border; ctx.lineWidth = 1 * S;

      [0, 0.5, 1].forEach(function (v) {
        var y = padT + ih * (1 - v);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(Wc - padR, y); ctx.stroke();
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(v.toFixed(1), padL - 5 * S, y);
      });
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var t = 1; t <= 7; t++) {
        ctx.fillText(String(t), padL + ((t - 1) / 6) * iw, Hc - padB + 5 * S);
      }

      ctx.beginPath();
      ctx.strokeStyle = accent; ctx.lineWidth = 2 * S;
      for (var i = 1; i <= 7; i++) {
        var x = padL + ((i - 1) / 6) * iw, y = padT + ih * (1 - ssimByD[i]);
        i === 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      var mx = padL + ((d - 1) / 6) * iw, my = padT + ih * (1 - ssimByD[d]);
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(mx, my, 3.5 * S, 0, 6.284); ctx.fill();
    }

    function render() {
      if (!ready) return;
      var d = +slider.value;
      paint(origC, gray);
      paint(denC, denoise(gray, W, H, d));
      drawMask(d);
      drawChart(d);
      if (outD) outD.textContent = d;
      if (outKept) outKept.textContent = d * (d + 1) + " / 64";
      if (outSsim) outSsim.textContent = ssimByD[d].toFixed(4);
    }

    // ratio < 0 is read as an absolute pixel height instead of an aspect ratio
    function fit(canvas, ratio) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2),
        w = canvas.clientWidth || 260,
        h = ratio < 0 ? -ratio : Math.round(w * ratio);
      canvas.style.height = h + "px";
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    function resize() {
      if (!ready) return;
      var ar = H / W;
      fit(origC, ar); fit(denC, ar);
      fit(maskC, 1); fit(chartC, -176);
      render();
    }

    slider.addEventListener("input", render);
    document.addEventListener("themechange", function () { if (ready) render(); });
    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function () { if (ready) render(); });

    if (window.ResizeObserver) new ResizeObserver(resize).observe(root);
    else window.addEventListener("resize", resize);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-mri-lab]").forEach(initLab);
  });
})();
