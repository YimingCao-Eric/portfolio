/* ============================================================
   Two figures for the few-shot learning case study.

   1. A Prototypical Network playground, in 2-D.
      Algorithm 1 from the report, run on synthetic feature vectors:
        prototype_c = mean of the support features of class c
        logits(q)   = -||q - prototype_c||_2
      Decision regions are shaded by nearest prototype. Support points
      can be dragged, and an outlier can be injected into one class to
      show how a plain mean is pulled — the weakness the report's
      Appendix B was trying to fix.

   2. Test-accuracy curves against epoch, from the notebook's own
      training logs (window.FSL_RUNS).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- palette (validated: see dataviz palette.md) ---------- */
  var PAL = {
    light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
    dark:  ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"]
  };
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function palette() { return isDark() ? PAL.dark : PAL.light; }
  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ---------- seeded RNG ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    var u = Math.max(rnd(), 1e-12), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- marker shapes (secondary encoding for identity) ---------- */
  function shape(ctx, kind, x, y, r) {
    ctx.beginPath();
    switch (kind) {
      case 1: ctx.rect(x - r, y - r, 2 * r, 2 * r); break;
      case 2: ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.1, y + r * 0.8); ctx.lineTo(x - r * 1.1, y + r * 0.8); ctx.closePath(); break;
      case 3: ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.2, y); ctx.closePath(); break;
      case 4: for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * 2 * Math.PI / 5; var px = x + r * 1.15 * Math.cos(a), py = y + r * 1.15 * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); break;
      default: ctx.arc(x, y, r, 0, 2 * Math.PI);
    }
  }

  /* ============================================================
     1. Prototypical Network playground
     ============================================================ */
  function initProto(root) {
    var canvas = root.querySelector("[data-proto-canvas]"),
      nSel = root.querySelector("[data-proto-n]"),
      kSel = root.querySelector("[data-proto-k]"),
      resample = root.querySelector("[data-proto-resample]"),
      outlier = root.querySelector("[data-proto-outlier]"),
      outAcc = root.querySelector("[data-out-acc]"),
      outShift = root.querySelector("[data-out-shift]"),
      legend = root.querySelector("[data-proto-legend]");
    if (!canvas) return;

    var state = { N: 3, K: 5, Q: 5, seed: 7, outlier: false, classes: [] },
      drag = null, W = 0, H = 0, S = 1;

    function sample() {
      var rnd = mulberry32(state.seed), centers = [], tries = 0;
      while (centers.length < state.N && tries++ < 500) {
        var c = [rnd() * 1.5 - 0.75, rnd() * 1.5 - 0.75], ok = true;
        for (var i = 0; i < centers.length; i++) {
          var dx = c[0] - centers[i][0], dy = c[1] - centers[i][1];
          if (dx * dx + dy * dy < 0.55 * 0.55) { ok = false; break; }
        }
        if (ok) centers.push(c);
      }
      state.classes = centers.map(function (c, ci) {
        var sd = 0.2, sup = [], qry = [];
        for (var k = 0; k < state.K; k++) sup.push([c[0] + sd * gauss(rnd), c[1] + sd * gauss(rnd)]);
        for (var q = 0; q < state.Q; q++) qry.push([c[0] + sd * gauss(rnd), c[1] + sd * gauss(rnd)]);
        return { center: c, support: sup, query: qry, outlier: null };
      });
      if (state.outlier) placeOutlier();
    }

    function placeOutlier() {
      // an unrepresentative support example for class 0, dropped near another class
      var a = state.classes[0], b = state.classes[1 % state.N];
      a.outlier = [b.center[0] * 0.8 + a.center[0] * 0.2, b.center[1] * 0.8 + a.center[1] * 0.2];
    }

    function prototypes() {
      return state.classes.map(function (cl) {
        var pts = cl.support.concat(cl.outlier ? [cl.outlier] : []), sx = 0, sy = 0;
        pts.forEach(function (p) { sx += p[0]; sy += p[1]; });
        return [sx / pts.length, sy / pts.length];
      });
    }
    function cleanPrototype(ci) {
      var sx = 0, sy = 0, cl = state.classes[ci];
      cl.support.forEach(function (p) { sx += p[0]; sy += p[1]; });
      return [sx / cl.support.length, sy / cl.support.length];
    }
    function nearest(p, protos) {
      var best = 0, bd = Infinity;
      for (var i = 0; i < protos.length; i++) {
        var dx = p[0] - protos[i][0], dy = p[1] - protos[i][1], d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }

    /* unit coords [-1,1] -> canvas px */
    function toPx(p) { return [W / 2 + p[0] * (Math.min(W, H) / 2.3), H / 2 - p[1] * (Math.min(W, H) / 2.3)]; }
    function toUnit(x, y) { var s = Math.min(W, H) / 2.3; return [(x - W / 2) / s, (H / 2 - y) / s]; }

    function hexA(hex, a) {
      var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }

    function render() {
      var ctx = canvas.getContext("2d"), pal = palette(), protos = prototypes(),
        surface = css("--bg-sunken", "#f4f4f2"), ring = css("--bg-elev", "#fff"),
        ink = css("--text", "#1a1a18");
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = surface; ctx.fillRect(0, 0, W, H);

      // decision regions: nearest prototype, rasterised
      var cell = Math.max(3, Math.round(4 * S));
      for (var y = 0; y < H; y += cell) {
        for (var x = 0; x < W; x += cell) {
          var c = nearest(toUnit(x + cell / 2, y + cell / 2), protos);
          ctx.fillStyle = hexA(pal[c], isDark() ? 0.16 : 0.11);
          ctx.fillRect(x, y, cell, cell);
        }
      }

      // region boundaries: exact bisectors between prototype pairs, clipped to where
      // both are the nearest — straight lines, since nearest-mean is a Voronoi partition
      ctx.strokeStyle = hexA(ink.startsWith("#") ? ink : "#000000", 0.22);
      ctx.lineWidth = 1.25 * S;
      ctx.beginPath();
      var step = 2 * S, diag = Math.sqrt(W * W + H * H);
      for (var a = 0; a < protos.length; a++) {
        for (var b = a + 1; b < protos.length; b++) {
          var pa = toPx(protos[a]), pb = toPx(protos[b]),
            mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2,
            dx = pb[0] - pa[0], dy = pb[1] - pa[1], len = Math.hypot(dx, dy) || 1,
            ux = -dy / len, uy = dx / len, pen = false;
          for (var t = -diag; t <= diag; t += step) {
            var x = mx + ux * t, y = my + uy * t;
            if (x < 0 || y < 0 || x > W || y > H) { pen = false; continue; }
            var n = nearest(toUnit(x, y), protos);
            if (n === a || n === b) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
            else pen = false;
          }
        }
      }
      ctx.stroke();

      var correct = 0, total = 0, rS = 5.5 * S, rQ = 5 * S, rP = 9 * S;

      state.classes.forEach(function (cl, ci) {
        // support: filled marker with a surface ring
        cl.support.concat(cl.outlier ? [cl.outlier] : []).forEach(function (p, idx) {
          var q = toPx(p), isOut = cl.outlier && idx === cl.support.length;
          ctx.lineWidth = 2 * S; ctx.strokeStyle = ring;
          shape(ctx, ci, q[0], q[1], rS + 1.5 * S); ctx.stroke();
          ctx.fillStyle = pal[ci];
          shape(ctx, ci, q[0], q[1], rS); ctx.fill();
          if (isOut) {                    // flag the injected outlier
            ctx.strokeStyle = ink; ctx.lineWidth = 1.5 * S;
            ctx.beginPath(); ctx.arc(q[0], q[1], rS + 5 * S, 0, 2 * Math.PI); ctx.stroke();
          }
        });
        // query: hollow marker in the TRUE class shape, stroked in the PREDICTED class colour
        cl.query.forEach(function (p) {
          var q = toPx(p), pred = nearest(p, protos), ok = pred === ci;
          total++; if (ok) correct++;
          ctx.lineWidth = 2 * S; ctx.strokeStyle = ring;
          shape(ctx, ci, q[0], q[1], rQ + 1.5 * S); ctx.stroke();
          ctx.fillStyle = surface; ctx.strokeStyle = pal[pred]; ctx.lineWidth = 2 * S;
          shape(ctx, ci, q[0], q[1], rQ); ctx.fill(); ctx.stroke();
          if (!ok) {                      // an X through misclassified queries, never colour alone
            ctx.strokeStyle = ink; ctx.lineWidth = 1.5 * S;
            ctx.beginPath();
            ctx.moveTo(q[0] - rQ, q[1] - rQ); ctx.lineTo(q[0] + rQ, q[1] + rQ);
            ctx.moveTo(q[0] + rQ, q[1] - rQ); ctx.lineTo(q[0] - rQ, q[1] + rQ);
            ctx.stroke();
          }
        });
      });

      // prototypes: large ringed marker; when an outlier is on, ghost the clean one too
      protos.forEach(function (p, ci) {
        var q = toPx(p);
        if (state.classes[ci].outlier) {
          var cp = toPx(cleanPrototype(ci));
          ctx.setLineDash([3 * S, 3 * S]); ctx.strokeStyle = pal[ci]; ctx.lineWidth = 1.5 * S;
          ctx.beginPath(); ctx.moveTo(cp[0], cp[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.45; shape(ctx, ci, cp[0], cp[1], rP); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.fillStyle = ring; ctx.strokeStyle = pal[ci]; ctx.lineWidth = 3 * S;
        shape(ctx, ci, q[0], q[1], rP); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pal[ci];
        shape(ctx, ci, q[0], q[1], rP * 0.42); ctx.fill();
      });

      if (outAcc) outAcc.textContent = correct + " / " + total + "  (" + Math.round(100 * correct / total) + "%)";
      if (outShift) {
        if (state.outlier) {
          var a = protos[0], b = cleanPrototype(0);
          outShift.textContent = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)).toFixed(2) + " units";
        } else outShift.textContent = "—";
      }
      if (legend) buildLegend(pal);
    }

    function buildLegend(pal) {
      legend.innerHTML = "";
      for (var i = 0; i < state.N; i++) {
        var li = document.createElement("span"), c = document.createElement("canvas");
        c.width = c.height = 28; c.style.width = c.style.height = "14px";
        var g = c.getContext("2d"); g.fillStyle = pal[i]; shape(g, i, 14, 14, 9); g.fill();
        li.className = "proto-legend__item"; li.appendChild(c);
        li.appendChild(document.createTextNode("class " + (i + 1)));
        legend.appendChild(li);
      }
      var key = document.createElement("span");
      key.className = "proto-legend__key";
      key.textContent = "filled = support · hollow = query, stroked in predicted class · large = prototype · × = misclassified";
      legend.appendChild(key);
    }

    /* ---------- dragging support points ---------- */
    function hit(x, y) {
      var best = null, bd = (14 * S) * (14 * S);
      state.classes.forEach(function (cl, ci) {
        var pts = cl.support.concat(cl.outlier ? [cl.outlier] : []);
        pts.forEach(function (p, i) {
          var q = toPx(p), dx = q[0] - x, dy = q[1] - y, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = { ci: ci, i: i, isOut: cl.outlier && i === cl.support.length }; }
        });
      });
      return best;
    }
    function pos(e) {
      var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e;
      return [(t.clientX - r.left) * (canvas.width / r.width), (t.clientY - r.top) * (canvas.height / r.height)];
    }
    function down(e) { var p = pos(e); drag = hit(p[0], p[1]); if (drag) { e.preventDefault(); canvas.style.cursor = "grabbing"; } }
    function move(e) {
      var p = pos(e);
      if (drag) {
        var u = toUnit(p[0], p[1]), cl = state.classes[drag.ci];
        if (drag.isOut) cl.outlier = u; else cl.support[drag.i] = u;
        render(); e.preventDefault();
      } else canvas.style.cursor = hit(p[0], p[1]) ? "grab" : "default";
    }
    function up() { drag = null; canvas.style.cursor = "default"; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);

    /* ---------- controls ---------- */
    if (nSel) nSel.addEventListener("change", function () { state.N = +nSel.value; sample(); render(); });
    if (kSel) kSel.addEventListener("change", function () { state.K = +kSel.value; sample(); render(); });
    if (resample) resample.addEventListener("click", function () { state.seed = (state.seed * 7919 + 13) % 100003; sample(); render(); });
    if (outlier) outlier.addEventListener("change", function () {
      state.outlier = outlier.checked;
      if (state.outlier) placeOutlier(); else state.classes.forEach(function (c) { c.outlier = null; });
      render();
    });

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth || 480, h = Math.round(w * 0.72);
      canvas.style.height = h + "px"; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      W = canvas.width; H = canvas.height; S = dpr; render();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(root); else window.addEventListener("resize", resize);
    document.addEventListener("themechange", render);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

    sample(); resize();
  }

  /* ============================================================
     2. Training curves
     ============================================================ */
  function initCurves(root) {
    var canvas = root.querySelector("[data-curves-canvas]"),
      tip = root.querySelector("[data-curves-tip]"),
      noaug = root.querySelector("[data-curves-noaug]"),
      runs = window.FSL_RUNS;
    if (!canvas || !runs) return;

    var SERIES = [
      { key: "resnet18", label: "ResNet-18", slot: 0 },
      { key: "densenet121", label: "DenseNet-121", slot: 1 },
      { key: "convnext_tiny", label: "ConvNeXt-T", slot: 2 }
    ];
    var NOAUG = [
      { key: "resnet18_noaug", label: "ResNet-18, no aug.", slot: 0 },
      { key: "densenet121_noaug", label: "DenseNet-121, no aug.", slot: 1 }
    ];
    var W = 0, H = 0, S = 1, hoverEpoch = -1, showNoaug = false;
    var padL, padR, padT, padB, iw, ih, YMIN = 30, YMAX = 90, XMAX = 99;

    function xOf(e) { return padL + (e / XMAX) * iw; }
    function yOf(v) { return padT + ih * (1 - (v - YMIN) / (YMAX - YMIN)); }

    function render() {
      var ctx = canvas.getContext("2d"), pal = palette(),
        grid = css("--border", "#e4e4e0"), muted = css("--text-faint", "#86867e"),
        ink = css("--text", "#1a1a18"), surface = css("--bg-elev", "#fff");
      padL = 40 * S; padR = 118 * S; padT = 16 * S; padB = 30 * S;
      iw = W - padL - padR; ih = H - padT - padB;

      ctx.clearRect(0, 0, W, H);
      ctx.font = (10.5 * S) + "px " + css("--font-mono", "monospace");
      ctx.fillStyle = muted; ctx.strokeStyle = grid; ctx.lineWidth = 1 * S;
      for (var v = YMIN; v <= YMAX; v += 10) {
        ctx.beginPath(); ctx.moveTo(padL, yOf(v)); ctx.lineTo(W - padR, yOf(v)); ctx.stroke();
        ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v + "%", padL - 7 * S, yOf(v));
      }
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      [0, 25, 50, 75, 99].forEach(function (e) { ctx.fillText(String(e), xOf(e), H - padB + 8 * S); });
      ctx.fillText("epoch", padL + iw / 2, H - padB + 20 * S);

      var drawn = SERIES.slice();
      if (showNoaug) drawn = drawn.concat(NOAUG);

      drawn.forEach(function (s) {
        var acc = runs[s.key].acc; if (!acc) return;
        ctx.beginPath(); ctx.lineWidth = 2 * S; ctx.strokeStyle = pal[s.slot];
        ctx.setLineDash(s.key.indexOf("noaug") >= 0 ? [5 * S, 4 * S] : []);
        acc.forEach(function (v, e) { e ? ctx.lineTo(xOf(e), yOf(v)) : ctx.moveTo(xOf(e), yOf(v)); });
        ctx.stroke(); ctx.setLineDash([]);
      });

      // direct labels at the right end, nudged apart
      ctx.font = (11 * S) + "px " + css("--font-sans", "sans-serif");
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      var labels = drawn.map(function (s) {
        var acc = runs[s.key].acc, last = acc[acc.length - 1];
        return { s: s, y: yOf(last), x: xOf(acc.length - 1), text: s.label };
      }).sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14 * S) labels[i].y = labels[i - 1].y + 14 * S;
      labels.forEach(function (l) {
        ctx.fillStyle = pal[l.s.slot]; ctx.fillRect(l.x + 6 * S, l.y - 1.5 * S, 10 * S, 3 * S);
        ctx.fillStyle = ink; ctx.fillText(l.text, l.x + 20 * S, l.y);
      });

      // crosshair + markers at hovered epoch
      if (hoverEpoch >= 0) {
        var hx = xOf(hoverEpoch);
        ctx.strokeStyle = muted; ctx.lineWidth = 1 * S; ctx.setLineDash([3 * S, 3 * S]);
        ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, padT + ih); ctx.stroke(); ctx.setLineDash([]);
        drawn.forEach(function (s) {
          var acc = runs[s.key].acc; if (hoverEpoch >= acc.length) return;
          ctx.fillStyle = pal[s.slot]; ctx.strokeStyle = surface; ctx.lineWidth = 2 * S;
          ctx.beginPath(); ctx.arc(hx, yOf(acc[hoverEpoch]), 4.5 * S, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        });
        if (tip) {
          var rows = drawn.map(function (s) {
            var acc = runs[s.key].acc, v = acc[hoverEpoch];
            return v == null ? "" : '<div><i style="background:' + pal[s.slot] + '"></i>' + s.label + "<b>" + v.toFixed(2) + "%</b></div>";
          }).join("");
          tip.innerHTML = "<span>epoch " + hoverEpoch + "</span>" + rows;
          tip.hidden = false;
          var left = hx / S, flip = left > canvas.clientWidth * 0.6;
          tip.style.left = (flip ? left - 12 : left + 12) + "px";
          tip.style.transform = flip ? "translateX(-100%)" : "none";
          tip.style.top = (padT / S + 6) + "px";
        }
      } else if (tip) tip.hidden = true;
    }

    function hover(e) {
      var r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * S;
      if (x < padL || x > W - padR) { hoverEpoch = -1; render(); return; }
      hoverEpoch = Math.max(0, Math.min(XMAX, Math.round((x - padL) / iw * XMAX)));
      render();
    }
    canvas.addEventListener("mousemove", hover);
    canvas.addEventListener("mouseleave", function () { hoverEpoch = -1; render(); });
    if (noaug) noaug.addEventListener("change", function () { showNoaug = noaug.checked; render(); });

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth || 600, h = Math.round(Math.max(260, w * 0.46));
      canvas.style.height = h + "px"; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      W = canvas.width; H = canvas.height; S = dpr; render();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(root); else window.addEventListener("resize", resize);
    document.addEventListener("themechange", render);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
    resize();
  }

  /* ============================================================
     3. Static thumbnail for the project card: a 3-way decision map
     ============================================================ */
  function initStrip(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2),
      w = canvas.clientWidth || 480, h = Math.round(w * 9 / 16);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var W = canvas.width, H = canvas.height, S = dpr,
      ctx = canvas.getContext("2d"), pal = palette(), rnd = mulberry32(21),
      centers = [[-0.55, 0.1], [0.35, 0.45], [0.3, -0.5]], classes = [];
    centers.forEach(function (c) {
      var sup = []; for (var k = 0; k < 6; k++) sup.push([c[0] + 0.2 * gauss(rnd), c[1] + 0.2 * gauss(rnd)]);
      classes.push(sup);
    });
    var protos = classes.map(function (sup) {
      var sx = 0, sy = 0; sup.forEach(function (p) { sx += p[0]; sy += p[1]; }); return [sx / sup.length, sy / sup.length];
    });
    function toPx(p) { return [W / 2 + p[0] * (H / 2.1), H / 2 - p[1] * (H / 2.1)]; }
    function toUnit(x, y) { var s = H / 2.1; return [(x - W / 2) / s, (H / 2 - y) / s]; }
    function nearest(p) { var b = 0, bd = 1e9; protos.forEach(function (q, i) { var d = Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2); if (d < bd) { bd = d; b = i; } }); return b; }
    function hexA(hex, a) { return "rgba(" + parseInt(hex.slice(1, 3), 16) + "," + parseInt(hex.slice(3, 5), 16) + "," + parseInt(hex.slice(5, 7), 16) + "," + a + ")"; }

    ctx.fillStyle = css("--bg-sunken", "#f4f4f2"); ctx.fillRect(0, 0, W, H);
    var cell = Math.max(4, Math.round(5 * S));
    for (var y = 0; y < H; y += cell) for (var x = 0; x < W; x += cell) {
      ctx.fillStyle = hexA(pal[nearest(toUnit(x + cell / 2, y + cell / 2))], isDark() ? 0.18 : 0.12); ctx.fillRect(x, y, cell, cell);
    }
    var ring = css("--bg-elev", "#fff");
    classes.forEach(function (sup, ci) {
      sup.forEach(function (p) {
        var q = toPx(p); ctx.strokeStyle = ring; ctx.lineWidth = 2 * S; shape(ctx, ci, q[0], q[1], 6 * S); ctx.stroke();
        ctx.fillStyle = pal[ci]; shape(ctx, ci, q[0], q[1], 4.5 * S); ctx.fill();
      });
    });
    protos.forEach(function (p, ci) {
      var q = toPx(p); ctx.fillStyle = ring; ctx.strokeStyle = pal[ci]; ctx.lineWidth = 3 * S;
      shape(ctx, ci, q[0], q[1], 9 * S); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pal[ci]; shape(ctx, ci, q[0], q[1], 3.8 * S); ctx.fill();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-proto-lab]").forEach(initProto);
    document.querySelectorAll("[data-curves]").forEach(initCurves);
    document.querySelectorAll("[data-proto-strip]").forEach(initStrip);
    document.addEventListener("themechange", function () {
      document.querySelectorAll("[data-proto-strip]").forEach(initStrip);
    });
  });
})();
