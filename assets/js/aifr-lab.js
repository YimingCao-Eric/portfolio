/* ============================================================
   Two figures for the age-invariant face recognition case study.

   1. Results explorer — every configuration from Tables I–IV of the
      report, on three test sets. Real numbers, nothing simulated.

   2. Verification threshold — the metric from Section III.B, on
      synthetic distance distributions. Same-identity pairs at
      different ages produce larger feature distances than same-age
      pairs; an "age gap" control widens that distribution, and the
      threshold slider shows what it costs.
   ============================================================ */
(function () {
  "use strict";

  function t(en, zh) { return (window.I18N && window.I18N.t) ? window.I18N.t(en, zh) : en; }

  var PAL = { light: ["#2a78d6", "#eb6834", "#1baf7a"], dark: ["#3987e5", "#d95926", "#199e70"] };
  function isDark() { var t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function pal() { return isDark() ? PAL.dark : PAL.light; }
  function css(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }

  /* ---------- the data (Tables I–IV of the report) ---------- */
  var RESULTS = [
    { id: "ef-ms1m",     group: "base", student: "ElasticFace R100", init: t("trained on MS1MV2 (Boutros et al.)", "在 MS1MV2 上训练（Boutros 等）"), teacher: null,               b3fd: 87.1, agedb: 98.3, casia: 96.1 },
    { id: "mtl-b3fd",    group: "base", student: "MTLFace",          init: t("trained on B3FD", "在 B3FD 上训练"),                    teacher: null,               b3fd: 96.3, agedb: 77.4, casia: 82.2 },
    { id: "ef-b3fd",     group: "base", student: "ElasticFace R100", init: t("trained on B3FD", "在 B3FD 上训练"),                    teacher: null,               b3fd: 91.0, agedb: 57.0, casia: 68.0 },
    { id: "kd-ef-pre",   group: "kdms", student: "ElasticFace R100", init: t("B3FD-pretrained", "B3FD 预训练"),                    teacher: "ElasticFace · MS1M", b3fd: 95.7, agedb: 76.5, casia: 82.1 },
    { id: "kd-ef-scr",   group: "kdms", student: "ElasticFace R100", init: t("from scratch", "从零训练"),                       teacher: "ElasticFace · MS1M", b3fd: 95.6, agedb: 74.8, casia: 79.9 },
    { id: "kd-mtl-pre",  group: "kdms", student: "MTLFace",          init: t("B3FD-pretrained", "B3FD 预训练"),                    teacher: "ElasticFace · MS1M", b3fd: 96.0, agedb: 76.5, casia: 82.6 },
    { id: "kd-mtl-scr",  group: "kdms", student: "MTLFace",          init: t("from scratch", "从零训练"),                       teacher: "ElasticFace · MS1M", b3fd: 83.4, agedb: 59.6, casia: 67.3 },
    { id: "kd-ef-mtlt",  group: "kdb3", student: "ElasticFace R100", init: t("B3FD-pretrained", "B3FD 预训练"),                    teacher: "MTLFace · B3FD",     b3fd: 94.3, agedb: 79.7, casia: 82.9 },
    { id: "kd-ef-eft",   group: "kdb3", student: "ElasticFace R100", init: t("B3FD-pretrained", "B3FD 预训练"),                    teacher: "ElasticFace · B3FD", b3fd: 90.8, agedb: 64.7, casia: 71.8 }
  ];
  var GROUPS = { base: { label: t("Standalone model", "独立模型"), slot: -1 }, kdms: { label: t("KD · teacher pretrained on MS1M", "KD · 教师在 MS1M 上预训练"), slot: 0 }, kdb3: { label: t("KD · teacher pretrained on B3FD", "KD · 教师在 B3FD 上预训练"), slot: 1 } };

  function initResults(root) {
    var list = root.querySelector("[data-aifr-list]"), tabs = root.querySelectorAll("[data-aifr-set]"),
      sortBox = root.querySelector("[data-aifr-sort]"), legend = root.querySelector("[data-aifr-legend]");
    if (!list) return;
    var set = "agedb", sorted = true;

    function render() {
      var P = pal(), rows = RESULTS.slice();
      if (sorted) rows.sort(function (a, b) { return b[set] - a[set]; });
      var base = RESULTS.filter(function (r) { return r.id === "ef-b3fd"; })[0][set];
      list.innerHTML = rows.map(function (r) {
        var g = GROUPS[r.group], color = g.slot < 0 ? "var(--border-strong)" : P[g.slot],
          delta = r.group === "base" ? "" : (r[set] - base >= 0 ? "+" : "") + (r[set] - base).toFixed(1),
          best = r[set] === Math.max.apply(null, RESULTS.map(function (x) { return x[set]; }));
        return '<div class="aifr-row' + (best ? " is-best" : "") + '">' +
          '<div class="aifr-row__label"><b>' + r.student + '</b><span>' + r.init + (r.teacher ? " · " + t("teacher", "教师") + " " + r.teacher : "") + "</span></div>" +
          '<div class="aifr-row__track"><div class="aifr-row__fill" style="width:' + r[set] + '%;background:' + color + '"></div>' +
          '<div class="aifr-row__ref" style="left:' + base + '%" title="' + t("ElasticFace trained on B3FD alone", "仅在 B3FD 上训练的 ElasticFace") + '"></div></div>' +
          '<div class="aifr-row__val">' + r[set].toFixed(1) + "%" + (delta ? '<small>' + delta + "</small>" : "") + "</div></div>";
      }).join("");
      if (legend) legend.innerHTML = Object.keys(GROUPS).map(function (k) {
        var g = GROUPS[k], c = g.slot < 0 ? "var(--border-strong)" : P[g.slot];
        return '<span><i style="background:' + c + '"></i>' + g.label + "</span>";
      }).join("") + '<span><i class="aifr-legend__ref"></i>' + t("ElasticFace-on-B3FD baseline (Δ is against it)", "ElasticFace-on-B3FD 基线（Δ 以其为参照）") + "</span>";
      tabs.forEach(function (t) { t.classList.toggle("is-active", t.dataset.aifrSet === set); t.setAttribute("aria-selected", t.dataset.aifrSet === set ? "true" : "false"); });
    }
    tabs.forEach(function (t) { t.addEventListener("click", function () { set = t.dataset.aifrSet; render(); }); });
    if (sortBox) sortBox.addEventListener("change", function () { sorted = sortBox.checked; render(); });
    document.addEventListener("themechange", render);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
    render();
  }

  /* ============================================================
     2. Verification threshold
     ============================================================ */
  function initThreshold(root) {
    var canvas = root.querySelector("[data-thr-canvas]"), thr = root.querySelector("[data-thr-t]"), gap = root.querySelector("[data-thr-gap]"),
      outAcc = root.querySelector("[data-out-acc]"), outFar = root.querySelector("[data-out-far]"), outFrr = root.querySelector("[data-out-frr]"),
      outBest = root.querySelector("[data-out-best]"), outGap = root.querySelector("[data-out-gap]");
    if (!canvas) return;

    // distances are modelled as Gaussians; the same-identity mean grows with age gap
    function dists(g) {
      return { same: { mu: 0.9 + 0.9 * g, sd: 0.22 + 0.22 * g }, diff: { mu: 2.05, sd: 0.28 } };
    }
    function pdf(x, d) { var z = (x - d.mu) / d.sd; return Math.exp(-0.5 * z * z) / (d.sd * Math.sqrt(2 * Math.PI)); }
    function cdf(x, d) { var z = (x - d.mu) / (d.sd * Math.SQRT2); return 0.5 * (1 + erf(z)); }
    function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x); var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
    // accept a pair as "same identity" when distance <= t
    function metrics(t, d) { var frr = 1 - cdf(t, d.same), far = cdf(t, d.diff); return { acc: 1 - 0.5 * (frr + far), far: far, frr: frr }; }
    function bestT(d) { var b = { t: 0, acc: -1 }; for (var t = 0; t <= 3.5; t += 0.005) { var m = metrics(t, d); if (m.acc > b.acc) b = { t: t, acc: m.acc }; } return b; }

    var S = 1;
    function render() {
      var g = +gap.value / 100, thrV = +thr.value / 100, d = dists(g), P = pal(), ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height,
        padL = 12 * S, padR = 12 * S, padT = 14 * S, padB = 26 * S, iw = W - padL - padR, ih = H - padT - padB,
        ink = css("--text", "#1a1a18"), faint = css("--text-faint", "#86867e"), grid = css("--border", "#e4e4e0"), XMAX = 3.5;
      var ymax = Math.max(pdf(d.same.mu, d.same), pdf(d.diff.mu, d.diff)) * 1.12;
      function xOf(v) { return padL + (v / XMAX) * iw; } function yOf(v) { return padT + ih * (1 - v / ymax); }
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = css("--bg-sunken", "#f4f4f2"); ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = grid; ctx.lineWidth = 1 * S; ctx.beginPath(); ctx.moveTo(padL, yOf(0)); ctx.lineTo(W - padR, yOf(0)); ctx.stroke();

      // shaded error regions: FRR (same pairs beyond t) and FAR (different pairs within t)
      function area(dd, from, to, color) {
        ctx.beginPath(); ctx.moveTo(xOf(from), yOf(0));
        for (var x = from; x <= to; x += 0.01) ctx.lineTo(xOf(x), yOf(pdf(x, dd)));
        ctx.lineTo(xOf(to), yOf(0)); ctx.closePath(); ctx.fillStyle = color; ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1;
      }
      area(d.same, thrV, XMAX, P[0]); area(d.diff, 0, thrV, P[1]);
      function curve(dd, color) {
        ctx.beginPath(); for (var x = 0; x <= XMAX; x += 0.01) { var y = yOf(pdf(x, dd)); x === 0 ? ctx.moveTo(xOf(x), y) : ctx.lineTo(xOf(x), y); }
        ctx.strokeStyle = color; ctx.lineWidth = 2 * S; ctx.stroke();
      }
      curve(d.same, P[0]); curve(d.diff, P[1]);

      // best threshold (dashed) and chosen threshold (solid)
      var b = bestT(d);
      ctx.setLineDash([3 * S, 3 * S]); ctx.strokeStyle = faint; ctx.lineWidth = 1 * S;
      ctx.beginPath(); ctx.moveTo(xOf(b.t), padT); ctx.lineTo(xOf(b.t), yOf(0)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.moveTo(xOf(thrV), padT); ctx.lineTo(xOf(thrV), yOf(0)); ctx.stroke();

      ctx.font = (10.5 * S) + "px " + css("--font-mono", "monospace"); ctx.fillStyle = faint; ctx.textAlign = "center"; ctx.textBaseline = "top";
      [0, 1, 2, 3].forEach(function (v) { ctx.fillText(String(v), xOf(v), yOf(0) + 6 * S); });
      ctx.fillText(t("feature-map distance", "特征图距离"), xOf(XMAX / 2), yOf(0) + 16 * S);
      ctx.font = "600 " + (11 * S) + "px " + css("--font-sans", "sans-serif"); ctx.textBaseline = "top";
      ctx.fillStyle = P[0]; ctx.textAlign = "left"; ctx.fillText(t("same person, different ages", "同一人，不同年龄"), padL + 4 * S, padT);
      ctx.fillStyle = P[1]; ctx.textAlign = "right"; ctx.fillText(t("different people", "不同的人"), W - padR - 4 * S, padT);
      ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.font = (10.5 * S) + "px " + css("--font-mono", "monospace");
      ctx.fillText(t("threshold", "阈值") + " " + thrV.toFixed(2), xOf(thrV) + 5 * S, padT + 16 * S);

      var m = metrics(thrV, d);
      if (outAcc) outAcc.textContent = (m.acc * 100).toFixed(1) + "%";
      if (outFar) outFar.textContent = (m.far * 100).toFixed(1) + "%";
      if (outFrr) outFrr.textContent = (m.frr * 100).toFixed(1) + "%";
      if (outBest) outBest.textContent = b.t.toFixed(2) + " → " + (b.acc * 100).toFixed(1) + "%";
      if (outGap) outGap.textContent = g === 0 ? t("none", "无") : g < 0.4 ? t("small", "较小") : g < 0.75 ? t("large", "较大") : t("decades", "数十年");
    }
    function resize() { var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth || 600, h = Math.round(Math.max(200, w * 0.4)); canvas.style.height = h + "px"; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); S = dpr; render(); }
    thr.addEventListener("input", render); gap.addEventListener("input", render);
    var snap = root.querySelector("[data-thr-snap]");
    if (snap) snap.addEventListener("click", function () { thr.value = Math.round(bestT(dists(+gap.value / 100)).t * 100); render(); });
    document.addEventListener("themechange", render);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(root); else window.addEventListener("resize", resize);
    resize();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-aifr-results]").forEach(initResults);
    document.querySelectorAll("[data-thr-lab]").forEach(initThreshold);
  });
})();
