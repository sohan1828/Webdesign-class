/* Shared data for the site and the admin panel.
   Two modes, chosen by fc-config.js:
   - Demo (FC_API empty): everything is kept in this browser's localStorage.
   - Server (FC_API = "api/"): the PHP and MySQL backend in /api keeps the data. Visitors post sign-ups and orders to it,
     and the admin loads everything after a real login and sends back only what changed. */
var FC = (function () {
  var PLANS = {
    monthly:   { name: "Monthly",   price: 2500,  months: 1 },
    quarterly: { name: "Quarterly", price: 6500,  months: 3 },
    yearly:    { name: "Yearly",    price: 22000, months: 12 }
  };
  function get(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  // Adds calendar months and keeps the day inside the target month (31 Jan + 1 month = 28 or 29 Feb, not early March).
  function addMonths(ts, n) {
    var d = new Date(ts), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d.getTime();
  }
  // Phone numbers compared by their last 10 digits, so 9841234567, 984-1234567 and +977 9841234567 match.
  function normPhone(p) { var d = String(p || "").replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; }
  function money(n) { return "Rs " + Math.round(n).toLocaleString("en-US"); }

  var API = (typeof window !== "undefined" && window.FC_API) || "";
  var remote = !!API, csrf = "", chain = Promise.resolve(), pending = 0;
  var cache = { members: [], sales: [], trainers: [], classes: [], bookings: [], checkins: [] }, snap = {};
  var KEYS = { members: "fc_members", sales: "fc_sales", trainers: "fc_trainers", classes: "fc_classes", bookings: "fc_bookings", checkins: "fc_checkins" };
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  var snapOf = function (arr) { var o = {}; arr.forEach(function (x) { o[x.id] = JSON.stringify(x); }); return o; };
  function emit(state, msg) { try { window.dispatchEvent(new CustomEvent("fc-sync", { detail: { state: state, msg: msg || "" } })); } catch (e) {} }
  function call(path, body) {
    var h = { "Content-Type": "application/json" };
    if (csrf && body) h["X-CSRF-Token"] = csrf;
    return fetch(API + path, { method: body ? "POST" : "GET", headers: h, credentials: "same-origin", body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "The server sent a bad reply" }; }).then(function (j) { j.status = r.status; return j; }); });
  }
  // Server mode: reads come from a copy loaded at login, writes send only the records that changed (or were deleted) since the last save.
  function read(c) { return remote ? clone(cache[c]) : get(KEYS[c], []); }
  function write(c, arr) {
    if (!remote) { set(KEYS[c], arr); return; }
    var old = snap[c] || {}, now = snapOf(arr);
    var up = arr.filter(function (x) { return old[x.id] !== now[x.id]; }), del = Object.keys(old).filter(function (id) { return !(id in now); });
    cache[c] = clone(arr); snap[c] = now;
    if (!up.length && !del.length) return;
    pending++; emit("saving");
    chain = chain.then(function () { return call("admin.php", { action: "save", collection: c, upserts: up, deletes: del }); })
      .then(function (j) { pending--; if (j.ok) emit(pending ? "saving" : "saved"); else emit("error", j.error || "Could not save."); })
      .catch(function () { pending--; emit("error", "Cannot reach the server."); });
  }

  var api = {
    PLANS: PLANS, get: get, set: set, uid: uid, addMonths: addMonths, remote: remote, admin: false,
    members: function () { return read("members"); },
    saveMembers: function (v) { write("members", v); },
    sales: function () { return read("sales"); },
    saveSales: function (v) { write("sales", v); },
    trainers: function () { return read("trainers"); },
    saveTrainers: function (v) { write("trainers", v); },
    classes: function () { return read("classes"); },
    saveClasses: function (v) { write("classes", v); },
    bookings: function () { return read("bookings"); },
    saveBookings: function (v) { write("bookings", v); },
    checkins: function () { return read("checkins"); },
    saveCheckins: function (v) { write("checkins", v); },
    // Server mode only: login, session check, load, refresh, logout.
    login: function (u, p) { return call("login.php", { username: u, password: p }).then(function (j) { if (j.ok) csrf = j.csrf; return j; }); },
    me: function () { return call("me.php").then(function (j) { if (j.ok) csrf = j.csrf; return j; }); },
    logout: function () { return call("logout.php", {}).then(function () { csrf = ""; }); },
    load: function () {
      return call("admin.php?action=bootstrap").then(function (j) {
        if (!j.ok) throw j;
        Object.keys(cache).forEach(function (c) { cache[c] = j[c] || []; snap[c] = snapOf(cache[c]); });
        return j;
      });
    },
    refresh: function () { return pending ? chain.then(api.load) : api.load(); },
    pendingWrites: function () { return pending; },
    addSale: function (s) {
      if (remote && !api.admin) { // visitor on the public site: send the order to the server
        return call("order.php", { type: s.type, amount: s.amount, label: s.label, method: s.method, customer: s.customer || {} }).catch(function () { return { ok: false }; });
      }
      var all = api.sales(); if (!s.memberId && s.customer && s.customer.phone) { var m = api.findByPhone(s.customer.phone); if (m) s.memberId = m.id; } s.id = uid(); s.ts = s.ts || Date.now(); all.push(s); api.saveSales(all); return s;
    },
    normPhone: normPhone, money: money,
    findByPhone: function (p) { var n = normPhone(p); return n ? api.members().filter(function (m) { return normPhone(m.phone) === n; })[0] : null; },
    // Returns the new member. If the phone number is already registered it returns that member with dup: true and adds nobody.
    addMember: function (o) {
      if (remote && !api.admin) { // visitor on the public site: send the sign-up to the server (it replies the same whether or not the number exists)
        return call("join.php", { name: o.name, phone: o.phone, email: o.email, gender: o.gender, plan: o.plan, program: o.program, goal: o.goal, experience: o.experience, source: o.source, dob: o.dob, website: o.website || "" })
          .then(function (j) { if (!j.ok) throw new Error(j.error || "Could not send"); return { dup: false }; });
      }
      var same = api.findByPhone(o.phone);
      if (same) { var c = JSON.parse(JSON.stringify(same)); c.dup = true; return c; }
      var all = api.members();
      var m = { id: uid(), name: o.name, phone: o.phone, email: o.email || "", gender: o.gender || "", plan: o.plan in PLANS ? o.plan : "monthly", joined: Date.now(), start: null, expires: null,
        goal: o.goal || "", experience: o.experience || "", source: o.source || "", program: o.program || "", dob: o.dob || "", emergency: o.emergency || "", health: "", notes: "", trainerId: "" };
      all.push(m); api.saveMembers(all); return m;
    },
    // Records a payment and starts or extends the membership.
    pay: function (id, method) {
      var all = api.members(), m = all.filter(function (x) { return x.id === id; })[0];
      if (!m) return;
      var p = PLANS[m.plan], now = Date.now(), isNew = !m.expires, live = m.expires && m.expires > now;
      if (!live) m.start = now;
      m.expires = addMonths(live ? m.expires : now, p.months);
      api.saveMembers(all);
      api.addSale({ type: "membership", plan: m.plan, amount: p.price, label: p.name + (isNew ? " membership" : " renewal"), memberId: m.id, memberName: m.name, method: method || "Cash" });
    }
  };
  // Fills prices on any page from PLANS, so a price is only ever typed in this file.
  // <el data-price="monthly"> gets "Rs 2,500"; <el data-save="quarterly"> gets the per-month and saving text;
  // <select data-plan-select> gets one option per plan.
  api.bindPrices = function () {
    var per = function (k) { return Math.round(PLANS[k].price / PLANS[k].months / 10) * 10; };
    [].forEach.call(document.querySelectorAll("[data-price]"), function (el) { el.textContent = money(PLANS[el.getAttribute("data-price")].price); });
    [].forEach.call(document.querySelectorAll("[data-save]"), function (el) {
      var k = el.getAttribute("data-save"), p = PLANS[k], save = PLANS.monthly.price * p.months - p.price;
      el.textContent = "About " + money(per(k)) + " a month. You save " + money(save) + ".";
    });
    [].forEach.call(document.querySelectorAll("[data-plan-select]"), function (sel) {
      sel.innerHTML = Object.keys(PLANS).map(function (k) { return '<option value="' + k + '">' + PLANS[k].name + ", " + money(PLANS[k].price) + "</option>"; }).join("");
    });
  };
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", api.bindPrices); else api.bindPrices(); }
  return api;
})();
