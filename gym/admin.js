(function () {
  var PASS = "admin123", DAY = 864e5;                       // Demo password. Replace with a real server login.
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var rs = function (n) { return "Rs " + Math.round(n).toLocaleString("en-US"); };
  var short = function (n) { return n >= 1000 ? "Rs " + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : "Rs " + Math.round(n); };
  var fdt = function (t) { return new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }); };
  var PL = FC.PLANS, state = { q: "", status: "all", plan: "all", sort: "new", stype: "all", from: "", to: "" };
  var COLORS = { monthly: "#f06a1c", quarterly: "#efe8da", yearly: "#a79f8f", shop: "#5fa8a0", plan: "#c9a227" };
  var NAMES = { monthly: "Monthly plan", quarterly: "Quarterly plan", yearly: "Yearly plan", shop: "Shop", plan: "Plan builder" };

  function status(m) { if (!m.expires) return "pending"; var l = m.expires - Date.now(); return l < 0 ? "expired" : l <= 7 * DAY ? "expiring" : "active"; }
  function left(m) {
    if (!m.expires) return "Not paid yet";
    var d = (m.expires - Date.now()) / DAY, n = Math.abs(Math.floor(d)) + (d < 0 ? 1 : 0);
    if (d >= 0) return Math.ceil(d) + (Math.ceil(d) === 1 ? " day left" : " days left");
    return n + (n === 1 ? " day ago" : " days ago");
  }
  var badge = function (m) { var s = status(m); return '<span class="badge b-' + s + '">' + s[0].toUpperCase() + s.slice(1) + "</span>"; };
  var monthly = function (p) { return PL[p].price / PL[p].months; };
  function wa(m) {
    var d = String(m.phone).replace(/\D/g, ""); if (d.length === 10 && d[0] === "9") d = "977" + d;
    var s = status(m);
    var msg = "Hi " + m.name.split(" ")[0] + ", " + (s === "expired" ? "your Fitness Club membership expired on " : "your Fitness Club membership expires on ") + new Date(m.expires).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ". Renew at the front desk to keep training.";
    return "https://wa.me/" + d + "?text=" + encodeURIComponent(msg);
  }

  /* ---------- demo data ---------- */
  function seed() {
    if (FC.remote || FC.get("fc_seeded")) return;
    var now = Date.now(), ms = FC.members(), sl = FC.sales();
    var L = [["Aarav Sharma", "monthly", 12, 0], ["Sita Thapa", "monthly", 75, 2], ["Bikash Rai", "monthly", 70, 1], ["Anita Gurung", "quarterly", 40, 0],
      ["Rohan KC", "quarterly", 200, 1], ["Priya Shrestha", "yearly", 150, 0], ["Suman Lama", "monthly", 28, 0], ["Nisha Karki", "monthly", 58, 1],
      ["Kiran Magar", "quarterly", 85, 0], ["Deepak Adhikari", "monthly", 5, 0], ["Mina Tamang", "yearly", 300, 0], ["Sanjay Poudel", "monthly", 160, 4],
      ["Laxmi Bhandari", "quarterly", 10, 0], ["Ramesh Oli", "monthly", 1, 0], ["Gita Khadka", "monthly", 2, -1], ["Manoj Basnet", "yearly", 30, -1]];
    L.forEach(function (r, i) {
      var p = PL[r[1]], pending = r[3] < 0, d = new Date(now - r[2] * (pending ? 36e5 : DAY));
      if (!pending) d.setHours(6 + (i * 3) % 14, (i * 17) % 60, 0, 0);
      var t = Math.min(d.getTime(), now - 36e5);
      var m = { id: FC.uid() + i, name: r[0], phone: "98" + String(10000000 + (i * 3571913) % 80000000), email: r[0].split(" ")[0].toLowerCase() + "@example.com", gender: "", plan: r[1], joined: t, start: pending ? null : t, expires: null };
      if (!pending) {
        var s = t;
        for (var k = 0; k <= r[3]; k++) {
          sl.push({ id: FC.uid() + i + k, ts: s, type: "membership", plan: r[1], amount: p.price, label: p.name + (k ? " renewal" : " membership"), memberId: m.id, memberName: m.name, method: k % 2 ? "eSewa" : "Cash" });
          s = FC.addMonths(s, p.months);
        }
        m.expires = s;
      }
      ms.push(m);
    });
    [[3, 4800, "1 x Whey protein, 1 kg"], [9, 3200, "1 x Lifting belt"], [20, 2400, "1 x Creatine monohydrate, 300 g"], [34, 6900, "1 x Mass gainer, 3 kg"],
     [48, 1400, "1 x Lifting straps, 1 x Shaker bottle"], [70, 2200, "1 x Protein bars, box of 12"], [95, 5300, "1 x Whey protein, 1 kg, 1 x Gloves"], [130, 4800, "1 x Whey protein, 1 kg"]].forEach(function (x, i) {
      sl.push({ id: FC.uid() + "s" + i, ts: now - x[0] * DAY, type: "shop", amount: x[1], label: x[2], customer: { name: ["Aarav Sharma", "Walk-in", "Anita Gurung", "Priya Shrestha"][i % 4], phone: "", address: "Pick up at gym" }, method: i % 2 ? "eSewa" : "Cash on delivery" });
    });
    [2, 6, 15, 27, 41, 80].forEach(function (d, i) { sl.push({ id: FC.uid() + "p" + i, ts: now - d * DAY, type: "plan", amount: 1500, label: "Plan builder", method: "eSewa" }); });
    FC.saveMembers(ms); FC.saveSales(sl); FC.set("fc_seeded", 1);
  }

  /* ---------- overview ---------- */
  function overview() {
    var ms = FC.members(), sl = FC.sales(), now = new Date(), mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime(), tStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var live = ms.filter(function (m) { var s = status(m); return s === "active" || s === "expiring"; });
    var cnt = { expiring: 0, expired: 0, pending: 0 }; ms.forEach(function (m) { var s = status(m); if (cnt[s] !== undefined) cnt[s]++; });
    var thisM = sl.filter(function (x) { return x.ts >= mStart; });
    var sum = function (a, f) { return a.reduce(function (s, x) { return s + (f ? f(x) : x.amount); }, 0); };
    var memRev = sum(thisM.filter(function (x) { return x.type === "membership"; })), shopRev = sum(thisM.filter(function (x) { return x.type === "shop"; })), planRev = sum(thisM.filter(function (x) { return x.type === "plan"; }));
    var mrr = sum(live, function (m) { return monthly(m.plan); });
    var h = '<div class="cards">' +
      '<div class="card"><span>Total members</span><strong>' + ms.length + '</strong><small>' + live.length + ' active, ' + cnt.expired + ' expired, ' + cnt.pending + ' unpaid</small></div>' +
      '<div class="card"><span>Joined this month</span><strong>' + ms.filter(function (m) { return m.joined >= mStart; }).length + '</strong><small>' + ms.filter(function (m) { return m.joined >= tStart; }).length + ' today</small></div>' +
      '<div class="card hot"><span>Collected this month</span><strong>' + rs(memRev + shopRev + planRev) + '</strong><small>Memberships ' + short(memRev) + ', shop ' + short(shopRev) + ', plans ' + short(planRev) + '</small></div>' +
      '<div class="card hot"><span>Monthly income from active members</span><strong>' + rs(mrr) + '</strong><small>Each plan counted as a monthly amount</small></div></div>';

    h += '<h2>Income by subscription</h2><div class="panel scroll"><table class="tbl"><thead><tr><th>Plan</th><th class="r">Price</th><th class="r">Active members</th><th class="r">Monthly income</th><th class="r">Collected this month</th><th class="r">Share</th></tr></thead><tbody>';
    var tm = 0, ta = 0, tc = 0;
    Object.keys(PL).forEach(function (k) {
      var a = live.filter(function (m) { return m.plan === k; }).length, mi = a * monthly(k), col = sum(thisM.filter(function (x) { return x.type === "membership" && x.plan === k; }));
      tm += mi; ta += a; tc += col;
      h += '<tr><td>' + PL[k].name + '<span class="sub">' + PL[k].months + (PL[k].months === 1 ? ' month' : ' months') + '</span></td><td class="r">' + rs(PL[k].price) + '</td><td class="r">' + a + '</td><td class="r">' + rs(mi) + '</td><td class="r">' + rs(col) + '</td><td class="r">' + (mrr ? Math.round(mi / mrr * 100) : 0) + '%</td></tr>';
    });
    h += '</tbody><tfoot><tr><td>Total</td><td></td><td class="r">' + ta + '</td><td class="r">' + rs(tm) + '</td><td class="r">' + rs(tc) + '</td><td class="r">100%</td></tr></tfoot></table>' +
      '<p class="demo" style="margin-top:.8rem">Monthly income spreads each plan over its months: quarterly counts as one third per month, yearly as one twelfth. Collected this month is the cash received since the 1st.</p></div>';

    h += '<div class="split"><div><h2>Income, last 6 months</h2><div class="panel">' + chart(sl) + '</div></div>' +
      '<div><h2>Needs attention</h2><div class="panel">' + attention(ms) + '</div></div></div>';
    $("#tab-overview").innerHTML = h;
  }

  function chart(sl) {
    var months = [], n = new Date();
    for (var i = 5; i >= 0; i--) { var d = new Date(n.getFullYear(), n.getMonth() - i, 1); months.push({ s: d.getTime(), e: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(), l: d.toLocaleString("en-GB", { month: "short" }), v: {}, t: 0 }); }
    sl.forEach(function (x) { var k = x.type === "membership" ? x.plan : x.type; months.forEach(function (m) { if (x.ts >= m.s && x.ts < m.e) { m.v[k] = (m.v[k] || 0) + x.amount; m.t += x.amount; } }); });
    var max = Math.max.apply(null, months.map(function (m) { return m.t; }).concat(1)), h = '<div class="plot">';
    months.forEach(function (m) {
      var segs = Object.keys(COLORS).filter(function (k) { return m.v[k]; }).map(function (k) { return '<div title="' + NAMES[k] + ': ' + rs(m.v[k]) + '" style="flex:' + m.v[k] + ' 0 0;background:' + COLORS[k] + '"></div>'; }).join("");
      h += '<div class="col"><div class="area"><span class="tot">' + short(m.t) + '</span><div class="stack" style="height:' + (m.t / max * 85) + '%">' + segs + '</div></div><span>' + m.l + '</span></div>';
    });
    h += '</div><div class="legend">' + Object.keys(COLORS).map(function (k) { return '<span><i style="background:' + COLORS[k] + '"></i>' + NAMES[k] + '</span>'; }).join("") + '</div>';
    return h;
  }

  function attention(ms) {
    var rows = ms.filter(function (m) { var s = status(m); return s === "expiring" || (s === "expired" && Date.now() - m.expires < 30 * DAY); }).sort(function (a, b) { return a.expires - b.expires; });
    var pend = ms.filter(function (m) { return status(m) === "pending"; });
    if (!rows.length && !pend.length) return '<p class="empty">Nobody needs a reminder right now.</p>';
    var li = function (m, extra) { return '<li><div><strong>' + esc(m.name) + '</strong><span class="sub">' + PL[m.plan].name + ', ' + left(m) + '</span></div><div class="acts">' + extra + '</div></li>'; };
    return '<ul class="list">' + pend.map(function (m) { return li(m, '<button class="mini go" data-act="pay" data-id="' + m.id + '">Mark paid</button>'); }).join("") +
      rows.map(function (m) { return li(m, '<a class="mini" target="_blank" rel="noopener" href="' + wa(m) + '">Remind</a><button class="mini go" data-act="pay" data-id="' + m.id + '">Renew</button>'); }).join("") + '</ul>';
  }

  /* ---------- members ---------- */
  function members() {
    var ms = FC.members();
    var q = state.q.toLowerCase();
    var rows = ms.filter(function (m) {
      return (state.status === "all" || status(m) === state.status) && (state.plan === "all" || m.plan === state.plan) &&
        (!q || (m.name + " " + m.phone + " " + m.email).toLowerCase().indexOf(q) > -1);
    }).sort(function (a, b) { return state.sort === "new" ? b.joined - a.joined : (a.expires || 9e15) - (b.expires || 9e15); });
    var opt = function (arr, cur) { return arr.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>"; }).join(""); };
    var h = '<div class="toolbar"><input id="q" type="search" placeholder="Search name, phone or email" value="' + esc(state.q) + '" aria-label="Search members">' +
      '<select id="f-status" aria-label="Status">' + opt([["all", "All statuses"], ["active", "Active"], ["expiring", "Expiring in 7 days"], ["expired", "Expired"], ["pending", "Not paid yet"]], state.status) + '</select>' +
      '<select id="f-plan" aria-label="Plan">' + opt([["all", "All plans"], ["monthly", "Monthly"], ["quarterly", "Quarterly"], ["yearly", "Yearly"]], state.plan) + '</select>' +
      '<select id="f-sort" aria-label="Sort">' + opt([["new", "Newest first"], ["exp", "Expiring soonest"]], state.sort) + '</select><span class="sp"></span>' +
      '<button class="btn" id="csv" type="button">Export CSV</button><button class="btn solid" id="add" type="button">Add member</button></div>' +
      '<p class="sub" style="margin-bottom:.75rem">' + rows.length + ' of ' + ms.length + ' members</p>';
    if (!rows.length) { $("#tab-members").innerHTML = h + '<p class="empty">No members match.</p>'; bindMembers(); return; }
    h += '<div class="panel scroll"><table class="tbl"><thead><tr><th>Member</th><th>Plan</th><th>Joined</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    rows.forEach(function (m) {
      h += '<tr><td><strong>' + esc(m.name) + '</strong><span class="sub">' + esc(m.phone) + (m.email ? ' &middot; ' + esc(m.email) : '') + '</span></td><td>' + PL[m.plan].name + '</td><td>' + fdt(m.joined) + '</td>' +
        '<td>' + (m.expires ? fdt(m.expires) : '<span class="sub">Starts when paid</span>') + '<span class="sub">' + left(m) + '</span></td><td>' + badge(m) + '</td><td><div class="acts">' +
        '<button class="mini" data-m="profile" data-id="' + m.id + '">Profile</button>' +
        '<button class="mini go" data-act="pay" data-id="' + m.id + '">' + (m.expires ? 'Renew' : 'Mark paid') + '</button>' +
        (m.expires ? '<a class="mini" target="_blank" rel="noopener" href="' + wa(m) + '">Remind</a>' : '') +
        '<button class="mini del" data-act="del" data-id="' + m.id + '">Delete</button></div></td></tr>';
    });
    $("#tab-members").innerHTML = h + '</tbody></table></div>'; bindMembers();
  }
  function bindMembers() {
    var keep = function (id, key) { $(id).onchange = function () { state[key] = this.value; members(); }; };
    keep("#f-status", "status"); keep("#f-plan", "plan"); keep("#f-sort", "sort");
    $("#q").oninput = function () { state.q = this.value; var p = this.selectionStart; members(); var q = $("#q"); q.focus(); q.setSelectionRange(p, p); };
    $("#add").onclick = function () { $("#add-dlg").showModal(); };
    $("#csv").onclick = exportCsv;
  }
  function exportCsv() {
    var cell = function (v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var tn = {}; FC.trainers().forEach(function (t) { tn[t.id] = t.name; });
    var rows = [["Name", "Phone", "Email", "Gender", "Date of birth", "Goal", "Experience", "Heard about us", "Trainer", "Emergency contact", "Plan", "Joined", "Expires", "Status"]].concat(FC.members().map(function (m) { return [m.name, m.phone, m.email, m.gender, m.dob, m.goal, m.experience, m.source, tn[m.trainerId] || "", m.emergency, PL[m.plan].name, new Date(m.joined).toISOString(), m.expires ? new Date(m.expires).toISOString() : "", status(m)]; }));
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.map(function (r) { return r.map(cell).join(","); }).join("\n")], { type: "text/csv" }));
    a.download = "members.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  /* ---------- sales ---------- */
  function sales() {
    var all = FC.sales().sort(function (a, b) { return b.ts - a.ts; }), rows = all.filter(function (x) {
      return (state.stype === "all" || x.type === state.stype) && (!state.from || x.ts >= new Date(state.from + "T00:00:00").getTime()) && (!state.to || x.ts < new Date(state.to + "T00:00:00").getTime() + DAY);
    });
    var total = rows.reduce(function (s, x) { return s + x.amount; }, 0);
    var h = '<div class="toolbar"><select id="s-type" aria-label="Type">' + [["all", "All sales"], ["membership", "Memberships"], ["shop", "Shop orders"], ["plan", "Plan builder"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === state.stype ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
      '</select><label class="sub">From <input id="s-from" type="date" value="' + state.from + '"></label><label class="sub">To <input id="s-to" type="date" value="' + state.to + '"></label><span class="sp"></span><strong>' + rows.length + ' sales, ' + rs(total) + '</strong><button class="btn" id="s-csv" type="button">Export CSV</button></div>';
    if (!rows.length) { $("#tab-sales").innerHTML = h + '<p class="empty">No sales match.</p>'; bindSales(rows); return; }
    h += '<div class="panel scroll"><table class="tbl"><thead><tr><th>Date and time</th><th>Type</th><th>Details</th><th>Paid by</th><th class="r">Amount</th></tr></thead><tbody>';
    rows.forEach(function (x) {
      var who = x.type === "membership" ? esc(x.memberName) : x.type === "shop" ? esc((x.customer && x.customer.name) || "") + (x.customer && x.customer.phone ? '<span class="sub">' + esc(x.customer.phone) + '</span>' : '') : "Website visitor";
      h += '<tr><td>' + fdt(x.ts) + '</td><td>' + (x.type === "membership" ? "Membership" : x.type === "shop" ? "Shop" : "Plan builder") + '</td><td>' + esc(x.label) + '<span class="sub">' + who + '</span></td><td>' + esc(x.method || "") + '</td><td class="r">' + rs(x.amount) + '</td></tr>';
    });
    $("#tab-sales").innerHTML = h + '</tbody></table></div>' + (FC.remote ? "" : '<p style="margin-top:1.5rem"><button class="mini del" id="reset" type="button">Reset demo data</button></p>');
    bindSales(rows);
    if ($("#reset")) $("#reset").onclick = function () { if (confirm("Delete all members and sales in this browser?")) { ["fc_members", "fc_sales", "fc_seeded", "fc_seeded2", "fc_trainers", "fc_classes", "fc_bookings", "fc_checkins"].forEach(function (k) { localStorage.removeItem(k); }); init(); } };
  }

  function bindSales(rows) {
    $("#s-type").onchange = function () { state.stype = this.value; sales(); };
    $("#s-from").onchange = function () { state.from = this.value; sales(); };
    $("#s-to").onchange = function () { state.to = this.value; sales(); };
    $("#s-csv").onclick = function () { exportSales(rows); };
  }
  function exportSales(rows) {
    var cell = function (v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var out = [["Date and time", "Type", "Details", "Paid by", "Phone", "Method", "Amount (Rs)"]].concat(rows.map(function (x) {
      var c = x.customer || {};
      return [new Date(x.ts).toISOString(), x.type, x.label, x.type === "membership" ? x.memberName : c.name || "", c.phone || "", x.method || "", x.amount];
    }));
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([out.map(function (r) { return r.map(cell).join(","); }).join("\n")], { type: "text/csv" }));
    a.download = "sales.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  /* ---------- wiring ---------- */
  function renderAll() { overview(); members(); sales(); if (window.FCMore) FCMore.render(); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "pay") { FC.pay(b.dataset.id); renderAll(); }
    if (b.dataset.act === "del" && confirm("Delete this member? Their past payments stay in Sales.")) { FC.saveMembers(FC.members().filter(function (m) { return m.id !== b.dataset.id; })); renderAll(); }
  });
  document.querySelector(".tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    this.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    ["overview", "members", "sales", "schedule", "trainers", "checkin"].forEach(function (t) { $("#tab-" + t).hidden = t !== b.dataset.tab; });
    // Server mode: pick up new website sign-ups and orders each time you change tab.
    if (FC.remote) FC.refresh().then(renderAll, renderAll); else renderAll();
  });
  $("#a-plan").innerHTML = Object.keys(PL).map(function (k) { return '<option value="' + k + '">' + PL[k].name + " (" + rs(PL[k].price) + ")</option>"; }).join("");
  $("#a-cancel").onclick = function () { $("#add-dlg").close(); };
  $("#add-form").addEventListener("submit", function () {
    var m = FC.addMember({ name: $("#a-name").value.trim(), phone: $("#a-phone").value.trim(), email: $("#a-email").value.trim(), plan: $("#a-plan").value });
    if (m.dup) { alert(m.name + " is already registered with this phone number. Open their Profile or Renew them instead."); this.reset(); return; }
    if ($("#a-paid").checked) FC.pay(m.id);
    this.reset(); renderAll();
  });
  window.FCAdminRender = renderAll;
  function init() { seed(); renderAll(); }
  function open() { $("#gate").hidden = true; $("#app").hidden = false; if (FC.remote) { FC.admin = true; $("#refresh").hidden = false; } init(); }
  function startRemote() { return FC.load().then(open); }
  $("#gate-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#gate-err"); err.textContent = "";
    if (FC.remote) {
      FC.login($("#user").value, $("#pw").value).then(function (j) {
        if (!j.ok) { err.textContent = j.error || "Could not log in."; return; }
        $("#pw").value = ""; return startRemote();
      }).catch(function () { err.textContent = "Cannot reach the server."; });
      return;
    }
    if ($("#pw").value === PASS) { try { sessionStorage.setItem("fc_admin", "1"); } catch (x) {} open(); } else { err.textContent = "Wrong password."; }
  });
  $("#logout").onclick = function () {
    if (FC.remote) { FC.logout().then(function () { location.reload(); }, function () { location.reload(); }); return; }
    try { sessionStorage.removeItem("fc_admin"); } catch (x) {} location.reload();
  };
  $("#refresh").onclick = function () { FC.refresh().then(renderAll, function (j) { $("#sync").textContent = (j && j.error) || "Could not refresh."; }); };
  window.addEventListener("fc-sync", function (e) {
    var el = $("#sync"), d = e.detail; el.className = "sub" + (d.state === "error" ? " err" : "");
    el.textContent = d.state === "saving" ? "Saving..." : d.state === "saved" ? "All changes saved" : d.msg + " Press Refresh to reload the saved data.";
  });
  if (FC.remote) {
    $("#u-field").hidden = false; $("#user").required = true;
    $("#gate-note").textContent = "Log in with the username and password you created on the server.";
    FC.me().then(function (j) { if (j.ok) return startRemote(); }).catch(function () {});
  } else {
    try { if (sessionStorage.getItem("fc_admin")) open(); } catch (x) {}
  }
})();
