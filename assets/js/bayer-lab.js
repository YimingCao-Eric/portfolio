/* ============================================================
   Two figures for the Bayer-pattern fake-image case study.

   1. Redemosaic lab — the project's test, run in the browser on a
      sample image or on one of your own. Mosaic under each of the four
      Bayer patterns, demosaic with Malvar–He–Cutler, compare with PSNR,
      take the spread. Maths in bayer-core.js (verified pixel-exact
      against the project's Python/PyTorch implementation).

   2. Distributions — the PSNR-spread histograms from the project's
      result files, on a log axis, with the percentile thresholds from
      Table I of the paper applied live. Data in bayer-data.js.
   ============================================================ */
(function () {
  "use strict";

  function t(en, zh) { return (window.I18N && window.I18N.t) ? window.I18N.t(en, zh) : en; }
  /* Chinese labels for the data sets in bayer-data.js (keyed by set id); English labels come from the data file */
  var SET_ZH = { raise: "RAISE-1k（真实）", ddb: "DiffusionDB", gen: "GenImage", land: "Landscape PhotoReal", jpeg75: "RAISE，JPEG q75", jpeg25: "RAISE，JPEG q25", half: "RAISE，缩放 ×0.5" };
  function setLabel(k, m) { return t(m.label, SET_ZH[k] || m.label); }

  var PAL = { light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"], dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"] };
  function isDark() { var t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function pal() { return isDark() ? PAL.dark : PAL.light; }
  function css(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function onTheme(fn) { document.addEventListener("themechange", fn); window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", fn); }

  var BC = window.BayerCore, DATA = window.BAYER_DATA;
  var PATTERNS = ["rggb", "bggr", "grbg", "gbrg"];
  var PSNR_CAP = 60;                       // dB; identical images would be +∞
  var THR5 = DATA ? DATA.table[5] : { lo: 0.4344, hi: 2.2406 };  // (5, 95) percentiles of RAISE-1k

  /* ============================================================
     1. Redemosaic lab
     ============================================================ */
  function initLab(root) {
    var imgCanvas = root.querySelector("[data-bl-image]"), diffCanvas = root.querySelector("[data-bl-diff]"), zoomCanvas = root.querySelector("[data-bl-zoom]"),
      stripCanvas = root.querySelector("[data-bl-strip]"), bars = root.querySelector("[data-bl-bars]"), fileIn = root.querySelector("[data-bl-file]"),
      provInputs = root.querySelectorAll("[name=bl-prov]"), truePat = root.querySelector("[data-bl-true]"), status = root.querySelector("[data-bl-status]"),
      outStd = root.querySelector("[data-bl-std]"), outBest = root.querySelector("[data-bl-best]"), outVerdict = root.querySelector("[data-bl-verdict]"),
      outSize = root.querySelector("[data-bl-size]"), srcLabel = root.querySelector("[data-bl-source]"), resetBtn = root.querySelector("[data-bl-reset]");
    if (!imgCanvas || !BC) return;

    var base = null, test = null, stats = null, selected = "rggb", busy = false, pending = false, sourceName = "sample";

    function setStatus(t) { if (status) status.textContent = t; }

    // ---- image loading -------------------------------------------------
    function planesFromImage(img, maxW, maxH, cropOnly) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, c = document.createElement("canvas");
      // Never scale a photo: scaling destroys the evidence we're testing for. Crop the centre instead.
      var cw = Math.min(w, maxW), ch = Math.min(h, maxH); cw -= cw % 2; ch -= ch % 2;
      var sx = Math.floor((w - cw) / 2), sy = Math.floor((h - ch) / 2); sx -= sx % 2; sy -= sy % 2;
      c.width = cw; c.height = ch; var ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
      return BC.planesFromRGBA(ctx.getImageData(0, 0, cw, ch).data, cw, ch, 4);
    }
    function loadSample() {
      var im = new Image();
      im.onload = function () { base = planesFromImage(im, 512, 256); sourceName = "sample"; if (srcLabel) srcLabel.textContent = t("Stable Diffusion sample (DiffusionDB)", "Stable Diffusion 示例图像（DiffusionDB）"); schedule(); };
      im.src = window.BAYER_SAMPLE || "../assets/img/bayer/sample.png";
    }
    if (fileIn) fileIn.addEventListener("change", function () {
      var f = fileIn.files && fileIn.files[0]; if (!f) return;
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); base = planesFromImage(im, 640, 400); sourceName = "own"; if (srcLabel) srcLabel.textContent = f.name + t(" — centre crop, native pixels, processed locally", " — 中心裁剪，原生像素，本地处理"); schedule(); };
      im.onerror = function () { setStatus(t("Couldn't decode that file.", "无法解码该文件。")); };
      im.src = url;
    });
    if (resetBtn) resetBtn.addEventListener("click", function () { if (fileIn) fileIn.value = ""; loadSample(); });

    // ---- provenance: what happened to the image before we test it ------
    function provenance() { var v = "asis"; provInputs.forEach(function (i) { if (i.checked) v = i.value; }); return v; }
    function toCanvas(p) {
      var c = document.createElement("canvas"); c.width = p.w; c.height = p.h; var ctx = c.getContext("2d"), id = ctx.createImageData(p.w, p.h), d = id.data;
      for (var i = 0, j = 0; i < p.w * p.h; i++, j += 4) { d[j] = p.R[i]; d[j + 1] = p.G[i]; d[j + 2] = p.B[i]; d[j + 3] = 255; }
      ctx.putImageData(id, 0, 0); return c;
    }
    function jpegRoundTrip(p, q, cb) {
      var c = toCanvas(p), im = new Image();
      im.onload = function () { var k = document.createElement("canvas"); k.width = p.w; k.height = p.h; var ctx = k.getContext("2d", { willReadFrequently: true }); ctx.drawImage(im, 0, 0); cb(BC.planesFromRGBA(ctx.getImageData(0, 0, p.w, p.h).data, p.w, p.h, 4)); };
      im.src = c.toDataURL("image/jpeg", q);
    }
    function halve(p) {
      var c = toCanvas(p), w = Math.floor(p.w / 2), h = Math.floor(p.h / 2), k = document.createElement("canvas"); k.width = w; k.height = h;
      var ctx = k.getContext("2d", { willReadFrequently: true }); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(c, 0, 0, w, h);
      return BC.planesFromRGBA(ctx.getImageData(0, 0, w, h).data, w, h, 4);
    }
    function buildTest(cb) {
      var prov = provenance(), tp = truePat ? truePat.value : "rggb";
      if (truePat) truePat.disabled = prov === "asis";
      if (prov === "asis") return cb(base);
      var cam = BC.simulateCamera(base, tp);
      if (prov === "cam") return cb(cam);
      if (prov === "jpeg75") return jpegRoundTrip(cam, 0.75, cb);
      if (prov === "jpeg25") return jpegRoundTrip(cam, 0.25, cb);
      if (prov === "half") return cb(halve(cam));
      cb(cam);
    }

    // ---- run ------------------------------------------------------------
    function schedule() { if (busy) { pending = true; return; } run(); }
    function run() {
      if (!base) return;
      busy = true; setStatus(t("computing…", "计算中…")); root.classList.add("is-busy");
      setTimeout(function () {
        buildTest(function (t) {
          test = t;
          setTimeout(function () {
            stats = BC.redemosaicStats(test);
            busy = false; root.classList.remove("is-busy"); setStatus("");
            render();
            if (pending) { pending = false; run(); }
          }, 20);
        });
      }, 20);
    }

    // ---- drawing --------------------------------------------------------
    function drawImage() {
      if (!test) return;
      imgCanvas.width = test.w; imgCanvas.height = test.h;
      imgCanvas.getContext("2d").drawImage(toCanvas(test), 0, 0);
      if (outSize) outSize.textContent = test.w + " × " + test.h + " px";
    }
    function drawDiff() {
      if (!stats || !diffCanvas) return;
      var r = stats.perPattern[selected].image, w = test.w, h = test.h, ctx = diffCanvas.getContext("2d");
      diffCanvas.width = w; diffCanvas.height = h;
      var id = ctx.createImageData(w, h), d = id.data, GAIN = 30, c = hex(pal()[0]);
      for (var i = 0, j = 0; i < w * h; i++, j += 4) {
        var e = (Math.abs(r.R[i] - test.R[i]) + Math.abs(r.G[i] - test.G[i]) + Math.abs(r.B[i] - test.B[i])) / 3 * GAIN / 255;
        e = e > 1 ? 1 : e; d[j] = 255 + (c[0] - 255) * e; d[j + 1] = 255 + (c[1] - 255) * e; d[j + 2] = 255 + (c[2] - 255) * e; d[j + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
    }
    function drawZoom() {
      if (!test || !zoomCanvas) return;
      var N = 12, M = 8, cell = 22, S = Math.min(window.devicePixelRatio || 1, 2), g = BC.patternGrid(selected);
      zoomCanvas.width = N * cell * S; zoomCanvas.height = M * cell * S; zoomCanvas.style.aspectRatio = N + " / " + M;
      var ctx = zoomCanvas.getContext("2d"); ctx.scale(S, S);
      var x0 = Math.floor(test.w / 2) - N / 2, y0 = Math.floor(test.h / 2) - M / 2; x0 -= x0 % 2; y0 -= y0 % 2;
      for (var y = 0; y < M; y++) for (var x = 0; x < N; x++) {
        var ch = g[y & 1][x & 1], i = (y0 + y) * test.w + (x0 + x), v = [test.R[i], test.G[i], test.B[i]][ch];
        // the CFA keeps one channel per pixel: show that sample in its channel's colour
        var rgb = ch === 0 ? [v, 0, 0] : ch === 1 ? [0, v, 0] : [0, 0, v];
        ctx.fillStyle = "rgb(" + Math.round(rgb[0]) + "," + Math.round(rgb[1]) + "," + Math.round(rgb[2]) + ")";
        ctx.fillRect(x * cell, y * cell, cell, cell);
        ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.strokeRect(x * cell + .5, y * cell + .5, cell - 1, cell - 1);
        ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = "600 9px " + css("--font-mono", "monospace"); ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText("RGB"[ch], x * cell + 4, y * cell + 3);
      }
    }
    function drawBars() {
      if (!stats || !bars) return;
      var P = pal(), best = stats.best;
      bars.innerHTML = PATTERNS.map(function (p) {
        var v = stats.perPattern[p].psnr, shown = Math.min(v, PSNR_CAP), pct = Math.max(0, Math.min(100, (shown - 20) / (PSNR_CAP - 20) * 100));
        var label = v > PSNR_CAP ? "> " + PSNR_CAP + " dB" : v.toFixed(2) + " dB";
        return '<button type="button" class="bl-bar' + (p === best ? " is-best" : "") + (p === selected ? " is-selected" : "") + '" data-bl-pattern="' + p + '" aria-pressed="' + (p === selected) + '">' +
          '<span class="bl-bar__label">' + p.toUpperCase() + '</span>' +
          '<span class="bl-bar__track"><span class="bl-bar__fill" style="width:' + pct + '%;background:' + (p === best ? P[0] : "var(--border-strong)") + '"></span></span>' +
          '<span class="bl-bar__val">' + label + '</span></button>';
      }).join("");
      bars.querySelectorAll("[data-bl-pattern]").forEach(function (b) { b.addEventListener("click", function () { selected = b.dataset.blPattern; drawBars(); drawDiff(); drawZoom(); }); });
    }
    function drawStrip() {
      if (!stripCanvas || !DATA || !stats) return;
      var S = Math.min(window.devicePixelRatio || 1, 2), w = stripCanvas.clientWidth || 400, h = 78;
      stripCanvas.width = w * S; stripCanvas.height = h * S; stripCanvas.style.height = h + "px";
      var ctx = stripCanvas.getContext("2d"); ctx.scale(S, S);
      var P = pal(), B = DATA.binsLog10, lo = B.lo, hi = B.hi, n = B.n, padL = 18, padR = 18, padB = 16, padT = 18, iw = w - padL - padR, ih = h - padB - padT;
      function xOf(l) { return padL + (l - lo) / (hi - lo) * iw; }
      ctx.fillStyle = css("--bg-sunken", "#f4f4f2"); ctx.fillRect(0, 0, w, h);
      var sets = [["raise", P[0]], ["ddb", P[1]]];
      sets.forEach(function (s) {
        var H = DATA.hist[s[0]], N = DATA.meta[s[0]].n, mx = Math.max.apply(null, H) / N;
        ctx.fillStyle = s[1]; ctx.globalAlpha = .55;
        for (var i = 0; i < n; i++) { var f = H[i] / N / mx, x0 = xOf(lo + (hi - lo) * i / n), x1 = xOf(lo + (hi - lo) * (i + 1) / n); ctx.fillRect(x0, padT + ih * (1 - f), x1 - x0 - .5, ih * f); }
        ctx.globalAlpha = 1;
      });
      // (5, 95) window of RAISE
      ctx.strokeStyle = css("--text-faint", "#888"); ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      [THR5.lo, THR5.hi].forEach(function (t) { var x = xOf(Math.log10(t)); ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ih); ctx.stroke(); });
      ctx.setLineDash([]);
      // marker for this image
      var v = Math.max(1e-3, Math.min(Math.pow(10, hi), stats.std)), x = xOf(Math.log10(v));
      ctx.strokeStyle = css("--text", "#1a1a18"); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, padT - 4); ctx.lineTo(x, padT + ih); ctx.stroke();
      ctx.fillStyle = css("--text", "#1a1a18"); ctx.beginPath(); ctx.moveTo(x - 5, padT - 10); ctx.lineTo(x + 5, padT - 10); ctx.lineTo(x, padT - 4); ctx.closePath(); ctx.fill();
      var lbl = t("this image: ", "当前图像：") + stats.std.toFixed(3) + " dB", right = x > w / 2; ctx.font = "600 10px " + css("--font-sans", "sans-serif");
      var tw = ctx.measureText(lbl).width + 10, bx = right ? x - 8 - tw : x + 8, by = padT + ih / 2 - 8;
      ctx.fillStyle = css("--bg-elev", "#fff"); ctx.strokeStyle = css("--border-strong", "#ccc"); ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(bx, by, tw, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = css("--text", "#1a1a18"); ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillText(lbl, bx + 5, by + 8);
      ctx.font = "10px " + css("--font-mono", "monospace"); ctx.fillStyle = css("--text-faint", "#888"); ctx.textBaseline = "top"; ctx.textAlign = "center";
      [0.001, 0.01, 0.1, 1].forEach(function (t) { ctx.fillText(String(t), xOf(Math.log10(t)), h - 12); });
      ctx.textBaseline = "bottom"; ctx.font = "600 10px " + css("--font-sans", "sans-serif");
      var narrow = w < 520;
      ctx.textAlign = "right"; ctx.fillStyle = P[0]; ctx.fillText(narrow ? t("RAISE-1k (real)", "RAISE-1k（真实）") : t("RAISE-1k (real photographs)", "RAISE-1k（真实照片）"), w - padR, padT - 3);
      ctx.textAlign = "left"; ctx.fillStyle = P[1]; ctx.fillText(narrow ? t("DiffusionDB (fake)", "DiffusionDB（伪造）") : t("DiffusionDB (generated)", "DiffusionDB（生成）"), padL, padT - 3);
    }
    function render() {
      drawImage(); drawBars(); drawDiff(); drawZoom(); drawStrip();
      if (!stats) return;
      var std = stats.std;
      if (outStd) outStd.textContent = std.toFixed(3) + " dB";
      if (outBest) outBest.textContent = stats.best.toUpperCase();
      if (outVerdict) {
        var real = std >= THR5.lo && std <= THR5.hi;
        outVerdict.textContent = real ? t("real (camera-like)", "真实（类相机）") : std < THR5.lo ? t("fake (no pattern found)", "伪造（未发现图案）") : t("beyond any RAISE photo", "超出所有 RAISE 照片");
        outVerdict.style.color = real ? pal()[2] : pal()[1];
      }
    }

    provInputs.forEach(function (i) { i.addEventListener("change", schedule); });
    if (truePat) truePat.addEventListener("change", schedule);
    onTheme(function () { drawBars(); drawStrip(); drawZoom(); render(); });
    if (window.ResizeObserver) new ResizeObserver(function () { drawStrip(); }).observe(root);
    loadSample();
  }

  /* ============================================================
     2. Distributions of the PSNR spread
     ============================================================ */
  function initDist(root) {
    var canvas = root.querySelector("[data-bd-canvas]"), slider = root.querySelector("[data-bd-p]"), outP = root.querySelector("[data-bd-out-p]"),
      outThr = root.querySelector("[data-bd-out-thr]"), rows = root.querySelector("[data-bd-rows]"), toggles = root.querySelectorAll("[data-bd-set]");
    if (!canvas || !DATA) return;
    var SETS = { raise: { slot: 0, fill: true }, ddb: { slot: 1, fill: true }, gen: { slot: 3, fill: true }, land: { slot: 4, fill: true }, jpeg75: { slot: 2, fill: false, dash: [] }, jpeg25: { slot: 2, fill: false, dash: [4, 3] }, half: { slot: 2, fill: false, dash: [1, 3] } };
    var S = 1;
    function on(k) { var t = root.querySelector('[data-bd-set="' + k + '"]'); return t ? t.checked : false; }
    function colour(k) { var s = SETS[k]; return s.slot < 0 ? css("--text-faint", "#888") : pal()[s.slot]; }

    function render() {
      var p = +slider.value, row = DATA.table[p], ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height,
        padL = 44 * S, padR = 14 * S, padT = 18 * S, padB = 34 * S, iw = W - padL - padR, ih = H - padT - padB,
        B = DATA.binsLog10, lo = B.lo, hi = B.hi, n = B.n, ink = css("--text", "#1a1a18"), faint = css("--text-faint", "#86867e"), grid = css("--border", "#e4e4e0");
      function xOf(l) { return padL + (l - lo) / (hi - lo) * iw; }
      var keys = Object.keys(SETS).filter(on), ymax = 0;
      keys.forEach(function (k) { var N = DATA.meta[k].n; DATA.hist[k].forEach(function (c) { ymax = Math.max(ymax, c / N); }); });
      ymax = ymax * 1.15 || 1;
      function yOf(f) { return padT + ih * (1 - f / ymax); }
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = css("--bg-sunken", "#f4f4f2"); ctx.fillRect(0, 0, W, H);
      // threshold window
      var xa = xOf(Math.log10(row.lo)), xb = xOf(Math.log10(row.hi));
      ctx.fillStyle = ink; ctx.globalAlpha = isDark() ? .1 : .06; ctx.fillRect(xa, padT, xb - xa, ih); ctx.globalAlpha = 1;
      // grid
      ctx.strokeStyle = grid; ctx.lineWidth = 1 * S;
      [0.001, 0.01, 0.1, 1].forEach(function (t) { var x = xOf(Math.log10(t)); ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ih); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(padL, padT + ih); ctx.lineTo(W - padR, padT + ih); ctx.stroke();
      // filled sets first, outlines on top
      keys.filter(function (k) { return SETS[k].fill; }).concat(keys.filter(function (k) { return !SETS[k].fill; })).forEach(function (k) {
        var Hh = DATA.hist[k], N = DATA.meta[k].n, c = colour(k), s = SETS[k];
        if (s.fill) {
          ctx.fillStyle = c; ctx.globalAlpha = .5;
          for (var i = 0; i < n; i++) { var f = Hh[i] / N; if (!f) continue; var x0 = xOf(lo + (hi - lo) * i / n), x1 = xOf(lo + (hi - lo) * (i + 1) / n); ctx.fillRect(x0, yOf(f), Math.max(1, x1 - x0 - 1 * S), padT + ih - yOf(f)); }
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = c; ctx.lineWidth = 2 * S; ctx.setLineDash(s.dash.map(function (d) { return d * S; })); ctx.beginPath();
          for (var j = 0; j < n; j++) { var f2 = Hh[j] / N, xx0 = xOf(lo + (hi - lo) * j / n), xx1 = xOf(lo + (hi - lo) * (j + 1) / n), y = yOf(f2); if (j === 0) ctx.moveTo(xx0, y); else ctx.lineTo(xx0, y); ctx.lineTo(xx1, y); }
          ctx.stroke(); ctx.setLineDash([]);
        }
      });
      // threshold lines
      ctx.strokeStyle = ink; ctx.lineWidth = 1.2 * S; ctx.setLineDash([4 * S, 3 * S]);
      [xa, xb].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ih); ctx.stroke(); }); ctx.setLineDash([]);
      // axes text
      ctx.fillStyle = faint; ctx.font = (10.5 * S) + "px " + css("--font-mono", "monospace"); ctx.textAlign = "center"; ctx.textBaseline = "top";
      [0.001, 0.01, 0.1, 1].forEach(function (t) { ctx.fillText(String(t), xOf(Math.log10(t)), padT + ih + 6 * S); });
      ctx.fillText(t("std of PSNR across the four Bayer patterns (dB, log scale)", "四种 Bayer 图案间 PSNR 的标准差（dB，对数刻度）"), padL + iw / 2, padT + ih + 19 * S);
      ctx.save(); ctx.translate(12 * S, padT + ih / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(t("share of images", "图像占比"), 0, 0); ctx.restore();
      ctx.font = "600 " + (10.5 * S) + "px " + css("--font-sans", "sans-serif"); ctx.fillStyle = ink; ctx.textAlign = "left";
      ctx.fillText(t("predicted real", "判为真实"), xa + 5 * S, padT + 2 * S); ctx.textAlign = "right"; ctx.fillText(t("fake ←", "伪造 ←"), xa - 5 * S, padT + 2 * S);
      // direct labels at each set's mode
      ctx.font = "600 " + (10.5 * S) + "px " + css("--font-sans", "sans-serif"); ctx.textBaseline = "bottom";
      var used = [];
      keys.forEach(function (k) {
        var Hh = DATA.hist[k], N = DATA.meta[k].n, mi = 0; for (var i = 1; i < n; i++) if (Hh[i] > Hh[mi]) mi = i;
        var x = xOf(lo + (hi - lo) * (mi + .5) / n), y = yOf(Hh[mi] / N) - 4 * S, label = setLabel(k, DATA.meta[k]).replace(/ \(.*\)$|（.*）$/, "");
        while (used.some(function (u) { return Math.abs(u.x - x) < 90 * S && Math.abs(u.y - y) < 13 * S; })) y -= 13 * S;
        used.push({ x: x, y: y });
        ctx.fillStyle = colour(k); ctx.textAlign = x > padL + iw * .7 ? "right" : "left"; ctx.fillText(label, x, y);
      });
      if (outP) outP.textContent = "(" + p + ", " + (100 - p) + ")";
      if (outThr) outThr.textContent = row.lo.toFixed(3) + " – " + row.hi.toFixed(3) + " dB";
      if (rows) rows.innerHTML = Object.keys(SETS).map(function (k) {
        var v = row[k], m = DATA.meta[k], real = k === "raise";
        return '<tr' + (on(k) ? "" : ' class="is-off"') + '><th scope="row"><i style="' + (SETS[k].fill ? "background:" + colour(k) : "border-top:2px " + (SETS[k].dash.length ? "dashed" : "solid") + " " + colour(k)) + '"></i>' + setLabel(k, m) + '</th>' +
          '<td>' + m.n.toLocaleString() + '</td><td>' + m.median.toFixed(3) + '</td>' +
          '<td>' + (real ? (v * 100).toFixed(1) + t("% kept as real", "% 保留为真实") : (v * 100).toFixed(1) + t("% flagged fake", "% 标记为伪造")) + '</td></tr>';
      }).join("");
    }
    function resize() { var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth || 600, h = Math.round(Math.max(220, Math.min(340, w * 0.46))); canvas.style.height = h + "px"; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); S = dpr; render(); }
    slider.addEventListener("input", render);
    toggles.forEach(function (t) { t.addEventListener("change", render); });
    onTheme(render);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(root); else window.addEventListener("resize", resize);
    resize();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-bayer-lab]").forEach(initLab);
    document.querySelectorAll("[data-bayer-dist]").forEach(initDist);
  });
})();
