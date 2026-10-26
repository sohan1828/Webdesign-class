/* Member account (account.html) and trainer page (trainer.html).
   Each page asks one "adapter" for its data. In demo mode the adapter reads this browser's data; in server mode it calls
   api/member.php or api/trainer.php, which check the login and apply the booking rules on the server. */
(function () {
  var DAY = 864e5, PL = FC.PLANS;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var DN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var GOALS = { lose: "Lose weight", gain: "Build muscle or gain weight", fit: "General fitness", strength: "Get stronger", sport: "Sport performance", rehab: "Recovery and health" };
  var EXP = { "new": "Complete beginner", some: "Some experience", exp: "Experienced" };
  var dkey = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var parse = function (k) { return new Date(k + "T00:00:00"); };
  var t12 = function (t) { var p = t.split(":"), h = +p[0]; return (h % 12 || 12) + ":" + p[1] + (h < 12 ? " am" : " pm"); };
  var fdate = function (t) { return new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
  var cstart = function (c, date) { var p = c.time.split(":"), d = parse(date); d.setHours(+p[0], +p[1]); return d.getTime(); };
  var live = function (m) { return m.expires && m.expires > Date.now(); };
  function wa(phone, msg) { var d = String(phone).replace(/\D/g, ""); if (d.length === 10 && d[0] === "9") d = "977" + d; return "https://wa.me/" + d + "?text=" + encodeURIComponent(msg); }
  function mySession() { try { return JSON.parse(sessionStorage.getItem("fc_session")); } catch (e) { return null; } }
  var done = function (o) { return Promise.resolve(o); };
  var NO = { ok: false, error: "Please log in again." };

  /* ---------- demo-mode adapters (same data shapes as the PHP endpoints) ---------- */
  function publicClasses() {
    var tn = {}; FC.trainers().forEach(function (t) { tn[t.id] = t.name; });
    return FC.classes().map(function (c) { c.trainerName = tn[c.trainerId] || ""; return c; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
  }
  function localMember() {
    var s = mySession(); if (!s || s.role !== "member") return done(NO);
    var m = FC.members().filter(function (x) { return x.id === s.memberId; })[0]; if (!m) return done(NO);
    var t = FC.trainers().filter(function (x) { return x.id === m.trainerId; })[0], today = dkey(new Date()), last = dkey(new Date(Date.now() + 13 * DAY)), counts = {};
    FC.bookings().forEach(function (b) { if (b.date >= today && b.date <= last) counts[b.classId + "|" + b.date] = (counts[b.classId + "|" + b.date] || 0) + 1; });
    var ck = FC.checkins().filter(function (k) { return k.memberId === m.id; });
    return done({ ok: true, now: Date.now(), member: { name: m.name, phone: m.phone, plan: m.plan, start: m.start, expires: m.expires, goal: m.goal, experience: m.experience },
      trainer: t ? { name: t.name, specialty: t.specialty, hours: t.hours } : null, classes: publicClasses(),
      bookings: FC.bookings().filter(function (b) { return b.memberId === m.id && b.date >= today; }).map(function (b) { return { id: b.id, classId: b.classId, date: b.date }; }),
      counts: counts, visits30: ck.filter(function (k) { return k.ts > Date.now() - 30 * DAY; }).length, lastVisit: ck.length ? Math.max.apply(null, ck.map(function (k) { return k.ts; })) : null });
  }
  function localBook(cid, date) {
    var s = mySession(); if (!s || s.role !== "member") return done(NO);
    var m = FC.members().filter(function (x) { return x.id === s.memberId; })[0], c = FC.classes().filter(function (x) { return x.id === cid; })[0];
    if (!m || !c || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return done({ ok: false, error: "Session not found" });
    var today = dkey(new Date()), last = dkey(new Date(Date.now() + 13 * DAY));
    if (date < today || date > last) return done({ ok: false, error: "You can book from today up to two weeks ahead." });
    if (c.days.indexOf(parse(date).getDay()) < 0) return done({ ok: false, error: "That session does not run on that day." });
    var start = cstart(c, date);
    if (start <= Date.now()) return done({ ok: false, error: "That session has already started." });
    if (!m.expires || m.expires < start) return done({ ok: false, error: "Your membership is not active for that session. Please contact the gym to renew." });
    var all = FC.bookings();
    if (all.some(function (b) { return b.classId === cid && b.date === date && b.memberId === m.id; })) return done({ ok: false, error: "You are already booked on this session." });
    if (all.filter(function (b) { return b.classId === cid && b.date === date; }).length >= c.cap) return done({ ok: false, error: "This session is full." });
    var bk = { id: FC.uid(), classId: cid, date: date, memberId: m.id }; all.push(bk); FC.saveBookings(all); return done({ ok: true, id: bk.id });
  }
  function localCancel(id) {
    var s = mySession(); if (!s) return done(NO);
    var all = FC.bookings(), b = all.filter(function (x) { return x.id === id && x.memberId === s.memberId; })[0];
    if (!b) return done({ ok: false, error: "Booking not found" });
    var c = FC.classes().filter(function (x) { return x.id === b.classId; })[0];
    if (c && cstart(c, b.date) <= Date.now()) return done({ ok: false, error: "That session has already started." });
    FC.saveBookings(all.filter(function (x) { return x.id !== id; })); return done({ ok: true });
  }
  function localPassword(cur, next) {
    var s = mySession(), l = FC.get("fc_logins", { members: {}, trainers: {} });
    if (next.length < 8) return done({ ok: false, error: "The new password needs at least 8 characters." });
    if (!s || l.members[s.memberId] !== cur) return done({ ok: false, error: "Your current password is not right." });
    l.members[s.memberId] = next; FC.set("fc_logins", l); return done({ ok: true });
  }
  function localTrainer() {
    var s = mySession(); if (!s || s.role !== "trainer") return done(NO);
    var t = FC.trainers().filter(function (x) { return x.id === s.trainerId; })[0]; if (!t) return done({ ok: false, error: "Trainer record not found" });
    var ck = FC.checkins(), members = FC.members(), byId = {}; members.forEach(function (m) { byId[m.id] = m; });
    var clients = members.filter(function (m) { return m.trainerId === t.id; }).map(function (m) {
      var mine = ck.filter(function (k) { return k.memberId === m.id; });
      return { id: m.id, name: m.name, phone: m.phone, plan: m.plan, start: m.start, expires: m.expires, goal: m.goal, experience: m.experience, dob: m.dob, gender: m.gender, health: m.health, emergency: m.emergency,
        trainerNotes: m.trainerNotes || "", visits30: mine.filter(function (k) { return k.ts > Date.now() - 30 * DAY; }).length, lastVisit: mine.length ? Math.max.apply(null, mine.map(function (k) { return k.ts; })) : null };
    });
    var mine = publicClasses().filter(function (c) { return c.trainerId === t.id; }), roster = [], bks = FC.bookings();
    for (var i = 0; i < 7; i++) {
      var d = new Date(Date.now() + i * DAY), k = dkey(d);
      mine.forEach(function (c) { if (c.days.indexOf(d.getDay()) > -1) roster.push({ classId: c.id, date: k, members: bks.filter(function (b) { return b.classId === c.id && b.date === k && byId[b.memberId]; }).map(function (b) { return { name: byId[b.memberId].name, phone: byId[b.memberId].phone }; }) }); });
    }
    return done({ ok: true, now: Date.now(), trainer: { name: t.name, specialty: t.specialty, hours: t.hours, years: t.years }, clients: clients, classes: mine, roster: roster });
  }
  function localNote(id, note) {
    var s = mySession(), all = FC.members(), m = all.filter(function (x) { return x.id === id && s && x.trainerId === s.trainerId; })[0];
    if (!m) return done({ ok: false, error: "That is not one of your clients." });
    m.trainerNotes = note.slice(0, 2000); FC.saveMembers(all); return done({ ok: true });
  }
  var R = FC.remote, call = FC._call;
  var A = {
    member: function () { return R ? call("member.php") : localMember(); },
    book: function (c, d) { return R ? call("member.php", { action: "book", classId: c, date: d }) : localBook(c, d); },
    cancel: function (id) { return R ? call("member.php", { action: "cancel", bookingId: id }) : localCancel(id); },
    password: function (a, b) { return R ? call("member.php", { action: "password", current: a, next: b }) : localPassword(a, b); },
    trainer: function () { return R ? call("trainer.php") : localTrainer(); },
    note: function (id, n) { return R ? call("trainer.php", { action: "note", memberId: id, note: n }) : localNote(id, n); }
  };

  /* ---------- shared page bits ---------- */
  function guard(role, load, draw) {
    FC.session().then(function (s) {
      if (!s.ok || s.role !== role) { location.replace("login.html"); return; }
      load();
    }, function () { $("#msg").textContent = "Cannot reach the server."; });
    $("#logout").onclick = function () { FC.signout().then(function () { location.replace("login.html"); }); };
  }
  function say(t, bad) { var m = $("#msg"); m.textContent = t || ""; m.className = bad ? "err" : ""; }
  function fail(j) { if (j && (j.status === 401 || j.status === 403) && /log in|expired/i.test(j.error || "")) { location.replace("login.html"); return; } say((j && j.error) || "Something went wrong.", true); }
  function stat(m) { if (!m.expires) return "pending"; var l = m.expires - Date.now(); return l < 0 ? "expired" : l <= 7 * DAY ? "expiring" : "active"; }
  var badge = function (m) { var s = stat(m); return '<span class="badge b-' + s + '">' + (s === "pending" ? "Not started" : s[0].toUpperCase() + s.slice(1)) + "</span>"; };

  /* ---------- member account ---------- */
  var M = { data: null, off: 0 };
  function memberLoad() { A.member().then(function (j) { if (!j.ok) { fail(j); return; } M.data = j; memberDraw(); }, function () { say("Cannot reach the server.", true); }); }
  function memberDraw() {
    var d = M.data, m = d.member, t = d.trainer, ok = live(m), left = ok ? Math.ceil((m.expires - Date.now()) / DAY) : 0;
    $("#who").textContent = m.name;
    var sum = !m.expires ? "Not started yet. Pay at the front desk to start your membership." : ok ? "Until " + fdate(m.expires) + ", " + left + " day" + (left === 1 ? "" : "s") + " left" : "Ended " + fdate(m.expires) + ". Ask at the front desk to renew.";
    var h = '<div class="cards" style="grid-template-columns:repeat(3,1fr)"><div class="card"><span>Membership</span><strong>' + esc(PL[m.plan] ? PL[m.plan].name : m.plan) + "</strong>" + badge(m) + '<small style="display:block;margin-top:.4rem">' + esc(sum) + '</small></div>' +
      '<div class="card"><span>Visits in the last 30 days</span><strong>' + d.visits30 + "</strong><small>" + (d.lastVisit ? "Last visit " + fdate(d.lastVisit) : "No visits yet") + '</small></div>' +
      '<div class="card"><span>Your trainer</span><strong style="font-size:1.6rem">' + (t ? esc(t.name) : "Not assigned") + "</strong><small>" + (t ? esc(t.specialty) + (t.hours ? ", " + esc(t.hours) : "") : "Ask the front desk about personal coaching") + "</small></div></div>";
    h += '<h2>Book a session</h2><p class="sub" style="margin:-.5rem 0 .75rem">' + (ok ? "You can book up to two weeks ahead and cancel any time before a session starts." : "Booking opens when your membership is active.") + '</p>' +
      '<div class="wk"><button class="mini" type="button" data-p="0"' + (M.off === 0 ? " disabled" : "") + '>This week</button><button class="mini" type="button" data-p="7"' + (M.off === 7 ? " disabled" : "") + ">Next week</button></div>";
    var mine = {}; d.bookings.forEach(function (b) { mine[b.classId + "|" + b.date] = b.id; });
    var anyDay = false;
    for (var i = M.off; i < M.off + 7; i++) {
      var dt = new Date(Date.now() + i * DAY), k = dkey(dt), list = d.classes.filter(function (c) { return c.days.indexOf(dt.getDay()) > -1; });
      if (!list.length) continue; anyDay = true;
      h += '<div class="day-h' + (i === 0 ? " today" : "") + '">' + DN[dt.getDay()] + "<small>" + dt.getDate() + " " + dt.toLocaleString("en-GB", { month: "short" }) + (i === 0 ? ", today" : "") + "</small></div>";
      list.forEach(function (c) {
        var key = c.id + "|" + k, n = d.counts[key] || 0, left = c.cap - n, start = cstart(c, k), booked = mine[key], btn;
        if (booked) btn = start > Date.now() ? '<button class="mini del" type="button" data-cancel="' + booked + '">Cancel booking</button>' : '<span class="badge">Booked</span>';
        else if (start <= Date.now()) btn = '<span class="sub">Started</span>';
        else if (!m.expires || m.expires < start) btn = '<span class="sub">Membership not active</span>';
        else if (left <= 0) btn = '<span class="sub">Full</span>';
        else btn = '<button class="mini go" type="button" data-book="' + c.id + '" data-date="' + k + '">Book</button>';
        h += '<div class="cls"><div class="t">' + t12(c.time) + "</div><div><strong>" + esc(c.name) + '</strong><span class="sub">' + c.dur + " min" + (c.trainerName ? ", with " + esc(c.trainerName) : "") + '</span></div><div><span class="sub">' + (booked ? "You are booked. " : "") + Math.max(left, 0) + ' of ' + c.cap + ' places left</span><div class="bar"><i style="width:' + Math.min(100, n / c.cap * 100) + '%"></i></div></div><div class="acts">' + btn + "</div></div>";
      });
    }
    if (!anyDay) h += '<p class="empty">No sessions are set up yet.</p>';
    h += '<h2>Change your password</h2><form class="panel dlg-form" id="pw-form" style="max-width:26rem"><div class="field"><label for="pw0">Current password</label><input id="pw0" type="password" autocomplete="current-password" required></div>' +
      '<div class="field"><label for="pw1">New password (8 or more characters)</label><input id="pw1" type="password" autocomplete="new-password" minlength="8" required></div>' +
      '<div class="field"><label for="pw2">New password again</label><input id="pw2" type="password" autocomplete="new-password" required></div><div class="form-foot"><button class="btn solid" type="submit">Change password</button></div></form>';
    $("#main").innerHTML = h;
  }
  function memberInit() {
    $("#main").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.p) { M.off = +b.dataset.p; memberDraw(); }
      else if (b.dataset.book) { b.disabled = true; A.book(b.dataset.book, b.dataset.date).then(function (j) { if (j.ok) { say("Booked. See you there."); } else fail(j); memberLoad(); }, function () { say("Cannot reach the server.", true); b.disabled = false; }); }
      else if (b.dataset.cancel) { A.cancel(b.dataset.cancel).then(function (j) { if (j.ok) say("Booking cancelled."); else fail(j); memberLoad(); }, function () { say("Cannot reach the server.", true); }); }
    });
    $("#main").addEventListener("submit", function (e) {
      if (e.target.id !== "pw-form") return; e.preventDefault();
      if ($("#pw1").value !== $("#pw2").value) { say("The two new passwords do not match.", true); return; }
      A.password($("#pw0").value, $("#pw1").value).then(function (j) { if (j.ok) { say("Password changed."); e.target.reset(); } else fail(j); }, function () { say("Cannot reach the server.", true); });
    });
    guard("member", memberLoad);
  }

  /* ---------- trainer page ---------- */
  var T = { data: null }, dlg;
  function trainerLoad() { A.trainer().then(function (j) { if (!j.ok) { fail(j); return; } T.data = j; trainerDraw(); }, function () { say("Cannot reach the server.", true); }); }
  function trainerDraw() {
    var d = T.data, tr = d.trainer, cl = d.clients.slice().sort(function (a, b) { return (a.lastVisit || 0) - (b.lastVisit || 0); });
    $("#who").textContent = tr.name;
    var away = cl.filter(function (c) { return live(c) && (!c.lastVisit || Date.now() - c.lastVisit > 14 * DAY); }).length, booked = d.roster.reduce(function (s, r) { return s + r.members.length; }, 0);
    var h = '<div class="cards" style="grid-template-columns:repeat(3,1fr)"><div class="card"><span>Your clients</span><strong>' + cl.length + '</strong></div><div class="card hot"><span>Active, not seen in 14 days</span><strong>' + away + '</strong><small>Worth a message</small></div><div class="card"><span>Bookings, next 7 days</span><strong>' + booked + "</strong></div></div>" +
      "<h2>Your clients</h2>" + (cl.length ? '<div class="panel"><ul class="list">' + cl.map(function (c) {
        return '<li><div><strong>' + esc(c.name) + '</strong><span class="sub">' + esc(c.goal ? GOALS[c.goal] || "" : "Goal not set") + " &middot; " + c.visits30 + " visits in 30 days &middot; " + (c.lastVisit ? "last " + fdate(c.lastVisit) : "no visits yet") + "</span></div><div class=\"acts\">" + badge(c) + '<button class="mini go" type="button" data-client="' + c.id + '">Open</button></div></li>';
      }).join("") + "</ul></div>" : '<p class="empty">No clients are assigned to you yet. The front desk assigns clients from the member profile.</p>') +
      "<h2>Your sessions, next 7 days</h2>";
    var byC = {}; d.classes.forEach(function (c) { byC[c.id] = c; });
    if (!d.roster.length) h += '<p class="empty">You have no group sessions in the next 7 days.</p>';
    d.roster.forEach(function (r) {
      var c = byC[r.classId], dt = parse(r.date);
      h += '<div class="cls"><div class="t">' + t12(c.time) + "</div><div><strong>" + esc(c.name) + '</strong><span class="sub">' + DN[dt.getDay()] + " " + dt.getDate() + " " + dt.toLocaleString("en-GB", { month: "short" }) + ", " + c.dur + ' min</span></div><div style="grid-column:span 2"><span class="sub">' + r.members.length + " of " + c.cap + " booked</span>" +
        (r.members.length ? esc(r.members.map(function (x) { return x.name; }).join(", ")) : '<span class="sub">Nobody yet</span>') + "</div></div>";
    });
    $("#main").innerHTML = h;
  }
  function clientDialog(id) {
    var c = T.data.clients.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var age = c.dob ? Math.floor((Date.now() - new Date(c.dob).getTime()) / (365.25 * DAY)) : "";
    dlg.innerHTML = '<form class="dlg-form" id="note-form"><h2>' + esc(c.name) + '</h2><dl class="kv"><dt>Membership</dt><dd>' + esc(PL[c.plan] ? PL[c.plan].name : c.plan) + ", " + (c.expires ? (live(c) ? "active until " : "ended ") + fdate(c.expires) : "not started") + '</dd>' +
      "<dt>Goal</dt><dd>" + esc(GOALS[c.goal] || "Not set") + "</dd><dt>Experience</dt><dd>" + esc(EXP[c.experience] || "Not set") + "</dd>" + (age !== "" ? "<dt>Age</dt><dd>" + age + "</dd>" : "") +
      "<dt>Visits</dt><dd>" + c.visits30 + " in 30 days" + (c.lastVisit ? ", last " + fdate(c.lastVisit) : "") + "</dd><dt>Phone</dt><dd>" + esc(c.phone) + "</dd><dt>Emergency contact</dt><dd>" + esc(c.emergency || "Not recorded") + "</dd><dt>Injuries or health notes</dt><dd>" + esc(c.health || "None recorded") + "</dd></dl>" +
      '<div class="field"><label for="tn">Your notes on this client (only you and the owner can see these)</label><textarea id="tn" maxlength="2000">' + esc(c.trainerNotes) + '</textarea></div>' +
      '<div class="form-foot"><button class="btn solid" type="submit">Save notes</button><button class="btn" type="button" data-close>Close</button><a class="mini" target="_blank" rel="noopener" href="' + wa(c.phone, "Hi " + c.name.split(" ")[0] + ", it is " + T.data.trainer.name + " from Fitness Club.") + '">WhatsApp</a></div></form>';
    $("#note-form").onsubmit = function (e) {
      e.preventDefault();
      A.note(id, $("#tn").value).then(function (j) { if (j.ok) { c.trainerNotes = $("#tn").value; dlg.close(); say("Notes saved."); } else { dlg.close(); fail(j); } }, function () { dlg.close(); say("Cannot reach the server.", true); });
    };
    dlg.showModal();
  }
  function trainerInit() {
    dlg = document.createElement("dialog"); dlg.className = "wide"; document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) dlg.close(); });
    $("#main").addEventListener("click", function (e) { var b = e.target.closest("[data-client]"); if (b) clientDialog(b.dataset.client); });
    guard("trainer", trainerLoad);
  }

  var page = document.body.getAttribute("data-page");
  if (page === "member") memberInit(); else if (page === "trainer") trainerInit();
})();
