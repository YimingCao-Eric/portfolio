/* ============================================================
   Interactive forward-diffusion lab.

   Everything below is a direct implementation of the closed-form
   result derived in the report (eq. 10):

       q(x_t | x_0) = N( x_t ; sqrt(a_bar_t) x_0 , (1 - a_bar_t) I )
   =>  x_t = sqrt(a_bar_t) * x_0 + sqrt(1 - a_bar_t) * eps,  eps ~ N(0, I)

   Two beta schedules are supported:
     linear  — Ho et al. 2020, beta_t linear from 1e-4 to 0.02
     cosine  — Nichol & Dhariwal 2021, a_bar_t = cos^2( ((t/T)+s)/(1+s) * pi/2 )
   ============================================================ */
(function () {
  "use strict";

  var T = 1000;

  /* ---------- schedules ---------- */

  function linearSchedule(T) {
    var betas = new Float64Array(T),
      alphaBar = new Float64Array(T + 1),
      b0 = 1e-4,
      b1 = 0.02,
      running = 1;
    alphaBar[0] = 1;
    for (var t = 0; t < T; t++) {
      betas[t] = b0 + (b1 - b0) * (t / (T - 1));
      running *= 1 - betas[t];
      alphaBar[t + 1] = running;
    }
    return { betas: betas, alphaBar: alphaBar };
  }

  function cosineSchedule(T) {
    // Nichol & Dhariwal (2021), offset s = 0.008
    var s = 0.008,
      ab = new Float64Array(T + 1),
      betas = new Float64Array(T),
      f0 = Math.pow(Math.cos((s / (1 + s)) * Math.PI * 0.5), 2);
    for (var t = 0; t <= T; t++) {
      ab[t] = Math.pow(Math.cos((t / T + s) / (1 + s) * Math.PI * 0.5), 2) / f0;
    }
    for (var i = 0; i < T; i++) {
      betas[i] = Math.min(Math.max(1 - ab[i + 1] / ab[i], 1e-4), 0.999);
    }
    return { betas: betas, alphaBar: ab };
  }

  var SCHEDULES = { linear: linearSchedule(T), cosine: cosineSchedule(T) };

  /* ---------- deterministic gaussian noise ---------- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussians(n, seed) {
    var rnd = mulberry32(seed), out = new Float64Array(n);
    for (var i = 0; i < n; i += 2) {
      var u = Math.max(rnd(), 1e-12), v = rnd();
      var r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * v;
      out[i] = r * Math.cos(th);
      if (i + 1 < n) out[i + 1] = r * Math.sin(th);
    }
    return out;
  }

  /* ---------- source image, drawn procedurally (no external assets) ---------- */

  var IMG_N = 112;

  function buildSourceImage() {
    var c = document.createElement("canvas");
    c.width = c.height = IMG_N;
    var g = c.getContext("2d"), N = IMG_N;

    var sky = g.createLinearGradient(0, 0, 0, N * 0.62);
    sky.addColorStop(0, "#1c3b63");
    sky.addColorStop(0.55, "#4a7ba8");
    sky.addColorStop(1, "#e8a765");
    g.fillStyle = sky; g.fillRect(0, 0, N, N);

    g.fillStyle = "#ffd9a0";
    g.beginPath(); g.arc(N * 0.70, N * 0.30, N * 0.085, 0, 6.284); g.fill();

    g.fillStyle = "#2c4c66";
    g.beginPath();
    g.moveTo(0, N * 0.62); g.lineTo(N * 0.26, N * 0.30);
    g.lineTo(N * 0.50, N * 0.62); g.closePath(); g.fill();

    g.fillStyle = "#1d3547";
    g.beginPath();
    g.moveTo(N * 0.34, N * 0.62); g.lineTo(N * 0.62, N * 0.24);
    g.lineTo(N * 0.95, N * 0.62); g.closePath(); g.fill();

    g.fillStyle = "#f2f5f7";
    g.beginPath();
    g.moveTo(N * 0.548, N * 0.325); g.lineTo(N * 0.62, N * 0.24);
    g.lineTo(N * 0.695, N * 0.325); g.lineTo(N * 0.645, N * 0.30);
    g.lineTo(N * 0.60, N * 0.345); g.lineTo(N * 0.572, N * 0.305);
    g.closePath(); g.fill();

    var water = g.createLinearGradient(0, N * 0.62, 0, N);
    water.addColorStop(0, "#2a5570");
    water.addColorStop(1, "#12283a");
    g.fillStyle = water; g.fillRect(0, N * 0.62, N, N * 0.38);

    g.globalAlpha = 0.22; g.fillStyle = "#ffd9a0";
    for (var i = 0; i < 9; i++) {
      var y = N * (0.65 + i * 0.036), w = N * (0.05 + (i % 3) * 0.035);
      g.fillRect(N * 0.70 - w / 2, y, w, Math.max(1, N * 0.012));
    }
    g.globalAlpha = 1;

    return g.getImageData(0, 0, N, N);
  }

  /* ---------- 2-D dataset: eight Gaussians on a ring ----------
     A standard toy distribution for generative models. Multi-modal, and
     the modes stay legible long enough to watch them merge. Scaled to
     roughly unit variance, the way a real pipeline standardises data. */

  function buildPoints(n) {
    var pts = new Float64Array(n * 2), rnd = mulberry32(99),
      MODES = 8, R = 1.55, SD = 0.11;
    for (var i = 0; i < n; i++) {
      var th = (i % MODES) / MODES * 2 * Math.PI,
        u = Math.max(rnd(), 1e-12), v = rnd(),
        rad = Math.sqrt(-2 * Math.log(u)), ang = 2 * Math.PI * v;
      pts[i * 2]     = R * Math.cos(th) + SD * rad * Math.cos(ang);
      pts[i * 2 + 1] = R * Math.sin(th) + SD * rad * Math.sin(ang);
    }
    return pts;
  }

  /* ---------- theme-aware colours ---------- */

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ---------- the lab ---------- */

  function initLab(root) {
    var imgCanvas = root.querySelector("[data-lab-image]"),
      ptsCanvas = root.querySelector("[data-lab-points]"),
      chart = root.querySelector("[data-lab-chart]"),
      slider = root.querySelector("[data-lab-slider]"),
      playBtn = root.querySelector("[data-lab-play]"),
      schedRadios = root.querySelectorAll("[name='lab-schedule']"),
      outT = root.querySelector("[data-out-t]"),
      outAb = root.querySelector("[data-out-abar]"),
      outSig = root.querySelector("[data-out-signal]"),
      outNoi = root.querySelector("[data-out-noise]");

    if (!imgCanvas || !slider) return;

    var src = buildSourceImage(),
      imgNoise = gaussians(IMG_N * IMG_N * 3, 1337),
      NPTS = 900,
      pts = buildPoints(NPTS),
      ptNoise = gaussians(NPTS * 2, 4242),
      state = { t: 0, sched: "cosine", playing: false, dir: 1 };

    /* --- image panel --- */
    var ictx = imgCanvas.getContext("2d"),
      work = ictx.createImageData(IMG_N, IMG_N);

    function drawImage(t) {
      var ab = SCHEDULES[state.sched].alphaBar[t],
        a = Math.sqrt(ab),
        b = Math.sqrt(1 - ab),
        s = src.data, d = work.data, k = 0;
      for (var i = 0; i < s.length; i += 4) {
        for (var c = 0; c < 3; c++) {
          var x0 = (s[i + c] / 255) * 2 - 1;             // -> [-1, 1]
          var xt = a * x0 + b * imgNoise[k++];           // forward process
          d[i + c] = Math.max(0, Math.min(255, ((xt + 1) / 2) * 255));
        }
        d[i + 3] = 255;
      }
      var off = document.createElement("canvas");
      off.width = off.height = IMG_N;
      off.getContext("2d").putImageData(work, 0, 0);
      ictx.imageSmoothingEnabled = false;
      ictx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
      ictx.drawImage(off, 0, 0, imgCanvas.width, imgCanvas.height);
    }

    /* --- point-cloud panel --- */
    function drawPoints(t) {
      var ctx = ptsCanvas.getContext("2d"),
        W = ptsCanvas.width, H = ptsCanvas.height,
        ab = SCHEDULES[state.sched].alphaBar[t],
        a = Math.sqrt(ab), b = Math.sqrt(1 - ab),
        SP = W / (ptsCanvas.clientWidth || W),
        cx = W / 2, cy = H / 2, sc = Math.min(W, H) / 6.4;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = css("--bg-sunken", "#f4f4f2");
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = css("--border", "#e4e4e0");
      ctx.lineWidth = 1 * SP;
      ctx.beginPath();
      ctx.moveTo(0, cy); ctx.lineTo(W, cy);
      ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
      ctx.stroke();

      var accent = css("--accent", "#2f5d50");
      for (var i = 0; i < NPTS; i++) {
        var x = a * pts[i * 2] + b * ptNoise[i * 2],
          y = a * pts[i * 2 + 1] + b * ptNoise[i * 2 + 1];
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(cx + x * sc, cy - y * sc, 1.7 * SP, 0, 6.284);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* --- schedule chart --- */
    function drawChart(t) {
      var ctx = chart.getContext("2d"),
        W = chart.width, H = chart.height,
        S = W / (chart.clientWidth || W),
        padL = 34 * S, padR = 12 * S, padT = 14 * S, padB = 26 * S,
        iw = W - padL - padR, ih = H - padT - padB;

      ctx.clearRect(0, 0, W, H);

      var border = css("--border", "#e4e4e0"),
        faint = css("--text-faint", "#86867e"),
        accent = css("--accent", "#2f5d50"),
        soft = css("--text-soft", "#55554f");

      ctx.strokeStyle = border; ctx.lineWidth = 1 * S;
      ctx.font = (10 * S) + "px " + css("--font-mono", "monospace");
      ctx.fillStyle = faint;
      [0, 0.5, 1].forEach(function (v) {
        var y = padT + ih * (1 - v);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(v.toFixed(1), padL - 6 * S, y);
      });
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("0", padL, H - padB + 6 * S);
      ctx.fillText("t", padL + iw / 2, H - padB + 6 * S);
      ctx.fillText(String(T), W - padR, H - padB + 6 * S);

      function curve(get, color, dash, width) {
        ctx.beginPath();
        ctx.setLineDash((dash || []).map(function (d) { return d * S; }));
        ctx.strokeStyle = color; ctx.lineWidth = (width || 1.75) * S;
        for (var i = 0; i <= T; i += 4) {
          var x = padL + (i / T) * iw, y = padT + ih * (1 - get(i));
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke(); ctx.setLineDash([]);
      }

      var other = state.sched === "cosine" ? "linear" : "cosine";
      curve(function (i) { return SCHEDULES[other].alphaBar[i]; },
        color_mix(faint, 0.45), [3, 4], 1.25);
      curve(function (i) { return SCHEDULES[state.sched].alphaBar[i]; }, accent);
      // noise coefficient sqrt(1 - alpha_bar): the weight on epsilon
      curve(function (i) {
        return Math.sqrt(1 - SCHEDULES[state.sched].alphaBar[i]);
      }, soft, [2, 3], 1.4);

      var mx = padL + (t / T) * iw;
      ctx.strokeStyle = accent; ctx.lineWidth = 1 * S; ctx.setLineDash([2 * S, 3 * S]);
      ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, padT + ih); ctx.stroke();
      ctx.setLineDash([]);
      var ab = SCHEDULES[state.sched].alphaBar[t];
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(mx, padT + ih * (1 - ab), 3.5 * S, 0, 6.284); ctx.fill();
    }

    function color_mix(c, alpha) {
      // faint colours come back as hex or rgb(); just fall back to a grey
      return "rgba(128,128,128," + alpha + ")";
    }

    function render() {
      var t = state.t,
        ab = SCHEDULES[state.sched].alphaBar[t];
      drawImage(t); drawPoints(t); drawChart(t);
      if (outT) outT.textContent = t;
      if (outAb) outAb.textContent = ab.toFixed(4);
      if (outSig) outSig.textContent = Math.sqrt(ab).toFixed(3);
      if (outNoi) outNoi.textContent = Math.sqrt(1 - ab).toFixed(3);
    }

    /* --- sizing --- */
    function fit(canvas, ratio) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2),
        w = canvas.clientWidth || 320,
        h = Math.round(w * ratio);
      canvas.style.height = h + "px";
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // every draw routine works in device pixels via canvas.width/height,
      // so no context scaling is applied here.
      return { w: canvas.width, h: canvas.height };
    }

    function resize() {
      fit(imgCanvas, 1);
      fit(ptsCanvas, 1);
      fit(chart, 1);
      render();
    }

    /* --- events --- */
    slider.addEventListener("input", function () {
      state.t = +slider.value;
      state.playing = false;
      if (playBtn) playBtn.dataset.state = "paused";
      render();
    });

    Array.prototype.forEach.call(schedRadios, function (r) {
      r.addEventListener("change", function () {
        if (r.checked) { state.sched = r.value; render(); }
      });
    });

    if (playBtn) {
      playBtn.addEventListener("click", function () {
        state.playing = !state.playing;
        playBtn.dataset.state = state.playing ? "playing" : "paused";
        playBtn.setAttribute("aria-label", state.playing ? "Pause" : "Play");
        if (state.playing) loop();
      });
    }

    var last = 0;
    function loop(ts) {
      if (!state.playing) return;
      if (!last) last = ts || 0;
      var dt = Math.min(((ts || 0) - last) / 1000, 0.05);
      last = ts || 0;
      state.t += state.dir * dt * 420;
      if (state.t >= T) { state.t = T; state.dir = -1; }
      if (state.t <= 0) { state.t = 0; state.dir = 1; }
      slider.value = Math.round(state.t);
      state.t = Math.round(state.t);
      render();
      requestAnimationFrame(loop);
    }

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(root); else window.addEventListener("resize", resize);

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
    document.addEventListener("themechange", render);

    resize();
  }

  /* ---------- small static strip, used as the project thumbnail ---------- */

  function initStrip(canvas) {
    var steps = [0, 200, 400, 650, 1000],
      src = buildSourceImage(),
      noise = gaussians(IMG_N * IMG_N * 3, 7),
      dpr = Math.min(window.devicePixelRatio || 1, 2),
      W = canvas.clientWidth || 480,
      H = Math.round(W * 9 / 16);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = css("--bg-sunken", "#f4f4f2");
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var gap = canvas.width * 0.012,
      cell = (canvas.width - gap * (steps.length + 1)) / steps.length,
      top = (canvas.height - cell) / 2,
      off = document.createElement("canvas");
    off.width = off.height = IMG_N;
    var octx = off.getContext("2d"), buf = octx.createImageData(IMG_N, IMG_N);

    steps.forEach(function (t, idx) {
      var ab = SCHEDULES.cosine.alphaBar[t],
        a = Math.sqrt(ab), b = Math.sqrt(1 - ab),
        s = src.data, d = buf.data, k = 0;
      for (var i = 0; i < s.length; i += 4) {
        for (var c = 0; c < 3; c++) {
          var x0 = (s[i + c] / 255) * 2 - 1;
          var xt = a * x0 + b * noise[k++];
          d[i + c] = Math.max(0, Math.min(255, ((xt + 1) / 2) * 255));
        }
        d[i + 3] = 255;
      }
      octx.putImageData(buf, 0, 0);
      ctx.drawImage(off, gap + idx * (cell + gap), top, cell, cell);
    });
  }

  /* ---------- boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-diffusion-lab]").forEach(initLab);
    document.querySelectorAll("[data-diffusion-strip]").forEach(initStrip);
  });
})();
