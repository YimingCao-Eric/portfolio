/* Job Hunting Assistant — interactive figures.
   1. Projection lab: backend/core/scraped_job_projection.py ported function for function.
      Feed a per-site row, get the canonical scraped_jobs fields and the warnings the
      real module would log.
   2. Orchestrator lab: probeSiteSession / preCycleCheck / auto-pause / scheduleNextCycle
      from extension/background/auto_scrape.js, as a cycle-by-cycle simulator.
   3. Home-page card thumbnail. */
(function () {
  "use strict";

  /* ============================================================
     1. Projection — ported from scraped_job_projection.py
     ============================================================ */
  var PERIOD_VOCAB = {
    HOURLY: "HOURLY", HOUR: "HOURLY", PER_HOUR: "HOURLY", HOURLY_RATE: "HOURLY",
    DAILY: "DAILY", DAY: "DAILY", PER_DAY: "DAILY",
    WEEKLY: "WEEKLY", WEEK: "WEEKLY", PER_WEEK: "WEEKLY",
    MONTHLY: "MONTHLY", MONTH: "MONTHLY", PER_MONTH: "MONTHLY",
    YEARLY: "ANNUAL", YEAR: "ANNUAL", ANNUAL: "ANNUAL", ANNUALLY: "ANNUAL",
    PER_YEAR: "ANNUAL", YEARLY_RATE: "ANNUAL"
  };
  var EMPLOYMENT_PRECEDENCE = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "PERMANENT", "VOLUNTEER"];
  var WORKPLACE_PRECEDENCE = ["REMOTE", "HYBRID", "ONSITE"];
  var EMPLOYMENT_VOCAB = {
    FULL_TIME: "FULL_TIME", FULLTIME: "FULL_TIME",
    PART_TIME: "PART_TIME", PARTTIME: "PART_TIME",
    CONTRACT: "CONTRACT", CONTRACTOR: "CONTRACT",
    TEMPORARY: "TEMPORARY", TEMP: "TEMPORARY",
    INTERNSHIP: "INTERNSHIP", INTERN: "INTERNSHIP",
    PERMANENT: "PERMANENT",
    VOLUNTEER: "VOLUNTEER"
  };
  var WORKPLACE_VOCAB = {
    REMOTE: "REMOTE", FULLY_REMOTE: "REMOTE", WORK_FROM_HOME: "REMOTE",
    HYBRID: "HYBRID",
    ONSITE: "ONSITE", ON_SITE: "ONSITE", IN_PERSON: "ONSITE", IN_OFFICE: "ONSITE",
    "URN:LI:FS_WORKPLACETYPE:1": "ONSITE",
    "URN:LI:FS_WORKPLACETYPE:2": "REMOTE",
    "URN:LI:FS_WORKPLACETYPE:3": "HYBRID"
  };
  var UNMAPPABLE = { OTHER: true };
  var SALARY_EMPLOYER = { EMPLOYER: 1, EMPLOYER_PROVIDED: 1, EMPLOYER_PROVIDED_SALARY: 1, EXTRACTION: 1 };
  var SALARY_ESTIMATE = { ESTIMATE: 1, ESTIMATED: 1, INDEED_ESTIMATE: 1, GLASSDOOR_ESTIMATE: 1 };
  var MIN_EPOCH_MS = 946684800000, MAX_EPOCH_MS = 4102444800000;

  function Log() { this.events = []; }
  Log.prototype.warn = function (event, detail) { this.events.push({ event: event, detail: detail }); };

  function normToken(raw) {
    if (raw == null || typeof raw === "boolean" || typeof raw !== "string") return null;
    var t = raw.trim().toUpperCase().replace(/-/g, "_").replace(/ /g, "_");
    return t || null;
  }
  function asValues(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.slice();
    if (typeof raw === "object") return Object.keys(raw).map(function (k) { return raw[k]; });
    return [raw];
  }
  function labelOf(v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      var keys = ["localizedName", "name", "label"];
      for (var i = 0; i < keys.length; i++) if (typeof v[keys[i]] === "string") return v[keys[i]];
    }
    return v;
  }
  function selectByPrecedence(raw, vocab, precedence, site, event, log) {
    var mapped = {};
    asValues(raw).forEach(function (value) {
      var label = labelOf(value);
      var token = normToken(label);
      if (token === null) {
        if (label != null && !(typeof label === "string" && !label.trim())) {
          log.warn("projection_bad_value_shape", { site: site, field: event.replace("projection_unknown_", ""), raw: String(value).slice(0, 64), type: typeof value });
        }
        return;
      }
      var canonical = vocab[token];
      if (canonical) mapped[canonical] = true;
      else if (UNMAPPABLE[token]) { /* recognised, maps to nothing, no warning */ }
      else log.warn(event, { site: site, raw: String(label).slice(0, 64) });
    });
    for (var i = 0; i < precedence.length; i++) if (mapped[precedence[i]]) return precedence[i];
    return null;
  }
  function normalizeSalaryPeriod(raw, site, log) {
    if (raw == null) return null;
    var token = String(raw).trim().toUpperCase().replace(/-/g, "_").replace(/ /g, "_");
    if (!token) return null;
    var c = PERIOD_VOCAB[token];
    if (!c) { log.warn("projection_unknown_salary_period", { site: site, raw: String(raw).slice(0, 64) }); return null; }
    return c;
  }
  function epochMsToDate(raw, site, field, log) {
    if (raw == null || raw === "") return null;
    var n = typeof raw === "number" ? raw : (String(raw).trim() === "" ? NaN : Number(raw));
    if (typeof raw === "boolean" || isNaN(n)) { log.warn("projection_bad_posted_at", { site: site, field: field, raw: String(raw).slice(0, 64), reason: "not_numeric" }); return null; }
    if (!(n >= MIN_EPOCH_MS && n <= MAX_EPOCH_MS)) { log.warn("projection_bad_posted_at", { site: site, field: field, raw: String(raw).slice(0, 64), reason: "out_of_range" }); return null; }
    return new Date(n).toISOString().replace(".000Z", "+00:00");
  }
  function dateToDate(raw, site, field, log) {
    if (raw == null || raw === "") return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw).trim());
    if (!m) { log.warn("projection_bad_posted_at", { site: site, field: field, raw: String(raw).slice(0, 64), reason: "not_a_date" }); return null; }
    return m[1] + "-" + m[2] + "-" + m[3] + "T00:00:00+00:00";
  }
  function deriveSalaryDisclosed(raw, site, log) {
    var t = normToken(raw);
    if (t === null) return null;
    if (SALARY_EMPLOYER[t]) return true;
    if (SALARY_ESTIMATE[t]) return false;
    log.warn("projection_unknown_salary_source", { site: site, raw: String(raw).slice(0, 64) });
    return null;
  }
  function normalizeLanguage(raw, site, log) {
    if (raw == null || raw === "") return null;
    if (typeof raw !== "string") { log.warn("projection_bad_language", { site: site, raw: String(raw), reason: "not_a_string" }); return null; }
    var base = raw.trim().replace(/_/g, "-").split("-")[0].toLowerCase();
    if (!base) return null;
    if (!(base.length >= 2 && base.length <= 3 && /^[a-z]+$/.test(base))) { log.warn("projection_bad_language", { site: site, raw: raw.slice(0, 64), reason: "bad_shape" }); return null; }
    return base;
  }
  function joinEducationLabels(raw) {
    var labels = asValues(raw).filter(function (v) { return typeof v === "string" && v.trim(); }).map(function (v) { return v.trim(); });
    return labels.length ? labels.join("; ") : null;
  }
  function firstJsonbText(raw) {
    if (raw == null) return null;
    if (typeof raw === "string") return raw || null;
    if (Array.isArray(raw)) { for (var i = 0; i < raw.length; i++) if (typeof raw[i] === "string" && raw[i].trim()) return raw[i]; }
    return null;
  }

  function projectLinkedIn(p, log) {
    var workplace = selectByPrecedence(p.workplace_types_labels, WORKPLACE_VOCAB, WORKPLACE_PRECEDENCE, "linkedin", "projection_unknown_workplace_type", log);
    if (workplace !== null && typeof p.work_remote_allowed === "boolean") {
      if ((workplace === "REMOTE") !== p.work_remote_allowed) {
        log.warn("projection_workplace_remote_conflict", { site: "linkedin", remote_allowed: p.work_remote_allowed, labels: String(p.workplace_types_labels).slice(0, 64), workplace_type: workplace });
      }
    }
    return {
      company: p.company_name == null ? null : p.company_name,
      industry: firstJsonbText(p.formatted_industries),
      remote: typeof p.work_remote_allowed === "boolean" ? p.work_remote_allowed : null,
      salary_period: normalizeSalaryPeriod(p.salary_period, "linkedin", log),
      posted_at: epochMsToDate(p.listed_at, "linkedin", "listed_at", log),
      employment_type: selectByPrecedence(p.formatted_employment_status, EMPLOYMENT_VOCAB, EMPLOYMENT_PRECEDENCE, "linkedin", "projection_unknown_employment_type", log),
      workplace_type: workplace,
      language: null,
      education_requirements: null,
      salary_disclosed: typeof p.salary_provided_by_employer === "boolean" ? p.salary_provided_by_employer : null
    };
  }
  function projectIndeed(p, log) {
    return {
      company: p.company != null ? p.company : (p.employer_name == null ? null : p.employer_name),
      industry: null,
      remote: typeof p.remote_location === "boolean" ? p.remote_location : null,
      salary_period: normalizeSalaryPeriod(p.salary_period, "indeed", log),
      posted_at: epochMsToDate(p.pub_date, "indeed", "pub_date", log),
      employment_type: selectByPrecedence(p.job_types, EMPLOYMENT_VOCAB, EMPLOYMENT_PRECEDENCE, "indeed", "projection_unknown_employment_type", log),
      workplace_type: typeof p.remote_location === "boolean" ? (p.remote_location ? "REMOTE" : "ONSITE") : null,
      language: normalizeLanguage(p.language, "indeed", log),
      education_requirements: null,
      salary_disclosed: deriveSalaryDisclosed(p.salary_snippet_source, "indeed", log)
    };
  }
  function projectGlassdoor(p, log) {
    var structured = p.employment_type;
    var emp = asValues(structured).length
      ? selectByPrecedence(structured, EMPLOYMENT_VOCAB, EMPLOYMENT_PRECEDENCE, "glassdoor", "projection_unknown_employment_type", log)
      : selectByPrecedence(p.job_type, EMPLOYMENT_VOCAB, EMPLOYMENT_PRECEDENCE, "glassdoor", "projection_unknown_employment_type", log);
    var edu = joinEducationLabels(p.education_labels);
    if (edu === null && typeof p.experience_requirements_description === "string" && p.experience_requirements_description.trim()) edu = p.experience_requirements_description;
    return {
      company: p.employer_name == null ? null : p.employer_name,
      industry: p.industry == null ? null : p.industry,
      remote: asValues(p.remote_work_types).length ? true : null,
      salary_period: normalizeSalaryPeriod(p.salary_period, "glassdoor", log),
      posted_at: dateToDate(p.date_posted, "glassdoor", "date_posted", log),
      employment_type: emp,
      workplace_type: selectByPrecedence(p.remote_work_types, WORKPLACE_VOCAB, WORKPLACE_PRECEDENCE, "glassdoor", "projection_unknown_workplace_type", log),
      language: null,
      education_requirements: edu,
      salary_disclosed: deriveSalaryDisclosed(p.salary_source, "glassdoor", log)
    };
  }

  /* ---- the lab UI ---- */
  // Field definitions per site: [key, label, kind, default, hint]
  // kind: "list" (comma-separated tokens), "text", "num", "bool3" (true/false/absent), "urn"
  var SITE_FIELDS = {
    linkedin: [
      ["company_name", "company_name", "text", "Hootsuite"],
      ["formatted_employment_status", "formatted_employment_status", "list", "Full-time", "comma-separated; try “Full-time, Part-time”, “Other”, “Freelance”"],
      ["workplace_types_labels", "workplace_types_labels", "urn", "urn:li:fs_workplaceType:3", "the live payload is a URN map — pick the enum"],
      ["work_remote_allowed", "work_remote_allowed", "bool3", "false"],
      ["formatted_industries", "formatted_industries", "list", "Software Development, IT Services"],
      ["salary_period", "salary_period", "text", "YEARLY", "try “per year”, “fortnightly”"],
      ["salary_provided_by_employer", "salary_provided_by_employer", "bool3", "true"],
      ["listed_at", "listed_at (epoch ms)", "text", "1784160000000", "try 1784160000 (seconds) or “yesterday”"]
    ],
    indeed: [
      ["company", "company (mosaic)", "text", "", "blank = mosaic didn't carry one → graphql fallback"],
      ["employer_name", "employer_name (graphql)", "text", "Shopify"],
      ["job_types", "job_types", "list", "Full-time, Permanent", "the combo that created the PERMANENT token"],
      ["remote_location", "remote_location", "bool3", "false", "false becomes ONSITE — the one place the projection over-claims"],
      ["language", "language", "text", "en-CA", "try “fr_CA”, “english”"],
      ["salary_period", "salary_period", "text", "HOURLY"],
      ["salary_snippet_source", "salary_snippet_source", "text", "EXTRACTION", "try INDEED_ESTIMATE, EMPLOYER, or something new"],
      ["pub_date", "pub_date (epoch ms)", "text", "1784073600000"]
    ],
    glassdoor: [
      ["employer_name", "employer_name", "text", "Clio"],
      ["industry", "industry", "text", "Legal software"],
      ["employment_type", "employment_type (JSON-LD list)", "list", "", "blank = absent → falls back to job_type; “OTHER” = present, no fallback"],
      ["job_type", "job_type (header)", "text", "Contract"],
      ["remote_work_types", "remote_work_types", "list", "", "the scraper currently sends this empty — see the page"],
      ["education_labels", "education_labels", "list", "Bachelor's degree, Master's degree"],
      ["experience_requirements_description", "experience_requirements_description", "text", "3+ years in a SaaS product team"],
      ["salary_period", "salary_period (payPeriod)", "text", "ANNUAL"],
      ["salary_source", "salary_source", "text", "GLASSDOOR_ESTIMATE"],
      ["date_posted", "date_posted (ISO date)", "text", "2026-07-15", "try 15/07/2026"]
    ]
  };
  var CANON_ORDER = ["company", "industry", "employment_type", "workplace_type", "remote", "salary_period", "salary_disclosed", "language", "education_requirements", "posted_at"];

  function parseList(s) {
    return s.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function readBool3(v) { return v === "true" ? true : v === "false" ? false : null; }

  function initProjection(root) {
    var tabs = root.querySelectorAll("[data-proj-site]");
    var form = root.querySelector("[data-proj-form]");
    var out = root.querySelector("[data-proj-out]");
    var warn = root.querySelector("[data-proj-warn]");
    var site = "linkedin";

    function buildForm() {
      form.innerHTML = "";
      SITE_FIELDS[site].forEach(function (f) {
        var wrap = document.createElement("div");
        wrap.className = "gmm-field proj-field";
        var lab = document.createElement("label");
        lab.textContent = f[1];
        wrap.appendChild(lab);
        var input;
        if (f[2] === "bool3") {
          input = document.createElement("select");
          [["true", "true"], ["false", "false"], ["", "absent (null)"]].forEach(function (o) {
            var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; input.appendChild(op);
          });
          input.value = f[3];
        } else if (f[2] === "urn") {
          input = document.createElement("select");
          [["urn:li:fs_workplaceType:1", "urn:li:fs_workplaceType:1 (on-site)"], ["urn:li:fs_workplaceType:2", "urn:li:fs_workplaceType:2 (remote)"], ["urn:li:fs_workplaceType:3", "urn:li:fs_workplaceType:3 (hybrid)"], ["Remote", "“Remote” — the label the fixture assumed"], ["", "absent"]].forEach(function (o) {
            var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; input.appendChild(op);
          });
          input.value = f[3];
        } else {
          input = document.createElement("input");
          input.type = "text"; input.value = f[3];
          if (f[2] === "list") input.placeholder = "empty = absent";
        }
        input.setAttribute("data-key", f[0]); input.setAttribute("data-kind", f[2]);
        input.addEventListener("input", run); input.addEventListener("change", run);
        wrap.appendChild(input);
        if (f[4]) { var h = document.createElement("small"); h.textContent = f[4]; wrap.appendChild(h); }
        form.appendChild(wrap);
      });
    }

    function readParams() {
      var p = {};
      form.querySelectorAll("[data-key]").forEach(function (el) {
        var k = el.getAttribute("data-key"), kind = el.getAttribute("data-kind"), v = el.value;
        if (kind === "list") p[k] = v.trim() ? parseList(v) : [];
        else if (kind === "bool3") p[k] = readBool3(v);
        else if (kind === "urn") { if (!v) p[k] = {}; else if (v.indexOf("urn:") === 0) { var m = {}; m["*" + v] = v; p[k] = m; } else p[k] = [v]; }
        else if (k === "listed_at" || k === "pub_date") { p[k] = v.trim() === "" ? null : (isNaN(Number(v)) ? v : Number(v)); }
        else p[k] = v === "" ? null : v;
      });
      return p;
    }

    function fmt(v) {
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "boolean") return v ? "true" : "false";
      return String(v);
    }

    function run() {
      var p = readParams(), log = new Log();
      var row = site === "linkedin" ? projectLinkedIn(p, log) : site === "indeed" ? projectIndeed(p, log) : projectGlassdoor(p, log);
      out.innerHTML = "";
      CANON_ORDER.forEach(function (k) {
        var tr = document.createElement("tr");
        var isNull = row[k] === null || row[k] === undefined;
        tr.innerHTML = "<th></th><td class='proj-val'></td>";
        tr.querySelector("th").textContent = k;
        var td = tr.querySelector("td"); td.textContent = fmt(row[k]);
        if (isNull) td.classList.add("is-null");
        out.appendChild(tr);
      });
      warn.innerHTML = "";
      if (!log.events.length) {
        var ok = document.createElement("li"); ok.className = "proj-warn__none"; ok.textContent = "no warnings — every value mapped or was absent"; warn.appendChild(ok);
      }
      log.events.forEach(function (e) {
        var li = document.createElement("li");
        li.innerHTML = "<b></b> <span></span>";
        li.querySelector("b").textContent = e.event;
        li.querySelector("span").textContent = JSON.stringify(e.detail);
        warn.appendChild(li);
      });
    }

    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        site = t.getAttribute("data-proj-site");
        tabs.forEach(function (x) { x.classList.toggle("is-active", x === t); x.setAttribute("aria-selected", x === t ? "true" : "false"); });
        buildForm(); run();
      });
    });
    buildForm(); run();
  }

  /* ============================================================
     2. Orchestrator — ported from auto_scrape.js
     ============================================================ */
  var CAPTCHA_URL_MARKERS = ["/checkpoint/challenge", "/uas/login", "/account/login-challenge", "/member/captcha.htm", "/cdn-cgi/challenge"];
  var CAPTCHA_BODY_MARKERS = ["cf-challenge-running", "g-recaptcha", "recaptcha-anchor", "are you a human", "verify you're human", "verify you are human", "please complete the security check", "security verification"];

  // The probe outcomes the simulator can produce, expressed as the response the real fetch would see.
  var PROBE_CASES = {
    live:        { label: "200, normal page",                 status: 200, url: "https://www.linkedin.com/feed/", body: "<html>…feed…</html>" },
    body_captcha:{ label: "200, but the body has g-recaptcha", status: 200, url: "https://www.linkedin.com/feed/", body: "<div class=\"g-recaptcha\">" },
    login:       { label: "302 → /login",                      status: 200, url: "https://www.linkedin.com/login?session_redirect=…", body: "" },
    authwall:    { label: "302 → /authwall",                   status: 200, url: "https://www.linkedin.com/authwall?trk=…", body: "" },
    challenge:   { label: "302 → /checkpoint/challenge",       status: 200, url: "https://www.linkedin.com/checkpoint/challenge/…", body: "" },
    r429:        { label: "429 Too Many Requests",             status: 429, url: "https://www.indeed.com/notifications", body: "" },
    r403_bare:   { label: "403, plain body",                   status: 403, url: "https://www.glassdoor.ca/Job/index.htm", body: "Forbidden" },
    r403_cf:     { label: "403 with cf-challenge-running",     status: 403, url: "https://www.glassdoor.ca/Job/index.htm", body: "<script>cf-challenge-running</script>" },
    r503:        { label: "503 Service Unavailable",           status: 503, url: "https://www.indeed.com/notifications", body: "" },
    threw:       { label: "fetch threw (DNS / offline)",       status: null, url: null, body: null, threw: true }
  };

  function probeSiteSession(resp) {
    if (resp.threw) return { status: "unknown_treat_as_live", reason: "fetch_threw" };
    var urlLower = (resp.url || "").toLowerCase(), http = resp.status;
    var body = (resp.body || "").slice(0, 8192).toLowerCase();
    if (CAPTCHA_URL_MARKERS.some(function (m) { return urlLower.indexOf(m) >= 0; })) return { status: "captcha", reason: "url_marker" };
    if (urlLower.indexOf("/login") >= 0 || urlLower.indexOf("/authwall") >= 0 || urlLower.indexOf("/account/login") >= 0 || urlLower.indexOf("/signin") >= 0) return { status: "expired", reason: "redirected_to_login_or_authwall" };
    if (http === 429) return { status: "rate_limited", reason: "http_429" };
    if (http === 403) {
      if (CAPTCHA_BODY_MARKERS.some(function (m) { return body.indexOf(m) >= 0; })) return { status: "captcha", reason: "body_marker_403" };
      return { status: "rate_limited", reason: "http_403" };
    }
    if (http >= 200 && http < 300) {
      if (CAPTCHA_BODY_MARKERS.some(function (m) { return body.indexOf(m) >= 0; })) return { status: "captcha", reason: "body_marker" };
      return { status: "live", reason: "http_2xx" };
    }
    if (http >= 500 && http < 600) return { status: "unknown_treat_as_live", reason: "http_" + http + "_server_error" };
    return { status: "unknown", reason: "unexpected_http_" + http };
  }

  var SITES = ["linkedin", "indeed", "glassdoor"];
  var PRECHECK_THRESHOLD = 3;          // max_consecutive_precheck_failures default
  var INTER_SCAN_DELAY_MS = 30000;
  var MIN_CYCLE_INTERVAL_MS = 60000;
  var TRIVIAL_COOLDOWN_MS = 5 * 60 * 1000;

  function initOrchestrator(root) {
    var backendSel = root.querySelector("[data-orc-backend]");
    var probeSels = {};
    SITES.forEach(function (s) { probeSels[s] = root.querySelector("[data-orc-probe='" + s + "']"); });
    var kwInput = root.querySelector("[data-orc-keywords]");
    var runBtn = root.querySelector("[data-orc-run]");
    var resetBtn = root.querySelector("[data-orc-reset]");
    var trace = root.querySelector("[data-orc-trace]");
    var stateOut = root.querySelector("[data-orc-state]");

    // the auto_scrape_state row, the part the simulator tracks
    var state = { enabled: true, consecutive_precheck_failures: 0, cycles: 0, next_cycle_in: null, last_result: "—" };

    function renderState() {
      stateOut.innerHTML = "";
      [["enabled", state.enabled], ["consecutive_precheck_failures", state.consecutive_precheck_failures + " / " + PRECHECK_THRESHOLD], ["cycles run", state.cycles], ["next cycle in", state.next_cycle_in === null ? "—" : fmtMs(state.next_cycle_in)], ["last cycle", state.last_result]].forEach(function (kv) {
        var d = document.createElement("div");
        d.innerHTML = "<span></span><b></b>";
        d.querySelector("span").textContent = kv[0];
        d.querySelector("b").textContent = String(kv[1]);
        stateOut.appendChild(d);
      });
      runBtn.disabled = !state.enabled;
      runBtn.textContent = state.enabled ? "Run one cycle" : "Auto-paused — press Enable";
    }
    function fmtMs(ms) {
      if (ms >= 60000) return (ms / 60000).toFixed(ms % 60000 ? 1 : 0) + " min";
      return (ms / 1000) + " s";
    }
    function step(kind, title, detail) {
      var li = document.createElement("li");
      li.className = "trace__step trace__step--" + kind;
      li.innerHTML = "<b></b><span></span>";
      li.querySelector("b").textContent = title;
      li.querySelector("span").textContent = detail;
      trace.classList.remove("trace--empty");
      trace.appendChild(li);
    }

    function runCycle() {
      trace.innerHTML = "";
      state.cycles++;
      var keywords = parseList(kwInput.value);
      if (!keywords.length) keywords = ["software engineer", "machine learning engineer"]; // compiled-in defaults
      step("ok", "PUT /admin/auto-scrape/state", "cycle_phase: scrape_running — blocks the self-bootstrap alarm");

      // pre-check
      var pre;
      if (backendSel.value === "down") pre = { reason: "backend_down" };
      else if (backendSel.value === "noconfig") pre = { reason: "config_unavailable" };
      else {
        step("ok", "GET /health · GET /config", "backend reachable, config loadable");
        var live = [];
        SITES.forEach(function (s) {
          var r = probeSiteSession(PROBE_CASES[probeSels[s].value]);
          var isLive = r.status === "live" || r.status === "unknown_treat_as_live";
          if (isLive) live.push(s);
          step(isLive ? "ok" : (r.status === "captcha" ? "fail" : "skip"), "probeSiteSession(\"" + s + "\")",
            r.status + " (" + r.reason + ")" + (r.status === "captcha" ? " → Chrome notification, site skipped until you resolve it" : r.status === "unknown_treat_as_live" ? " → treated as live: a server error isn't evidence the session died" : isLive ? "" : " → skipped this cycle"));
        });
        pre = live.length ? { reason: "ok", live: live } : { reason: "all_sessions_dead" };
      }

      var elapsed = 0, succeeded = 0;
      if (pre.reason !== "ok") {
        state.consecutive_precheck_failures++;
        step("fail", "preCycleCheck", pre.reason + " → consecutive_precheck_failures = " + state.consecutive_precheck_failures);
        if (state.consecutive_precheck_failures >= PRECHECK_THRESHOLD) {
          state.enabled = false;
          step("fail", "auto-pause", "threshold " + PRECHECK_THRESHOLD + " reached → PUT { enabled: false }. Nothing runs until a human presses Enable.");
        }
        elapsed = 2000;
        state.last_result = "pre-check failed: " + pre.reason;
      } else {
        if (state.consecutive_precheck_failures) step("ok", "preCycleCheck", "ok → consecutive_precheck_failures reset to 0");
        state.consecutive_precheck_failures = 0;
        var n = pre.live.length * keywords.length;
        step("ok", "runScrapeMatrix", pre.live.length + " live site" + (pre.live.length > 1 ? "s" : "") + " × " + keywords.length + " keyword" + (keywords.length > 1 ? "s" : "") + " = " + n + " scans, 30 s apart, each with a 30-min timeout");
        succeeded = n;
        elapsed = n * (INTER_SCAN_DELAY_MS + 4 * 60 * 1000); // ~4 min per scan is a typical full-page scan
        step("ok", "POST /admin/auto-scrape/wake-orchestrator", "Redis publish → backend runs auto-expiration on both tables, finalises the cycle row");
        state.last_result = n + " scans, all succeeded";
      }

      // scheduleNextCycle
      var sleep = Math.max(0, MIN_CYCLE_INTERVAL_MS - elapsed);
      var note = "min_cycle_interval 60 s − elapsed " + fmtMs(elapsed) + " → sleep " + fmtMs(sleep);
      if (succeeded === 0 && elapsed < 30000 && sleep < TRIVIAL_COOLDOWN_MS) {
        sleep = TRIVIAL_COOLDOWN_MS;
        note += " — but 0 succeeded in under 30 s, so SC-4 extends it to 5 min rather than hammer the boards";
      }
      state.next_cycle_in = state.enabled ? sleep : null;
      step(state.enabled ? "ok" : "skip", "scheduleNextCycle", state.enabled ? "chrome.alarms.create(\"auto_scrape_next_cycle\") — " + note : "not scheduled: orchestrator is paused");
      step("ok", "finally", "cycle_phase: idle");
      renderState();
    }

    runBtn.addEventListener("click", function () { if (state.enabled) runCycle(); });
    resetBtn.addEventListener("click", function () {
      state = { enabled: true, consecutive_precheck_failures: 0, cycles: 0, next_cycle_in: null, last_result: "—" };
      trace.innerHTML = ""; trace.classList.add("trace--empty"); renderState();
    });
    root.querySelector("[data-orc-enable]").addEventListener("click", function () {
      state.enabled = true; state.consecutive_precheck_failures = 0;
      trace.innerHTML = ""; step("ok", "POST /admin/auto-scrape/enable", "enabled: true, pre-check counter cleared, config_change_pending cleared");
      renderState();
    });
    renderState();
  }

  /* ============================================================
     3. Card thumbnail: three per-source tables → one canonical row
     ============================================================ */
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

    var srcs = [["linkedin_jobs", 39], ["indeed_jobs", 45], ["glassdoor_jobs", 48]];
    var x0 = 36, y0 = 58, rowH = 62, gap = 22, cellW = 7.2, cellH = 18;
    ctx.textBaseline = "middle";
    srcs.forEach(function (s, i) {
      var y = y0 + i * (rowH + gap);
      ctx.fillStyle = text; ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText(s[0], x0, y);
      ctx.fillStyle = faint; ctx.font = "500 11px ui-monospace, Menlo, monospace";
      ctx.fillText(s[1] + " cols · source-shaped", x0 + 130, y);
      for (var c = 0; c < s[1]; c++) {
        ctx.fillStyle = c % 7 === 0 ? border : elev;
        ctx.strokeStyle = border; ctx.lineWidth = 1;
        roundRect(ctx, x0 + c * cellW, y + 16, cellW - 1.5, cellH, 2); ctx.fill();
      }
      // arrow into canonical
      ctx.strokeStyle = faint; ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(x0 + s[1] * cellW + 12, y + 25); ctx.lineTo(470, y + 25); ctx.lineTo(470, 290); ctx.stroke();
    });
    // canonical row
    ctx.strokeStyle = faint; ctx.beginPath(); ctx.moveTo(470, 290); ctx.lineTo(470, 302); ctx.moveTo(464, 296); ctx.lineTo(470, 302); ctx.lineTo(476, 296); ctx.stroke();
    var cy = 322, cw = 11, cn = 27, cx = 36;
    ctx.fillStyle = text; ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("scraped_jobs", cx, cy - 22);
    ctx.fillStyle = faint; ctx.font = "500 11px ui-monospace, Menlo, monospace";
    ctx.fillText("27 cols · one shape · NULL = “site didn't say”", cx + 112, cy - 22);
    for (var k = 0; k < cn; k++) {
      ctx.fillStyle = k >= 19 ? accent : elev;
      ctx.strokeStyle = k >= 19 ? accent : border;
      roundRect(ctx, cx + k * cw, cy - 8, cw - 2, 22, 3); ctx.fill(); ctx.stroke();
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-proj-lab]").forEach(initProjection);
    document.querySelectorAll("[data-orc-lab]").forEach(initOrchestrator);
    var strips = document.querySelectorAll("[data-jha-strip]");
    strips.forEach(drawStrip);
    document.addEventListener("themechange", function () { strips.forEach(drawStrip); });
  });
})();
