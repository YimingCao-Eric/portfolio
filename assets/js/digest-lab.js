/* AI-news daily digest — interactive figures.
   1. Dedupe lab: canonical_url / url_hash and titles_are_near_duplicates from
      src/digest/store.py, ported function for function (Dice coefficient, stopword list,
      tracking-parameter list and the numeric-token guard all as in the repo).
   2. Home-page card thumbnail: the seven-stage pipeline with the built stages filled. */
(function () {
  "use strict";
  function t(en, zh) { return (window.I18N && window.I18N.t) ? window.I18N.t(en, zh) : en; }

  /* ============================================================
     1. Ported from store.py
     ============================================================ */
  var TRACKING_PARAMS = { ref: 1, ref_src: 1, fbclid: 1, gclid: 1, igshid: 1, mc_cid: 1 };
  var TRACKING_PREFIXES = ["utm_"];
  function isTracking(key) {
    var k = key.toLowerCase();
    if (TRACKING_PARAMS[k]) return true;
    for (var i = 0; i < TRACKING_PREFIXES.length; i++) if (k.indexOf(TRACKING_PREFIXES[i]) === 0) return true;
    return false;
  }
  // Mirrors urlsplit → lowercase scheme/host, drop www., drop fragment, drop tracking
  // params, strip trailing slash, urlunsplit. Returns {url, dropped, kept, error}.
  function canonicalUrl(raw) {
    var s = raw.trim();
    var m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(s);
    if (!m) return { url: s, dropped: [], kept: [], error: t("not an absolute URL", "不是绝对 URL") };
    var scheme = m[1].toLowerCase();
    var auth = m[2], hostport = auth.indexOf("@") >= 0 ? auth.slice(auth.lastIndexOf("@") + 1) : auth;
    var host = hostport, port = "";
    var pm = /^(.*):(\d+)$/.exec(hostport);
    if (pm) { host = pm[1]; port = pm[2]; }
    host = host.toLowerCase();
    if (host.indexOf("www.") === 0) host = host.slice(4);
    var netloc = port ? host + ":" + port : host;
    var path = m[3].replace(/\/+$/, "");
    var kept = [], dropped = [];
    if (m[4] && m[4].length > 1) {
      m[4].slice(1).split("&").forEach(function (pair) {
        if (!pair) return;
        var eq = pair.indexOf("="), k = eq >= 0 ? pair.slice(0, eq) : pair, v = eq >= 0 ? pair.slice(eq + 1) : "";
        (isTracking(decodeURIComponent(k)) ? dropped : kept).push([k, v]);
      });
    }
    var query = kept.map(function (p) { return p[0] + "=" + p[1]; }).join("&");
    return { url: scheme + "://" + netloc + path + (query ? "?" + query : ""), dropped: dropped, kept: kept, fragment: !!m[5], error: null };
  }

  var STOPWORDS = {};
  ("a an the and or but of for to in on at by with from as is are was were be been being it its this " +
   "that these those s t via using how why what when").split(" ").forEach(function (w) { STOPWORDS[w] = 1; });
  var NEAR_DUPLICATE_THRESHOLD = 0.85;
  function tokens(title) {
    var cleaned = title.toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, " ");
    var out = {};
    cleaned.split(/\s+/).forEach(function (tok) { if (tok && !STOPWORDS[tok]) out[tok] = 1; });
    return Object.keys(out);
  }
  function numericTokens(toks) { return toks.filter(function (x) { return /\d/.test(x); }); }
  function sameSet(a, b) { if (a.length !== b.length) return false; var s = {}; a.forEach(function (x) { s[x] = 1; }); return b.every(function (x) { return s[x]; }); }
  function judge(left, right) {
    var a = tokens(left), b = tokens(right);
    var na = numericTokens(a), nb = numericTokens(b);
    var sa = {}; a.forEach(function (x) { sa[x] = 1; });
    var overlap = b.filter(function (x) { return sa[x]; });
    var dice = (a.length && b.length) ? 2 * overlap.length / (a.length + b.length) : 0;
    var guard = !sameSet(na, nb);
    return { a: a, b: b, na: na, nb: nb, overlap: overlap, dice: dice, guardFired: guard,
             duplicate: !guard && a.length > 0 && b.length > 0 && dice >= NEAR_DUPLICATE_THRESHOLD };
  }

  async function sha256hex(s) {
    if (!(window.crypto && crypto.subtle)) return null;
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  var TITLE_PRESETS = [
    ["Anthropic releases Claude Opus 4.5 with a 1M context window", "Anthropic releases Claude Opus 4.6 with a 1M context window"],
    ["Nvidia unveils the RTX 5090 Super at CES 2027", "Nvidia unveils the RTX 5080 Super at CES 2027"],
    ["Llama 4 Scout 7B quantised to 4-bit runs on a phone", "Llama 4 Scout 8B quantised to 4-bit runs on a phone"],
    ["Show HN: A local-first RAG pipeline for your notes", "Show HN: A local-first RAG pipeline for the notes"],
    ["Anthropic releases Claude Code 2.0", "Claude Code 2.0 released by Anthropic"],
    ["vLLM v0.12 adds speculative decoding for MoE models", "vLLM v0.12 adds speculative decoding for MoE models on AMD"],
    ["SAS: Simple Attention Sparsification via End-to-End Training", "SAS: Simple Attention Sparsification via End-to-End Training"]
  ];
  var URL_PRESETS = [
    ["https://WWW.Example.com/blog/post/?utm_source=hn&utm_medium=social&ref=twitter#comments", "https://example.com/blog/post"],
    ["https://huggingface.co/models?source=trending", "https://huggingface.co/models?source=likes"],
    ["https://github.com/anthropics/claude-code/releases/tag/v2.0.0?fbclid=abc", "https://github.com/anthropics/claude-code/releases/tag/v2.0.0/"],
    ["https://openai.com/index/gpt-5/?gclid=123", "https://openai.com/index/gpt-5-mini/?gclid=123"],
    ["https://huggingface.co/papers/2609.13141", "https://arxiv.org/abs/2609.13141"]
  ];

  function initDedupe(root) {
    var lT = root.querySelector("[data-dd-left]"), rT = root.querySelector("[data-dd-right]");
    var lU = root.querySelector("[data-dd-url-left]"), rU = root.querySelector("[data-dd-url-right]");
    var titleOut = root.querySelector("[data-dd-title-out]"), urlOut = root.querySelector("[data-dd-url-out]");
    var verdict = root.querySelector("[data-dd-verdict]"), urlVerdict = root.querySelector("[data-dd-url-verdict]");
    var presetT = root.querySelector("[data-dd-preset-title]"), presetU = root.querySelector("[data-dd-preset-url]");

    TITLE_PRESETS.forEach(function (p, i) {
      var o = document.createElement("option"); o.value = i; o.textContent = p[0].slice(0, 44) + "… / …" + p[1].slice(-22); presetT.appendChild(o);
    });
    URL_PRESETS.forEach(function (p, i) {
      var o = document.createElement("option"); o.value = i; o.textContent = p[0].replace(/^https?:\/\//, "").slice(0, 40) + "… vs …" + p[1].replace(/^https?:\/\//, "").slice(-24); presetU.appendChild(o);
    });
    presetT.addEventListener("change", function () { var p = TITLE_PRESETS[+presetT.value]; lT.value = p[0]; rT.value = p[1]; renderTitles(); });
    presetU.addEventListener("change", function () { var p = URL_PRESETS[+presetU.value]; lU.value = p[0]; rU.value = p[1]; renderUrls(); });
    [lT, rT].forEach(function (el) { el.addEventListener("input", renderTitles); });
    [lU, rU].forEach(function (el) { el.addEventListener("input", renderUrls); });

    function tokList(toks, hi, num) {
      return toks.map(function (x) {
        var cls = hi[x] ? "dd-tok dd-tok--shared" : "dd-tok";
        if (num[x]) cls += " dd-tok--num";
        return '<span class="' + cls + '">' + escapeHtml(x) + "</span>";
      }).join("");
    }
    function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    function renderTitles() {
      var j = judge(lT.value, rT.value);
      var shared = {}; j.overlap.forEach(function (x) { shared[x] = 1; });
      var numA = {}; j.na.forEach(function (x) { numA[x] = 1; });
      var numB = {}; j.nb.forEach(function (x) { numB[x] = 1; });
      titleOut.innerHTML =
        "<tr><th>" + t("tokens A", "A 的 tokens") + " (" + j.a.length + ")</th><td>" + tokList(j.a, shared, numA) + "</td></tr>" +
        "<tr><th>" + t("tokens B", "B 的 tokens") + " (" + j.b.length + ")</th><td>" + tokList(j.b, shared, numB) + "</td></tr>" +
        "<tr><th>|A ∩ B|</th><td>" + j.overlap.length + "</td></tr>" +
        "<tr><th>Dice = 2|A∩B| / (|A|+|B|)</th><td>" + j.dice.toFixed(3) + (j.dice >= NEAR_DUPLICATE_THRESHOLD ? " ≥ 0.85" : " &lt; 0.85") + "</td></tr>" +
        "<tr><th>" + t("numeric tokens", "含数字 tokens") + "</th><td>{" + j.na.join(", ") + "} " + (j.guardFired ? "≠" : "=") + " {" + j.nb.join(", ") + "}</td></tr>";
      var cls, msg;
      if (j.duplicate) { cls = "dd-verdict dd-verdict--dup"; msg = t("near-duplicate — stored, with dupe_of pointing at the earlier row", "判定为近重复 — 仍会入库，但 dupe_of 指向更早的那一行"); }
      else if (j.guardFired) { cls = "dd-verdict dd-verdict--guard"; msg = t("not a duplicate — the numeric guard fired: digit-bearing tokens differ, so the Dice ratio is never consulted", "不是重复 — 数字守卫触发：含数字的 token 不一致，Dice 比值根本不会被参考"); }
      else if (!j.a.length || !j.b.length) { cls = "dd-verdict"; msg = t("no tokens left after stopword removal", "去掉停用词后没有 token 剩下"); }
      else { cls = "dd-verdict"; msg = t("not a duplicate — Dice below 0.85", "不是重复 — Dice 低于 0.85"); }
      verdict.className = cls; verdict.textContent = msg;
    }

    function renderUrls() {
      var a = canonicalUrl(lU.value), b = canonicalUrl(rU.value);
      var rows = "";
      [["A", a], ["B", b]].forEach(function (pair) {
        var c = pair[1];
        rows += "<tr><th>canonical " + pair[0] + "</th><td>" + (c.error ? '<span class="is-null">' + escapeHtml(c.error) + "</span>" : escapeHtml(c.url)) + "</td></tr>";
        rows += "<tr><th>" + t("dropped", "剔除") + " " + pair[0] + "</th><td class=\"" + (c.dropped.length || c.fragment ? "" : "is-null") + "\">" +
          (c.dropped.map(function (p) { return escapeHtml(p[0]); }).concat(c.fragment ? ["#fragment"] : []).join(", ") || "—") + "</td></tr>";
      });
      urlOut.innerHTML = rows;
      if (a.error || b.error) { urlVerdict.className = "dd-verdict"; urlVerdict.textContent = ""; return; }
      var same = a.url === b.url;
      urlVerdict.className = same ? "dd-verdict dd-verdict--dup" : "dd-verdict";
      urlVerdict.textContent = same ? t("same url_hash — INSERT OR IGNORE drops the second silently", "url_hash 相同 — INSERT OR IGNORE 会静默丢弃第二条")
                                    : t("different url_hash — both rows are kept", "url_hash 不同 — 两行都保留");
      sha256hex(a.url).then(function (h) {
        if (!h) return;
        var extra = document.createElement("div"); extra.className = "dd-hash";
        extra.innerHTML = "sha256(A) = " + h.slice(0, 16) + "…";
        urlVerdict.appendChild(extra);
      });
    }
    presetT.value = 0; lT.value = TITLE_PRESETS[0][0]; rT.value = TITLE_PRESETS[0][1];
    presetU.value = 0; lU.value = URL_PRESETS[0][0]; rU.value = URL_PRESETS[0][1];
    renderTitles(); renderUrls();
  }

  /* ============================================================
     2. Card thumbnail: seven stages, three built
     ============================================================ */
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

    var stages = ["fetch", "normalise", "store", "rank", "summarise", "render", "deliver"];
    var built = 3;  // rank is next (phase 3b)
    var x0 = 34, boxW = 74, gap = 12, y = 128, boxH = 44;
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    stages.forEach(function (s, i) {
      var x = x0 + i * (boxW + gap);
      var on = i < built;
      ctx.fillStyle = on ? accent : elev; ctx.strokeStyle = on ? accent : border; ctx.lineWidth = 1.2;
      roundRect(ctx, x, y, boxW, boxH, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = on ? elev : faint; ctx.font = "600 12px ui-monospace, Menlo, monospace";
      ctx.fillText(s, x + boxW / 2, y + boxH / 2);
      if (i < stages.length - 1) {
        ctx.strokeStyle = i < built - 1 ? accent : border; ctx.lineWidth = 1.4; ctx.beginPath();
        ctx.moveTo(x + boxW + 1, y + boxH / 2); ctx.lineTo(x + boxW + gap - 1, y + boxH / 2); ctx.stroke();
      }
    });
    ctx.textAlign = "left";
    ctx.fillStyle = text; ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(t("one job, seven stages", "一个任务，七个阶段"), x0, 70);
    ctx.fillStyle = faint; ctx.font = "500 11px ui-monospace, Menlo, monospace";
    ctx.fillText(t("built · phases 0–3a + review", "已完成 · phase 0–3a + review"), x0, 96);
    ctx.fillText(t("next · phase 3b: rule ranker with per-topic quotas", "下一步 · phase 3b：带 per-topic quota 的规则排序"), x0, 216);
    // source row
    var srcs = ["hn 30", "gh_trending 24", "hf_papers 50", "ai_blogs 112", "arxiv 240"];
    var sx = x0;
    srcs.forEach(function (s) {
      ctx.font = "500 11px ui-monospace, Menlo, monospace";
      var w = ctx.measureText(s).width + 18;
      ctx.fillStyle = elev; ctx.strokeStyle = accent; ctx.lineWidth = 1;
      roundRect(ctx, sx, 250, w, 24, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = text; ctx.fillText(s, sx + 9, 262);
      sx += w + 8;
    });
    ctx.fillStyle = faint; ctx.font = "500 11px ui-monospace, Menlo, monospace";
    ctx.fillText("242 tests · offline · 425-row snapshot · SQLite · uv", x0, 312);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-dedupe-lab]").forEach(initDedupe);
    var strips = document.querySelectorAll("[data-digest-strip]");
    strips.forEach(drawStrip);
    document.addEventListener("themechange", function () { strips.forEach(drawStrip); });
  });
})();
