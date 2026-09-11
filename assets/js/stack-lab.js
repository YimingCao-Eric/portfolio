/* ============================================================
   Stacking playground for the ensemble case study.

   Four deliberately different base learners are fit on one split of a
   2-D dataset. A meta-learner (logistic regression over the base
   learners' probabilities) is fit on a second split — proper stacked
   generalisation, Wolpert 1992, so the meta-learner never sees the
   base learners' training data. Everything is scored on a third split.

   The point of the figure: an ensemble's gain comes from base learners
   that are WRONG IN DIFFERENT PLACES. The pairwise disagreement matrix
   makes that diversity visible — the quantity the report says it could
   not measure, and so had to search for blindly.
   ============================================================ */
(function () {
  "use strict";

  // i18n: site.js defines window.I18N before DOMContentLoaded; fall back to English.
  function t(en, zh) { return (window.I18N && window.I18N.t) ? window.I18N.t(en, zh) : en; }
  function lbl(L) { return t(L.label, L.labelZh); }
  function shortLbl(L) { return t(L.label.split(" ")[0], L.shortZh); }

  var PAL = { light: ["#2a78d6", "#eb6834"], dark: ["#3987e5", "#d95926"] };
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function css(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
  function mix(hexA, hexB, t) {
    var a = [1, 3, 5].map(function (i) { return parseInt(hexA.slice(i, i + 2), 16); }),
      b = [1, 3, 5].map(function (i) { return parseInt(hexB.slice(i, i + 2), 16); });
    return "rgb(" + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(",") + ")";
  }

  /* ---------- data: two interleaved moons ---------- */
  function makeData(seed, n) {
    var r = mulberry32(seed), pts = [];
    for (var i = 0; i < n; i++) {
      var c = i % 2, t = r() * Math.PI, x, y;
      if (c === 0) { x = Math.cos(t) - 0.5; y = Math.sin(t) - 0.25; }
      else { x = 0.5 - Math.cos(t); y = 0.25 - Math.sin(t) + 0.0; }
      pts.push({ x: x * 0.9 + 0.21 * gauss(r), y: y * 0.9 + 0.21 * gauss(r), c: c });
    }
    // shuffle, then split into base-train / meta-train / test
    for (var k = pts.length - 1; k > 0; k--) { var j = Math.floor(r() * (k + 1)); var tmp = pts[k]; pts[k] = pts[j]; pts[j] = tmp; }
    var a = Math.floor(n * 0.4), b = Math.floor(n * 0.7);
    return { A: pts.slice(0, a), B: pts.slice(a, b), C: pts.slice(b), all: pts };
  }

  /* ---------- base learners: each returns p(class 1) ---------- */
  var LEARNERS = [
    { key: "linear", label: "Linear", labelZh: "线性", shortZh: "线性", bias: "a straight line", biasZh: "一条直线",
      fit: function (A) {
        var w = [0, 0, 0];
        for (var it = 0; it < 600; it++) {
          var g = [0, 0, 0];
          A.forEach(function (p) { var e = sigmoid(w[0] * p.x + w[1] * p.y + w[2]) - p.c; g[0] += e * p.x; g[1] += e * p.y; g[2] += e; });
          for (var i = 0; i < 3; i++) w[i] -= 0.8 * g[i] / A.length;
        }
        return function (x, y) { return sigmoid(w[0] * x + w[1] * y + w[2]); };
      } },
    { key: "stump", label: "Axis stump", labelZh: "decision stump", shortZh: "stump", bias: "one threshold on x or y", biasZh: "在 x 或 y 上取一个阈值",
      fit: function (A) {
        var best = { acc: -1 };
        ["x", "y"].forEach(function (ax) {
          A.forEach(function (p) {
            [1, -1].forEach(function (sgn) {
              var ok = 0;
              A.forEach(function (q) { var pred = (q[ax] - p[ax]) * sgn > 0 ? 1 : 0; if (pred === q.c) ok++; });
              if (ok > best.acc) best = { acc: ok, ax: ax, th: p[ax], sgn: sgn };
            });
          });
        });
        return function (x, y) { var v = (ax(x, y) - best.th) * best.sgn; return sigmoid(v * 6); function ax(x, y) { return best.ax === "x" ? x : y; } };
      } },
    { key: "centroid", label: "Nearest centroid", labelZh: "nearest centroid", shortZh: "centroid", bias: "distance to two class means", biasZh: "到两类均值的距离",
      fit: function (A) {
        var m = [[0, 0, 0], [0, 0, 0]];
        A.forEach(function (p) { m[p.c][0] += p.x; m[p.c][1] += p.y; m[p.c][2]++; });
        var c0 = [m[0][0] / m[0][2], m[0][1] / m[0][2]], c1 = [m[1][0] / m[1][2], m[1][1] / m[1][2]];
        return function (x, y) {
          var d0 = Math.hypot(x - c0[0], y - c0[1]), d1 = Math.hypot(x - c1[0], y - c1[1]);
          return sigmoid((d0 - d1) * 5);
        };
      } },
    { key: "knn", label: "k-NN (k = 7)", labelZh: "k-NN（k = 7）", shortZh: "k-NN", bias: "vote of the 7 nearest training points", biasZh: "最近 7 个训练点投票",
      fit: function (A) {
        return function (x, y) {
          var d = A.map(function (p) { return { d: (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y), c: p.c }; });
          d.sort(function (u, v) { return u.d - v.d; });
          var s = 0; for (var i = 0; i < 7; i++) s += d[i].c;
          return (s + 0.5) / 8;                // light smoothing so 0 and 1 are never absolute
        };
      } }
  ];

  /* ---------- meta-learner: logistic regression over base probabilities ---------- */
  function fitMeta(B, models) {
    var k = models.length, w = new Array(k + 1).fill(0);
    if (!k) return function () { return 0.5; };
    var feats = B.map(function (p) { return models.map(function (m) { return m(p.x, p.y) * 2 - 1; }); });
    for (var it = 0; it < 800; it++) {
      var g = new Array(k + 1).fill(0);
      feats.forEach(function (f, i) {
        var z = w[k]; for (var j = 0; j < k; j++) z += w[j] * f[j];
        var e = sigmoid(z) - B[i].c;
        for (var j2 = 0; j2 < k; j2++) g[j2] += e * f[j2];
        g[k] += e;
      });
      for (var j3 = 0; j3 <= k; j3++) w[j3] -= 0.6 * g[j3] / B.length;
    }
    return function (x, y) { var z = w[k]; for (var j = 0; j < k; j++) z += w[j] * (models[j](x, y) * 2 - 1); return sigmoid(z); };
  }

  function accuracy(model, C) { var ok = 0; C.forEach(function (p) { if ((model(p.x, p.y) > 0.5 ? 1 : 0) === p.c) ok++; }); return ok / C.length; }

  /* ============================================================ */
  function initLab(root) {
    var panels = root.querySelector("[data-stack-panels]"),
      stacked = root.querySelector("[data-stack-canvas]"),
      matrix = root.querySelector("[data-stack-matrix]"),
      outAcc = root.querySelector("[data-out-stack]"),
      outBest = root.querySelector("[data-out-best]"),
      outGain = root.querySelector("[data-out-gain]"),
      resample = root.querySelector("[data-stack-resample]"),
      boxes = root.querySelectorAll("[data-stack-include]");
    if (!panels || !stacked) return;

    var seed = 11, data, fitted = [], S = 1;

    function refit() {
      data = makeData(seed, 300);
      fitted = LEARNERS.map(function (L) { var m = L.fit(data.A); return { L: L, model: m, acc: accuracy(m, data.C) }; });
    }
    function included() {
      return fitted.filter(function (f, i) { return boxes[i] && boxes[i].checked; });
    }

    function drawMap(canvas, model, pts, title, acc, big) {
      var ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height, pal = isDark() ? PAL.dark : PAL.light,
        surface = css("--bg-sunken", "#f4f4f2"), ring = css("--bg-elev", "#fff"), ink = css("--text", "#1a1a18"), faint = css("--text-faint", "#86867e");
      function px(p) { return [W / 2 + p.x * (W / 3.4), H / 2 - p.y * (H / 2.4)]; }
      function unit(x, y) { return { x: (x - W / 2) / (W / 3.4), y: (H / 2 - y) / (H / 2.4) }; }
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = surface; ctx.fillRect(0, 0, W, H);
      var cell = Math.max(3, Math.round((big ? 4 : 5) * S)), a = isDark() ? 0.42 : 0.30;
      for (var y = 0; y < H; y += cell) for (var x = 0; x < W; x += cell) {
        var u = unit(x + cell / 2, y + cell / 2), p = model(u.x, u.y), t = Math.max(0, Math.min(1, (p - 0.5) * 2.2 + 0.5));
        ctx.fillStyle = mix(pal[0], pal[1], t); ctx.globalAlpha = a; ctx.fillRect(x, y, cell, cell);
      }
      ctx.globalAlpha = 1;
      var r = (big ? 4 : 3) * S;
      pts.forEach(function (p) {
        var q = px(p), wrong = (model(p.x, p.y) > 0.5 ? 1 : 0) !== p.c;
        ctx.beginPath(); ctx.arc(q[0], q[1], r + 1.2 * S, 0, 6.283); ctx.fillStyle = ring; ctx.fill();
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.283); ctx.fillStyle = pal[p.c]; ctx.fill();
        if (wrong) { ctx.strokeStyle = ink; ctx.lineWidth = 1.2 * S; ctx.beginPath(); ctx.moveTo(q[0] - r, q[1] - r); ctx.lineTo(q[0] + r, q[1] + r); ctx.moveTo(q[0] + r, q[1] - r); ctx.lineTo(q[0] - r, q[1] + r); ctx.stroke(); }
      });
      if (title) {
        ctx.font = "600 " + (big ? 12 : 11) * S + "px " + css("--font-sans", "sans-serif"); ctx.textBaseline = "top"; ctx.textAlign = "left";
        ctx.fillStyle = ink; ctx.fillText(title, 8 * S, 7 * S);
        ctx.font = (big ? 12 : 11) * S + "px " + css("--font-mono", "monospace"); ctx.textAlign = "right"; ctx.fillStyle = faint;
        ctx.fillText((acc * 100).toFixed(1) + "%", W - 8 * S, 7 * S);
      }
    }

    function render() {
      var inc = included(), meta = fitMeta(data.B, inc.map(function (f) { return f.model; })), macc = accuracy(meta, data.C);
      fitted.forEach(function (f, i) {
        var c = panels.children[i].querySelector("canvas"); if (!c) return;
        drawMap(c, f.model, data.C, lbl(f.L), f.acc, false);
        panels.children[i].classList.toggle("is-off", !(boxes[i] && boxes[i].checked));
      });
      drawMap(stacked, meta, data.C, inc.length ? t("Stacked (" + inc.length + " learner" + (inc.length > 1 ? "s" : "") + ")", "stacking（" + inc.length + " 个 base learner）") : t("Stacked (nothing selected)", "stacking（未选择任何 base learner）"), macc, true);

      var best = inc.length ? Math.max.apply(null, inc.map(function (f) { return f.acc; })) : 0;
      if (outAcc) outAcc.textContent = inc.length ? (macc * 100).toFixed(1) + "%" : "—";
      if (outBest) outBest.textContent = inc.length ? (best * 100).toFixed(1) + "%" : "—";
      if (outGain) { var g = (macc - best) * 100; outGain.textContent = inc.length ? (g >= 0 ? "+" : "") + g.toFixed(1) + t(" pts", " 个百分点") : "—"; }

      // pairwise disagreement on the test split
      if (matrix) {
        var n = fitted.length, html = "<tr><th></th>" + fitted.map(function (f) { return "<th>" + shortLbl(f.L) + "</th>"; }).join("") + "</tr>";
        for (var i = 0; i < n; i++) {
          html += "<tr><th>" + shortLbl(fitted[i].L) + "</th>";
          for (var j = 0; j < n; j++) {
            if (i === j) { html += "<td class='diag'>·</td>"; continue; }
            var dis = 0; data.C.forEach(function (p) { if ((fitted[i].model(p.x, p.y) > 0.5) !== (fitted[j].model(p.x, p.y) > 0.5)) dis++; });
            var pct = dis / data.C.length;
            html += "<td style='--v:" + pct.toFixed(2) + "'>" + Math.round(pct * 100) + "%</td>";
          }
          html += "</tr>";
        }
        matrix.innerHTML = html;
      }
    }

    function fit(canvas, ratio) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth || 200, h = Math.round(w * ratio);
      canvas.style.height = h + "px"; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); S = dpr;
    }
    function resize() {
      panels.querySelectorAll("canvas").forEach(function (c) { fit(c, 0.78); });
      fit(stacked, 0.78); render();
    }

    // build the four small panels
    LEARNERS.forEach(function (L, i) {
      var d = document.createElement("div"); d.className = "stack-panel";
      d.innerHTML = '<canvas aria-label="' + t(L.label + " decision map", lbl(L) + "决策图") + '"></canvas><p class="stack-panel__bias">' + t(L.bias, L.biasZh) + "</p>";
      panels.appendChild(d);
    });

    Array.prototype.forEach.call(boxes, function (b) { b.addEventListener("change", render); });
    if (resample) resample.addEventListener("click", function () { seed = (seed * 7919 + 17) % 100003; refit(); render(); });
    document.addEventListener("themechange", render);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(root); else window.addEventListener("resize", resize);

    refit(); resize();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-stack-lab]").forEach(initLab);
  });
})();
