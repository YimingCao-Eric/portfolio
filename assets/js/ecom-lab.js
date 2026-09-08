/* E-commerce admin — interactive figures.
   1. Request simulator: the go-admin middleware chain (IsAuthenticated → IsAuthorized),
      re-implemented line for line from middlewares/*.go and util/jwt.go.
   2. Orders pipeline: the seed orders from go-admin/sql, run through the same
      total / GROUP BY / CSV logic as models/order.go and controllers/orderController.go.
   3. Home-page card thumbnail: a role × permission matrix. */
(function () {
  "use strict";

  /* ============================================================
     Shared: the permission vocabulary the middleware understands
     ============================================================ */
  var PAGES = ["users", "roles", "products", "orders"];
  var PERMS = [];
  PAGES.forEach(function (p) { PERMS.push("view_" + p); PERMS.push("edit_" + p); });

  var ROLE_PRESETS = {
    admin:  PERMS.slice(),
    editor: ["view_users", "view_roles", "view_products", "edit_products", "view_orders", "edit_orders"],
    viewer: ["view_users", "view_roles", "view_products", "view_orders"]
  };

  /* Which controllers actually call middlewares.IsAuthorized in the repo.
     (Only userController.go does — see the note on the page.) */
  var WIRED = { users: true, roles: false, products: false, orders: false };

  /* ---- verbatim ports of the Go ---- */

  // util.ParseJWT: HS256 signature check + exp claim → issuer (the user id)
  function parseJWT(cookie) {
    if (cookie.state === "none")     return { ok: false, why: "no \"jwt\" cookie on the request" };
    if (cookie.state === "tampered") return { ok: false, why: "signature does not verify against SecretKey" };
    if (cookie.state === "expired")  return { ok: false, why: "\"exp\" claim is in the past (tokens live 24 h)" };
    return { ok: true, issuer: cookie.userId };
  }

  // middlewares.IsAuthenticated
  function isAuthenticated(cookie) {
    var r = parseJWT(cookie);
    if (!r.ok) return { pass: false, status: 401, body: { message: "unauthorized" }, why: r.why };
    return { pass: true, userId: r.issuer };
  }

  // middlewares.IsAuthorized(c, page)
  function isAuthorized(perms, method, page) {
    if (method === "GET") {
      for (var i = 0; i < perms.length; i++) {
        if (perms[i] === "view_" + page || perms[i] === "edit_" + page) return { pass: true, matched: perms[i] };
      }
    } else {
      for (var j = 0; j < perms.length; j++) {
        if (perms[j] === "edit_" + page) return { pass: true, matched: perms[j] };
      }
    }
    return { pass: false, status: 401, body: "unauthorized" };
  }

  /* ============================================================
     1. Request simulator
     ============================================================ */
  function initRbac(root) {
    var roleSel   = root.querySelector("[data-rbac-role]");
    var permBox   = root.querySelector("[data-rbac-perms]");
    var cookieSel = root.querySelector("[data-rbac-cookie]");
    var methodSel = root.querySelector("[data-rbac-method]");
    var pageSel   = root.querySelector("[data-rbac-page]");
    var wiredChk  = root.querySelector("[data-rbac-wired]");
    var routeOut  = root.querySelector("[data-rbac-route]");
    var trace     = root.querySelector("[data-rbac-trace]");
    var statusOut = root.querySelector("[data-rbac-status]");
    var bodyOut   = root.querySelector("[data-rbac-body]");

    var selected = ROLE_PRESETS.editor.slice();

    // permission checkboxes — same list the RoleEdit page renders
    PERMS.forEach(function (p) {
      var lab = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = p;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(p));
      permBox.appendChild(lab);
      cb.addEventListener("change", function () {
        if (cb.checked) { if (selected.indexOf(p) < 0) selected.push(p); }
        else selected = selected.filter(function (s) { return s !== p; });
        roleSel.value = "custom";
        run();
      });
    });

    function syncBoxes() {
      permBox.querySelectorAll("input").forEach(function (cb) {
        cb.checked = selected.indexOf(cb.value) >= 0;
      });
    }

    roleSel.addEventListener("change", function () {
      if (ROLE_PRESETS[roleSel.value]) selected = ROLE_PRESETS[roleSel.value].slice();
      syncBoxes(); run();
    });
    [cookieSel, methodSel, pageSel, wiredChk].forEach(function (el) {
      el.addEventListener("change", run);
    });

    function routeFor(method, page) {
      if (method === "GET")    return "GET /api/" + page + "?page=1";
      if (method === "POST")   return "POST /api/" + page;
      if (method === "PUT")    return "PUT /api/" + page + "/7";
      return "DELETE /api/" + page + "/7";
    }

    function step(state, title, detail) {
      var li = document.createElement("li");
      li.className = "trace__step trace__step--" + state;
      li.innerHTML = "<b></b><span></span>";
      li.querySelector("b").textContent = title;
      li.querySelector("span").textContent = detail;
      return li;
    }

    function run() {
      var method = methodSel.value, page = pageSel.value;
      var cookie = { state: cookieSel.value, userId: "7" };
      var wiredEverywhere = wiredChk.checked;

      routeOut.textContent = routeFor(method, page);
      trace.innerHTML = "";

      // 0. CORS — always passes from the React dev server
      trace.appendChild(step("ok", "cors.New", "origin http://localhost:3000 allowed, credentials on — the cookie rides along"));

      // 1. IsAuthenticated
      var a = isAuthenticated(cookie);
      if (!a.pass) {
        trace.appendChild(step("fail", "middlewares.IsAuthenticated", "util.ParseJWT failed: " + a.why + " → 401"));
        finish(401, JSON.stringify(a.body));
        return;
      }
      trace.appendChild(step("ok", "middlewares.IsAuthenticated", "cookie parsed, HS256 signature valid, issuer = user " + a.userId + " → c.Next()"));

      // 2. controller → IsAuthorized (only where the repo wires it)
      var checked = WIRED[page] || wiredEverywhere;
      if (!checked) {
        trace.appendChild(step("skip", "controllers." + cap(page) + " handler",
          "does not call middlewares.IsAuthorized — the only gate was the cookie"));
        finish(200, sampleBody(method, page));
        return;
      }
      trace.appendChild(step("ok", "database.DB.Preload(\"Role\")",
        "user 7 → role \"" + roleName() + "\" → " + selected.length + " permission" + (selected.length === 1 ? "" : "s") + " loaded"));

      var z = isAuthorized(selected, method, page);
      var need = method === "GET" ? "view_" + page + " or edit_" + page : "edit_" + page;
      if (!z.pass) {
        trace.appendChild(step("fail", "middlewares.IsAuthorized(c, \"" + page + "\")",
          method + " needs " + need + " — none found → 401 (the code says 401, not 403)"));
        finish(401, "\"unauthorized\"");
        return;
      }
      trace.appendChild(step("ok", "middlewares.IsAuthorized(c, \"" + page + "\")",
        method + " needs " + need + " — matched " + z.matched));
      trace.appendChild(step("ok", "controllers." + handlerName(method, page), "GORM query runs, JSON out"));
      finish(200, sampleBody(method, page));
    }

    function finish(status, body) {
      statusOut.textContent = status + (status === 200 ? " OK" : " Unauthorized");
      statusOut.className = "trace__status " + (status === 200 ? "is-ok" : "is-fail");
      bodyOut.textContent = body;
    }

    function roleName() {
      var v = roleSel.value;
      return v === "custom" ? "custom" : v;
    }
    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function handlerName(method, page) {
      var one = page.slice(0, -1);
      if (method === "GET")    return "All" + cap(page);
      if (method === "POST")   return "Create" + cap(one);
      if (method === "PUT")    return "Update" + cap(one);
      return "Delete" + cap(one);
    }
    function sampleBody(method, page) {
      if (method === "DELETE") return "204 No Content";
      if (method === "GET") {
        return '{ "data": [ …5 ' + page + ' ], "meta": { "total": 12, "page": 1, "last_page": 3 } }';
      }
      var one = page.slice(0, -1);
      return '{ "id": 7, …' + one + ' fields }';
    }

    syncBoxes();
    run();
  }

  /* ============================================================
     2. Orders pipeline (seed data from go-admin/sql)
     ============================================================ */
  var SEED = [
    { id: 1, first: "John",  last: "Doe",     email: "john.doe@example.com",     date: "2024-01-15",
      items: [["Wireless Headphones", 199.99, 1], ["Phone Case", 25.50, 2], ["Screen Protector", 15.00, 1]] },
    { id: 2, first: "Jane",  last: "Smith",   email: "jane.smith@example.com",   date: "2024-01-16",
      items: [["Laptop", 1299.99, 1], ["Laptop Bag", 59.99, 1]] },
    { id: 3, first: "Mike",  last: "Johnson", email: "mike.johnson@example.com", date: "2024-01-17",
      items: [["Smart Watch", 299.99, 1], ["Watch Band", 35.00, 2]] },
    { id: 4, first: "Sarah", last: "Wilson",  email: "sarah.wilson@example.com", date: "2024-01-18",
      items: [["Tablet", 499.99, 1], ["Tablet Cover", 29.99, 1], ["Stylus Pen", 45.00, 1]] },
    { id: 5, first: "David", last: "Brown",   email: "david.brown@example.com",  date: "2024-01-19",
      items: [["Gaming Mouse", 79.99, 1], ["Mechanical Keyboard", 149.99, 1], ["Mouse Pad", 19.99, 1]] }
  ];
  var EXTRA_NAMES = [["Priya", "Patel"], ["Tom", "Nguyen"], ["Ana", "Silva"], ["Ken", "Okafor"], ["Mei", "Lin"], ["Omar", "Haddad"]];
  var EXTRA_ITEMS = [["USB-C Hub", 49.99], ["Webcam", 89.99], ["Desk Lamp", 39.99], ["Monitor Arm", 129.99], ["Headset", 159.99], ["SSD 1 TB", 109.99]];

  function initOrders(root) {
    var tableBody = root.querySelector("[data-orders-rows]");
    var chart     = root.querySelector("[data-orders-chart]");
    var csv       = root.querySelector("[data-orders-csv]");
    var meta      = root.querySelector("[data-orders-meta]");
    var addBtn    = root.querySelector("[data-orders-add]");
    var resetBtn  = root.querySelector("[data-orders-reset]");
    var pageSel   = root.querySelector("[data-orders-page]");
    var LIMIT = 5; // models/paginate.go: limit := 5

    var orders = clone(SEED);
    var page = 1;

    // models/order.go Take(): total = Σ price × quantity, name = first + " " + last
    function total(o) {
      var t = 0;
      o.items.forEach(function (it) { t += it[1] * it[2]; });
      return t;
    }

    // controllers.Chart: SELECT DATE_FORMAT(create_at) AS date, SUM(price*quantity) GROUP BY date
    function dailySales() {
      var m = {};
      orders.forEach(function (o) {
        o.items.forEach(function (it) { m[o.date] = (m[o.date] || 0) + it[1] * it[2]; });
      });
      return Object.keys(m).sort().map(function (d) { return { date: d, sum: m[d] }; });
    }

    // controllers.CreateFile: one header row, one row per order, one indented row per item
    function toCSV() {
      var rows = [["ID", "Name", "Email", "Product Title", "Price", "Quantity"]];
      orders.forEach(function (o) {
        rows.push([String(o.id), o.first + " " + o.last, o.email, "", "", ""]);
        o.items.forEach(function (it) {
          // the Go casts float32 → int here, so 199.99 exports as 199
          rows.push(["", "", "", it[0], String(Math.trunc(it[1])), String(it[2])]);
        });
      });
      return rows.map(function (r) { return r.join(","); }).join("\n");
    }

    function money(n) { return "$" + n.toFixed(2); }

    function render() {
      // paginated table (models.Paginate)
      var lastPage = Math.ceil(orders.length / LIMIT);
      if (page > lastPage) page = lastPage;
      var slice = orders.slice((page - 1) * LIMIT, page * LIMIT);
      tableBody.innerHTML = "";
      slice.forEach(function (o) {
        var tr = document.createElement("tr");
        tr.innerHTML = "<th></th><td></td><td class='ord-items'></td><td></td>";
        tr.children[0].textContent = "#" + o.id + " · " + o.first + " " + o.last;
        tr.children[1].textContent = o.date;
        tr.children[2].textContent = o.items.map(function (it) { return it[2] + " × " + it[0]; }).join(", ");
        tr.children[3].textContent = money(total(o));
        tableBody.appendChild(tr);
      });
      meta.textContent = JSON.stringify({ total: orders.length, page: page, last_page: lastPage });

      pageSel.innerHTML = "";
      for (var p = 1; p <= lastPage; p++) {
        var opt = document.createElement("option");
        opt.value = p; opt.textContent = "page " + p + " of " + lastPage;
        if (p === page) opt.selected = true;
        pageSel.appendChild(opt);
      }

      // daily sales bars (what the Dashboard hands to c3)
      var sales = dailySales();
      var max = 0;
      sales.forEach(function (s) { if (s.sum > max) max = s.sum; });
      chart.innerHTML = "";
      sales.forEach(function (s) {
        var row = document.createElement("div");
        row.className = "bar";
        row.innerHTML = "<span class='bar__label'></span><span class='bar__track'><span class='bar__fill bar__fill--stack'></span></span><span class='bar__val'></span>";
        row.querySelector(".bar__label").textContent = s.date;
        row.querySelector(".bar__fill").style.width = (100 * s.sum / max).toFixed(1) + "%";
        row.querySelector(".bar__val").textContent = money(s.sum);
        chart.appendChild(row);
      });

      csv.textContent = toCSV();
    }

    addBtn.addEventListener("click", function () {
      var n = orders.length;
      var who = EXTRA_NAMES[n % EXTRA_NAMES.length];
      var last = orders[orders.length - 1].date;
      var d = new Date(last + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1 + Math.floor(Math.random() * 2)); // sometimes the same day twice
      if (Math.random() < 0.4) d = new Date(last + "T12:00:00Z");
      var count = 1 + Math.floor(Math.random() * 3), items = [];
      for (var i = 0; i < count; i++) {
        var it = EXTRA_ITEMS[(n + i * 2) % EXTRA_ITEMS.length];
        items.push([it[0], it[1], 1 + Math.floor(Math.random() * 3)]);
      }
      orders.push({
        id: n + 1, first: who[0], last: who[1],
        email: (who[0] + "." + who[1] + "@example.com").toLowerCase(),
        date: d.toISOString().slice(0, 10), items: items
      });
      page = Math.ceil(orders.length / LIMIT);
      render();
    });
    resetBtn.addEventListener("click", function () { orders = clone(SEED); page = 1; render(); });
    pageSel.addEventListener("change", function () { page = parseInt(pageSel.value, 10); render(); });

    render();
  }

  function clone(a) { return JSON.parse(JSON.stringify(a)); }

  /* ============================================================
     3. Card thumbnail: role × permission matrix
     ============================================================ */
  function drawStrip(canvas) {
    var W = 640, H = 360;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    var cs = getComputedStyle(document.documentElement);
    var bg = cs.getPropertyValue("--bg-sunken").trim() || "#f4f4f2";
    var accent = cs.getPropertyValue("--accent").trim() || "#2f5d50";
    var border = cs.getPropertyValue("--border-strong").trim() || "#d2d2cc";
    var faint = cs.getPropertyValue("--text-faint").trim() || "#86867e";

    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    var roles = ["admin", "editor", "viewer"];
    var left = 110, top = 96, cw = 58, ch = 66, gap = 6;
    ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";

    // column headers: page name over each view/edit pair, then the verb
    ctx.textAlign = "center";
    PAGES.forEach(function (pg, k) {
      var x = left + (2 * k) * (cw + gap) + cw + gap / 2;
      ctx.fillStyle = faint;
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(pg, x, top - 40);
      ctx.font = "500 11px ui-monospace, Menlo, monospace";
      ctx.fillText("view", x - (cw + gap) / 2, top - 18);
      ctx.fillText("edit", x + (cw + gap) / 2, top - 18);
    });

    roles.forEach(function (r, i) {
      var y = top + i * (ch + gap);
      ctx.fillStyle = faint; ctx.textAlign = "right";
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(r, left - 14, y + ch / 2);
      PERMS.forEach(function (p, j) {
        var x = left + j * (cw + gap);
        var on = ROLE_PRESETS[r].indexOf(p) >= 0;
        ctx.fillStyle = on ? accent : "transparent";
        ctx.strokeStyle = border; ctx.lineWidth = 1;
        roundRect(ctx, x, y, cw, ch, 8);
        if (on) ctx.fill(); else ctx.stroke();
        if (on) {
          ctx.strokeStyle = bg; ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x + cw / 2 - 9, y + ch / 2 + 1);
          ctx.lineTo(x + cw / 2 - 2, y + ch / 2 + 8);
          ctx.lineTo(x + cw / 2 + 10, y + ch / 2 - 7);
          ctx.stroke();
        }
      });
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-rbac-lab]").forEach(initRbac);
    document.querySelectorAll("[data-orders-lab]").forEach(initOrders);
    var strips = document.querySelectorAll("[data-rbac-strip]");
    strips.forEach(drawStrip);
    document.addEventListener("themechange", function () { strips.forEach(drawStrip); });
  });
})();
