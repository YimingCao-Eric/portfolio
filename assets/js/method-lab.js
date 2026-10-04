/* Method page: Figure A (phase map) and Figure B (Phase 2.5 simulator).
   The simulator implements the stage rules as the method states them; the
   My Daily News preset replays that project's first ten days of Phase 2.5. */
(function () {
  "use strict";

  var T = function (en, zh) { return window.I18N ? window.I18N.t(en, zh) : en; };
  var ZH = function () { return window.I18N && window.I18N.lang === "zh"; };

  /* ===================== Figure A: phase map ===================== */
  function initPhaseMap(root) {
    var tabs = root.querySelectorAll("[data-pm-tab]");
    var panels = root.querySelectorAll("[data-pm-panel]");
    root.classList.add("is-js");
    function select(key, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-pm-tab") === key;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.setAttribute("tabindex", on ? "0" : "-1");
        if (on && focus) t.focus();
      });
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-pm-panel") !== key; });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t.getAttribute("data-pm-tab")); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = tabs[(i + d + tabs.length) % tabs.length];
        select(n.getAttribute("data-pm-tab"), true);
      });
    });
    var start = root.querySelector("[data-pm-tab].is-active") || tabs[0];
    select(start.getAttribute("data-pm-tab"));
  }

  /* ===================== Figure B: Phase 2.5 simulator ===================== */
  /* Day types:
     q = read, nothing from use needs a code change, nothing lands
     f = read, a finding from use; fixed (code lands) that evening
     c = read, nothing from use; code lands that evening anyway (a queued fix, or one a test found)
     n = no reading, nothing lands */
  var CYCLE = ["q", "f", "c", "n"];

  var MDN = {
    start: [2026, 8, 24],
    days: ["f", "f", "q", "c", "q", "q", "q", "q", "n", "q"],
    notes: [
      ["First morning of real use: ten findings — a misleading date header, broken titles, no sign of progress during a long fetch, rankings mixed into the news. Fixed the same day.",
       "第一次真实使用：十个发现 —— 日期标题有误导、标题损坏、长时间抓取时看不到进度、排行榜混进了新闻。当天修复。"],
      ["The rankings had become most of the page. A source survey added 36 sources the same day, bringing the total to 48.",
       "排行榜占据了页面的大部分。当天做了一次信息源调研，新增 36 个源，总数达到 48 个。"],
      ["A Saturday: one news item, everything else correctly held back as already shown. Nothing to change.",
       "周六：一条新闻，其余都按规则作为“已展示”被正确拦下。无需改动。"],
      ["Nothing from use to change. The queued fixes land in the evening, by decision, so that the measured mornings can start on Monday — the case the provisional rule was written for.",
       "使用中没有需要改动的地方。按决定，积压的修复在当晚合入，以便测量从周一开始 —— 临时第 1 个早晨这条规则正是为此而写。"],
      ["Read on the frozen build: 47 of 47 sources, 25 news items, nothing to change. The morning stands.",
       "在冻结版本上阅读：47/47 个源，25 条新闻，无需改动。这个早晨成立。"],
      ["Frozen build, 23 items, “nothing wrong”.", "冻结版本，23 条，“没有问题”。"],
      ["Frozen build, 23 items; nothing to change.", "冻结版本，23 条；无需改动。"],
      ["Frozen build, 16 items; nothing to change.", "冻结版本，16 条；无需改动。"],
      ["No fetch that day, so the gap costs a day and nothing else.",
       "这一天没有抓取，所以空缺只耽误一天，没有别的代价。"],
      ["Fetched on the frozen build; the fifth morning once its reading is confirmed.",
       "在冻结版本上抓取；阅读确认后即为第五个早晨。"]
    ]
  };

  function dayLabel(d, idx, preset, short) {
    if (preset !== "mdn") return short ? T("Day " + (idx + 1), (idx + 1) + " 天") : T("Day " + (idx + 1), "第 " + (idx + 1) + " 天");
    var wdEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    var wdZh = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
    var mEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    if (short) return ZH() ? (d.getMonth() + 1) + "/" + d.getDate() : wdEn + " " + d.getDate();
    return ZH() ? (d.getMonth() + 1) + "/" + d.getDate() + " " + wdZh : wdEn + " " + d.getDate() + " " + mEn;
  }

  function typeText(t) {
    return {
      q: T("read · nothing to change", "已读 · 无需改动"),
      f: T("read · finding → fixed that evening", "已读 · 有发现 → 当晚修复"),
      c: T("read · code landed anyway", "已读 · 仍有代码合入"),
      n: T("no reading", "未阅读")
    }[t];
  }

  /* The rules. Returns one verdict per day plus a summary. */
  function simulate(days, provisional, need) {
    var state = "s1", count = 0, restarts = 0, afterChange = false;
    var entered = null, morning1 = null, done = null;
    var out = days.map(function (t, i) {
      var v = { kind: "", badge: "", text: "" };
      var changed = (t === "f" || t === "c");
      if (state === "done") {
        v.kind = "after"; v.badge = "";
        v.text = T("After stabilisation: the verdicts are reported and SPEC.md is written from what the prototype showed.",
                   "稳定期之后：报告各项结论，并依据原型的实际表现撰写 SPEC.md。");
      } else if (t === "n") {
        v.kind = "none"; v.badge = "·";
        v.text = state === "s2"
          ? T("No reading. The count waits — measured mornings need not be consecutive.", "未阅读。计数暂停 —— 测量的早晨不要求连续。")
          : T("No reading.", "未阅读。");
      } else if (state === "s1") {
        if (t === "f") {
          v.kind = "s1"; v.badge = T("S1", "阶1");
          v.text = T("Stage 1 · a finding from use, resolved the same day.", "阶段 1 · 使用中出现发现，当天解决。");
        } else if (t === "q") {
          v.kind = "entry"; v.badge = T("S1 ✓", "阶1 ✓");
          v.text = T("Stage 1 · nothing from use needs a change, and nothing lands after it — the day qualifies. Stage 2 counts from the next reading.",
                     "阶段 1 · 使用中没有需要改代码的发现，之后也没有代码合入 —— 这一天达标。阶段 2 从下一次阅读开始计数。");
          state = "s2"; entered = entered == null ? i : entered;
        } else if (provisional) {
          v.kind = "entry"; v.badge = T("S1 →", "阶1 →");
          v.text = T("Stage 1 · nothing from use; code lands this evening. Under the provisional rule, the next reading is a provisional morning 1.",
                     "阶段 1 · 使用中没有发现；当晚有代码合入。按临时规则，下一次阅读即为临时的第 1 个早晨。");
          state = "s2"; entered = entered == null ? i : entered;
        } else {
          v.kind = "s1"; v.badge = T("S1", "阶1");
          v.text = T("Stage 1 · nothing from use, but code landed after it — the day does not qualify.",
                     "阶段 1 · 使用中没有发现，但之后有代码合入 —— 这一天不达标。");
        }
      } else { /* s2 */
        var n = count + 1;
        if (!changed) {
          count = n; v.kind = "morning"; v.badge = T("M" + n, "第" + n);
          v.text = T("Measured morning " + n, "测量第 " + n + " 个早晨") +
            (afterChange && n === 1 ? T(" — provisional, the first reading after the last change; nothing needs fixing, so it stands.",
                                        " —— 临时的：最后一次改动后的首次阅读；没有需要修复的，因此成立。") : T(".", "。"));
          if (morning1 == null || n === 1) morning1 = i;
          if (count >= need) {
            v.kind = "done"; v.badge = T("M" + n + " ✓", "第" + n + " ✓");
            v.text += T(" Stabilisation complete: " + need + " measured mornings on unchanged code.",
                        " 稳定期完成：在未改动的代码上测量了 " + need + " 个早晨。");
            state = "done"; done = i;
          }
        } else {
          restarts++; count = 0; v.kind = "restart"; v.badge = "↺";
          v.text = (t === "f"
            ? T("A finding from use. ", "使用中出现发现。")
            : T("Code landed after it. ", "之后有代码合入。")) +
            T("This morning cannot stand; any code change restarts the count. ", "这个早晨不能成立；任何代码改动都会让计数重来。") +
            (provisional
              ? T("The fix lands tonight and tomorrow's reading is a provisional morning 1.", "修复当晚合入，明天的阅读即为临时的第 1 个早晨。")
              : T("Back to stage 1: a qualifying day is needed before counting again.", "回到阶段 1：需要先有一个达标的日子，才能重新计数。"));
          if (!provisional) state = "s1";
        }
      }
      afterChange = changed;
      return v;
    });
    return { days: out, entered: entered, done: done, restarts: restarts, count: state === "done" ? need : count };
  }
  window.__methodSimulate = simulate;

  function initSim(root) {
    var strip = root.querySelector("[data-sim-strip]");
    var readout = root.querySelector("[data-sim-readout]");
    var log = root.querySelector("[data-sim-log]");
    var provBox = root.querySelector("[data-sim-prov]");
    var preset = "mdn", need = 5, days = MDN.days.slice();

    function dates() {
      var s = MDN.start;
      return days.map(function (_, i) { return new Date(s[0], s[1], s[2] + i); });
    }

    function render() {
      var r = simulate(days, provBox.checked, need);
      var ds = dates();
      strip.innerHTML = "";
      log.innerHTML = "";
      days.forEach(function (t, i) {
        var v = r.days[i];
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "sim-day sim-day--" + v.kind;
        cell.setAttribute("aria-label", dayLabel(ds[i], i, preset) + ": " + typeText(t) + ". " + v.text + " " + T("Click to change the day.", "点击可更改这一天。"));
        cell.innerHTML =
          '<span class="sim-day__date">' + dayLabel(ds[i], i, preset, true) + "</span>" +
          '<span class="sim-ico sim-ico--' + t + '" aria-hidden="true"></span>' +
          '<span class="sim-day__badge">' + (v.badge || "&nbsp;") + "</span>";
        cell.addEventListener("click", function () {
          days[i] = CYCLE[(CYCLE.indexOf(days[i]) + 1) % CYCLE.length];
          render();
        });
        strip.appendChild(cell);

        var row = document.createElement("li");
        row.className = "sim-log__row sim-log__row--" + v.kind;
        var note = (preset === "mdn" && MDN.days[i] === t) ? MDN.notes[i] : null;
        row.innerHTML =
          '<span class="sim-log__date">' + dayLabel(ds[i], i, preset) + "</span>" +
          '<span class="sim-log__body"><b>' + v.text + "</b>" +
          (note ? "<span>" + T(note[0], note[1]) + "</span>" : "") + "</span>";
        log.appendChild(row);
      });
      var lbl = function (i) { return i == null ? T("not yet", "尚未") : dayLabel(ds[i], i, preset); };
      readout.innerHTML =
        "<div><span>" + T("Stage 1 ended", "阶段 1 结束") + "</span><b>" + lbl(r.entered) + "</b></div>" +
        "<div><span>" + T("Restarts", "重新计数") + "</span><b>" + r.restarts + "</b></div>" +
        "<div><span>" + T("Measured mornings", "已测量的早晨") + "</span><b>" + r.count + " / " + need + "</b></div>" +
        "<div><span>" + T("Stabilised", "稳定完成") + "</span><b>" + lbl(r.done) + "</b></div>";
    }

    root.querySelectorAll('input[name="sim-preset"]').forEach(function (inp) {
      inp.addEventListener("change", function () {
        preset = inp.value;
        days = preset === "mdn" ? MDN.days.slice() : ["q", "q", "q", "q", "q", "q", "q", "q", "q", "q", "q", "q", "q", "q"];
        render();
      });
    });
    root.querySelectorAll('input[name="sim-need"]').forEach(function (inp) {
      inp.addEventListener("change", function () { need = +inp.value; render(); });
    });
    provBox.addEventListener("change", render);
    var reset = root.querySelector("[data-sim-reset]");
    if (reset) reset.addEventListener("click", function () {
      days = preset === "mdn" ? MDN.days.slice() : days.map(function () { return "q"; });
      render();
    });
    render();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-phase-map]").forEach(initPhaseMap);
    document.querySelectorAll("[data-sim]").forEach(initSim);
  });
})();
