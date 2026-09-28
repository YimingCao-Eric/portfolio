/* My Daily News — interactive figures.
   1. "What counts as new?" — one source's week, fetched every morning, under four
      reading windows, with or without a memory of what was already shown. Illustrative
      items; the rules are the product's (PRODUCT.md §4): a 7-day window decides what is
      looked at, a seen-store decides what is shown, and it compares reading days, not
      instants.
   2. The integrity line — how the page words a good day and a bad one.
   3. Home-page card thumbnail. */
(function () {
  "use strict";
  function t(en, zh) { return (window.I18N && window.I18N.t) ? window.I18N.t(en, zh) : en; }

  /* ---------- 1. the week ---------- */
  // Hours from Monday 00:00 local. `lag` is how long the source took to put the item in
  // its feed after the time it stamped on it — measured lags on real feeds reached ~15 h.
  var ITEMS = [
    { pub: -100, lag: 0.5, en: "Open-weights model card",        zh: "开源权重模型发布" },
    { pub: -60,  lag: 1,   en: "Engineering post on evals",      zh: "关于评测的工程博文" },
    { pub: 2,    lag: 0.2, en: "SDK release notes",              zh: "SDK 版本说明" },
    { pub: 5,    lag: 6,   en: "Pricing change (slow feed)",     zh: "价格调整（feed 滞后）" },
    { pub: 20,   lag: 1,   en: "Long-context research post",     zh: "长上下文研究博文" },
    { pub: 26,   lag: 15,  en: "Partnership news (slow feed)",   zh: "合作新闻（feed 滞后）" },
    { pub: 30,   lag: 0.5, en: "API changelog entry",            zh: "API changelog 条目" },
    { pub: 40,   lag: 0.3, en: "Essay by an independent writer", zh: "独立作者的文章" },
    { pub: 50,   lag: 0.2, en: "Agent framework release",        zh: "Agent 框架新版本" },
    { pub: 55,   lag: 3,   en: "Desktop app launch",             zh: "桌面应用发布" },
    { pub: 62,   lag: 1,   en: "Customer story",                 zh: "客户案例" },
    { pub: 70,   lag: 14,  en: "Policy update (slow feed)",      zh: "政策更新（feed 滞后）" },
    { pub: 80,   lag: 0.5, en: "Paper announcement",             zh: "论文发布" },
    { pub: 100,  lag: 2,   en: "Tutorial",                       zh: "教程" },
    { pub: 113,  lag: 0.5, en: "Friday-evening release",         zh: "周五晚间发布" }
  ];
  var DAY_START = 6;               // the reader's day starts at 06:00
  var MORNING = 7.5;               // one fetch each morning at 07:30
  var EVENING_WED = 48 + 19;       // optional second fetch, Wednesday 19:00
  var DAYS = 6;                    // Monday … Saturday
  var DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAY_NAMES_ZH = ["周一", "周二", "周三", "周四", "周五", "周六"];
  function dayName(d) { return t(DAY_NAMES_EN[d], DAY_NAMES_ZH[d]); }
  function readingDay(h) { return Math.floor((h - DAY_START) / 24); }

  function fetchTimes(evening) {
    var f = [];
    for (var d = 0; d < DAYS; d++) {
      f.push(d * 24 + MORNING);
      if (evening && d === 2) f.push(EVENING_WED);
    }
    return f;
  }

  // Lower bound on publication time for a fetch at `now`, given the previous fetch.
  function windowStart(rule, now, prev) {
    if (rule === "24h") return now - 24;
    if (rule === "last") return prev == null ? now - 24 : prev;
    if (rule === "yday") return (Math.floor(now / 24) - 1) * 24;   // calendar midnight, yesterday
    return now - 24 * 7;                                              // "7d"
  }

  function simulate(rule, memory, compare, evening) {
    var fetches = fetchTimes(evening);
    var firstSeen = {};           // item index -> { day, time }
    var pageOfDay = {};           // reading day -> the last capture of that day
    fetches.forEach(function (now, k) {
      var prev = k ? fetches[k - 1] : null;
      var from = windowStart(rule, now, prev);
      var day = readingDay(now);
      var capture = [];
      ITEMS.forEach(function (it, i) {
        var visible = it.pub + it.lag <= now;
        var inWindow = rule === "last" && prev != null ? it.pub > from : it.pub >= from;
        if (!visible || !inWindow) return;
        if (memory && firstSeen[i]) {
          var earlier = compare === "day" ? firstSeen[i].day < day : firstSeen[i].time < now;
          if (earlier) return;
        }
        capture.push(i);
      });
      capture.forEach(function (i) { if (!firstSeen[i]) firstSeen[i] = { day: day, time: now }; });
      pageOfDay[day] = capture;   // the page renders the last capture of the day
    });
    var shownOn = ITEMS.map(function () { return []; });
    Object.keys(pageOfDay).forEach(function (d) {
      pageOfDay[d].forEach(function (i) { shownOn[i].push(+d); });
    });
    var onPage = 0, never = 0, repeats = 0;
    shownOn.forEach(function (days) {
      if (days.length) onPage++; else never++;
      if (days.length > 1) repeats += days.length - 1;
    });
    return { fetches: fetches, shownOn: shownOn, onPage: onPage, never: never, repeats: repeats };
  }

  var SVGNS = "http://www.w3.org/2000/svg";
  function el(name, attrs, text) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function drawWeek(svg, sim) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = 760, labelW = 196, top = 34, rowH = 22, right = 64;
    var H = top + ITEMS.length * rowH + 14;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var h0 = -8, h1 = 24 * DAYS;                    // "earlier" is squeezed into the first slot
    var x0 = labelW + 26, x1 = W - right;
    function x(h) { return x0 + (Math.max(h, h0) - h0) / (h1 - h0) * (x1 - x0); }

    // day bands and fetch lines
    for (var d = 0; d < DAYS; d++) {
      var a = x(d * 24 + DAY_START), b = x(Math.min((d + 1) * 24 + DAY_START, h1));
      if (d % 2 === 0) svg.appendChild(el("rect", { x: a, y: top - 8, width: b - a, height: H - top, "class": "wk-band" }));
      svg.appendChild(el("text", { x: (a + b) / 2, y: 14, "class": "wk-day", "text-anchor": "middle" }, dayName(d)));
    }
    svg.appendChild(el("text", { x: labelW + 12, y: 14, "class": "wk-day", "text-anchor": "middle" }, t("earlier", "更早")));
    sim.fetches.forEach(function (f) {
      svg.appendChild(el("line", { x1: x(f), x2: x(f), y1: top - 10, y2: H - 6, "class": "wk-fetch" }));
      svg.appendChild(el("text", { x: x(f), y: 27, "class": "wk-fetch-lbl", "text-anchor": "middle" }, f % 24 === MORNING ? "07:30" : "19:00"));
    });
    svg.appendChild(el("text", { x: W - right / 2, y: 14, "class": "wk-day", "text-anchor": "middle" }, t("result", "结果")));

    ITEMS.forEach(function (it, i) {
      var y = top + i * rowH + rowH / 2;
      svg.appendChild(el("text", { x: labelW, y: y + 4, "class": "wk-label", "text-anchor": "end" }, t(it.en, it.zh)));
      var p = x(it.pub), v = x(it.pub + it.lag);
      if (it.pub < h0) {
        svg.appendChild(el("text", { x: labelW + 12, y: y + 4, "class": "wk-earlier", "text-anchor": "middle" }, "‹"));
      } else {
        if (it.lag >= 2) svg.appendChild(el("line", { x1: p, x2: v, y1: y, y2: y, "class": "wk-lag" }));
        svg.appendChild(el("circle", { cx: p, cy: y, r: 3.2, "class": "wk-pub" }));
      }
      var days = sim.shownOn[i];
      days.forEach(function (d, k) {
        // mark at the morning fetch of that reading day (or the evening one, if it replaced it)
        var fx = x(d * 24 + (d === 2 && sim.fetches.indexOf(EVENING_WED) >= 0 ? 19 : MORNING));
        svg.appendChild(el("rect", { x: fx - 5, y: y - 5, width: 10, height: 10, rx: 2, "class": k === 0 ? "wk-shown" : "wk-repeat" }));
      });
      var cls = days.length === 0 ? "wk-res wk-res--lost" : days.length > 1 ? "wk-res wk-res--rep" : "wk-res wk-res--ok";
      var txt = days.length === 0 ? t("never shown", "从未显示") : days.length > 1 ? t("shown ×" + days.length, "显示 " + days.length + " 次") : t("shown once", "显示一次");
      svg.appendChild(el("text", { x: W - right / 2, y: y + 4, "class": cls, "text-anchor": "middle" }, txt));
    });
  }

  var RULE_NOTE = {
    "24h":  ["Only items stamped in the 24 hours before the fetch. A source that posts late never catches up.",
             "只看 fetch 前 24 小时内打上时间戳的条目。发布晚的信息源永远追不上。"],
    "last": ["Only items stamped since the previous fetch. Anything the feed showed late is behind the line forever.",
             "只看上次 fetch 之后打上时间戳的条目。feed 延迟显示的条目永远落在线后面。"],
    "yday": ["A wider window catches some late items — and, without a memory, shows the overlap twice.",
             "更宽的窗口能接住部分延迟条目 —— 但没有记忆时，重叠部分会显示两次。"],
    "7d":   ["The product's rule: look back seven days, and let a memory of what was already shown decide what is new.",
             "产品采用的规则：回看七天，由「已显示过」的记忆决定什么是新的。"]
  };

  function initWeek(root) {
    var svg = root.querySelector("[data-wk-svg]");
    var readout = root.querySelector("[data-wk-readout]");
    var note = root.querySelector("[data-wk-note]");
    var memBox = root.querySelector("[data-wk-memory]");
    var eveBox = root.querySelector("[data-wk-evening]");
    var cmpRow = root.querySelector("[data-wk-compare-row]");
    function val(name) { var c = root.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : null; }
    function render() {
      var rule = val("wk-rule"), cmp = val("wk-compare");
      var memory = memBox.checked, evening = eveBox.checked;
      cmpRow.classList.toggle("is-disabled", !memory);
      var sim = simulate(rule, memory, cmp, evening);
      drawWeek(svg, sim);
      readout.innerHTML =
        "<div><span>" + t("On a page", "出现在页面上") + "</span><b>" + sim.onPage + " / " + ITEMS.length + "</b></div>" +
        "<div><span>" + t("Never shown", "从未显示") + "</span><b class=\"" + (sim.never ? "is-bad" : "") + "\">" + sim.never + "</b></div>" +
        "<div><span>" + t("Shown again on a later day", "在之后某天重复显示") + "</span><b class=\"" + (sim.repeats ? "is-warn" : "") + "\">" + sim.repeats + "</b></div>";
      var n = RULE_NOTE[rule], extra = "";
      if (memory && evening && cmp === "moment") {
        extra = " " + t("Comparing exact moments, Wednesday evening's fetch suppresses everything the morning found — and the page shows the last fetch of the day, so those items vanish.",
                        "按精确时刻比较时，周三晚上的 fetch 会把早上抓到的全部压掉 —— 而页面显示的是当天最后一次 fetch，于是这些条目消失了。");
      } else if (memory && evening) {
        extra = " " + t("Comparing reading days, a second fetch the same day keeps the morning's items and adds what arrived since.",
                        "按阅读日比较时，同一天的第二次 fetch 保留早上的条目，并加上之后新到的。");
      } else if (!memory && rule === "7d") {
        extra = " " + t("Without the memory, a seven-day window repeats every item for a week.",
                        "没有记忆时，七天窗口会把每个条目连续显示一周。");
      }
      note.textContent = t(n[0], n[1]) + extra;
    }
    root.addEventListener("change", render);
    render();
  }

  /* ---------- 2. the integrity line ---------- */
  var NAMES = ["Cohere blog", "Mistral news", "DeepSeek news", "Ai2 blog", "EleutherAI blog", "Qwen blog", "Apple ML research", "BAIR blog", "Ollama blog"];
  function initIntegrity(root) {
    var line = root.querySelector("[data-il-line]");
    var verdict = root.querySelector("[data-il-verdict]");
    var news = root.querySelector("[data-il-news]");
    var inputs = root.querySelectorAll("input[type=range]");
    function v(name) { return +root.querySelector('[data-il="' + name + '"]').value; }
    function render() {
      inputs.forEach(function (i) { var o = root.querySelector('[data-il-out="' + i.dataset.il + '"]'); if (o) o.textContent = i.value; });
      var configured = 48, disabled = v("disabled"), failed = v("failed"), timedout = v("timedout"), zero = v("zero"), undated = v("undated");
      var enabled = configured - disabled, broken = failed + timedout + zero, read = enabled - broken;
      var tail = [];
      if (disabled) tail.push(t(disabled + " disabled", disabled + " 个已停用"));
      if (undated) tail.push(t(undated + " undated skipped", undated + " 条无日期已跳过"));
      var k = 0, missing = [];
      function take(n, why) { for (var j = 0; j < n; j++) missing.push(NAMES[k++ % NAMES.length] + " — " + why); }
      take(failed, t("failed", "失败"));
      take(timedout, t("timed out", "超时"));
      take(zero, t("parsed nothing", "解析出 0 条"));
      var head = broken ? "⚠ " + t(read + " of " + enabled + " sources read", enabled + " 个信息源中读取了 " + read + " 个")
                        : "✓ " + t(read + " of " + enabled + " sources read", enabled + " 个信息源中读取了 " + read + " 个");
      line.textContent = head + (tail.length ? " · " + tail.join(" · ") : "") + (missing.length ? " · " + t("missing: ", "缺失：") + missing.join("; ") : "");
      line.className = "il-line " + (broken ? "il-line--bad" : "il-line--ok");
      var n = +news.value;
      root.querySelector('[data-il-out="news"]').textContent = n;
      if (!broken && n <= 3) {
        verdict.textContent = t("A quiet day: every source answered and there was little new. The small page is the world, not the product.",
                                "安静的一天：每个信息源都回应了，只是新东西少。页面小是因为世界安静，不是产品出错。");
      } else if (broken && n <= 3) {
        verdict.textContent = t("Same small page, different day: some sources never answered, and the line says which. Without it the two days would look identical.",
                                "同样小的页面，却是不同的一天：有些信息源没有回应，这一行会点名是哪些。没有它，这两天看起来一模一样。");
      } else if (broken) {
        verdict.textContent = t("A full page can still be incomplete — the line is how you find out.",
                                "页面很满也可能不完整 —— 这一行就是你发现它的方式。");
      } else {
        verdict.textContent = t("A good day looks like this every morning, which is why a bad one stands out.",
                                "好日子每天早上都长这样，所以坏日子一眼就能看出来。");
      }
    }
    root.addEventListener("input", render);
    render();
  }

  /* ---------- 3. card thumbnail ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawStrip(canvas) {
    var W = 640, H = 360;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    var cs = getComputedStyle(document.documentElement);
    var bg = cs.getPropertyValue("--bg-sunken").trim() || "#f4f4f2";
    var elev = cs.getPropertyValue("--bg-elev").trim() || "#fff";
    var accent = cs.getPropertyValue("--accent").trim() || "#2f5d50";
    var border = cs.getPropertyValue("--border-strong").trim() || "#d2d2cc";
    var faint = cs.getPropertyValue("--text-faint").trim() || "#86867e";
    var text = cs.getPropertyValue("--text").trim() || "#1a1a18";
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    var x0 = 40;
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillStyle = text; ctx.font = "650 30px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(t("Monday, September 28", "9 月 28 日 周一"), x0, 54);
    ctx.fillStyle = accent; ctx.font = "500 18px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(t("✓ 47 of 47 sources read · 1 disabled", "✓ 47 个信息源中读取了 47 个 · 1 个已停用"), x0, 96);
    var tabs = [t("News", "新闻"), t("Trending", "热榜"), t("Others", "其他")], tx = x0;
    ctx.font = "650 20px ui-sans-serif, system-ui, sans-serif";
    tabs.forEach(function (s, i) {
      ctx.fillStyle = i === 0 ? text : faint; ctx.fillText(s, tx, 142);
      var w = ctx.measureText(s).width;
      if (i === 0) { ctx.fillStyle = text; ctx.fillRect(tx, 158, w, 3); }
      tx += w + 30;
    });
    ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, 166); ctx.lineTo(W - x0, 166); ctx.stroke();
    var cats = [t("Products", "产品"), t("Models", "模型"), t("Tools", "工具"), t("Business", "商业"), t("Writing", "文章"), t("Research", "研究")];
    var px = x0; ctx.font = "550 16px ui-sans-serif, system-ui, sans-serif";
    cats.forEach(function (s, i) {
      var w = ctx.measureText(s).width + 24;
      if (px + w > W - x0) return;
      ctx.fillStyle = i === 0 ? text : elev; ctx.strokeStyle = i === 0 ? text : border;
      roundRect(ctx, px, 184, w, 34, 17); ctx.fill(); ctx.stroke();
      ctx.fillStyle = i === 0 ? elev : faint; ctx.fillText(s, px + 12, 201);
      px += w + 8;
    });
    for (var r = 0; r < 2; r++) {
      var y = 250 + r * 54;
      ctx.fillStyle = text; ctx.globalAlpha = 0.85; roundRect(ctx, x0, y, 330 - r * 60, 12, 5); ctx.fill();
      ctx.globalAlpha = 0.28; roundRect(ctx, x0, y + 22, 470 - r * 40, 9, 4); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = border; roundRect(ctx, W - x0 - 70, y - 2, 70, 30, 6); ctx.stroke();
      ctx.fillStyle = faint; ctx.font = "500 15px ui-sans-serif, system-ui, sans-serif"; ctx.fillText(t("☆ save", "☆ 收藏"), W - x0 - 60, y + 13);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-week-lab]").forEach(initWeek);
    document.querySelectorAll("[data-integrity-lab]").forEach(initIntegrity);
    var strips = document.querySelectorAll("[data-digest-strip]");
    strips.forEach(drawStrip);
    document.addEventListener("themechange", function () { strips.forEach(drawStrip); });
  });
  // exposed for a headless check of the rules; nothing on the page uses it
  window.__mdnSimulate = simulate;
})();
