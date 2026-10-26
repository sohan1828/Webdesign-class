/* Shared data for the site and the admin panel.
   Demo storage: the browser's localStorage. Replace these functions with calls to your server when you have a backend. */
var FC = (function () {
  var PLANS = {
    monthly:   { name: "Monthly",   price: 2500,  months: 1 },
    quarterly: { name: "Quarterly", price: 6500,  months: 3 },
    yearly:    { name: "Yearly",    price: 22000, months: 12 }
  };
  function get(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function addMonths(ts, n) { var d = new Date(ts); d.setMonth(d.getMonth() + n); return d.getTime(); }

  var api = {
    PLANS: PLANS, get: get, set: set, uid: uid, addMonths: addMonths,
    members: function () { return get("fc_members", []); },
    saveMembers: function (v) { set("fc_members", v); },
    sales: function () { return get("fc_sales", []); },
    saveSales: function (v) { set("fc_sales", v); },
    trainers: function () { return get("fc_trainers", []); },
    saveTrainers: function (v) { set("fc_trainers", v); },
    classes: function () { return get("fc_classes", []); },
    saveClasses: function (v) { set("fc_classes", v); },
    bookings: function () { return get("fc_bookings", []); },
    saveBookings: function (v) { set("fc_bookings", v); },
    checkins: function () { return get("fc_checkins", []); },
    saveCheckins: function (v) { set("fc_checkins", v); },
    addSale: function (s) { var all = api.sales(); s.id = uid(); s.ts = s.ts || Date.now(); all.push(s); api.saveSales(all); return s; },
    addMember: function (o) {
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
  return api;
})();
