/* Extra admin features: Schedule, Trainers, Check-in, member Profile and customer Insights.
   Uses the same FC data layer as the rest of the site, so only fc-data.js changes when you add a server. */
(function () {
  var DAY = 864e5, PL = FC.PLANS;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var rs = function (n) { return "Rs " + Math.round(n).toLocaleString("en-US"); };
  var DN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], DS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var GOALS = { lose: "Lose weight", gain: "Build muscle or gain weight", fit: "General fitness", strength: "Get stronger", sport: "Sport performance", rehab: "Recovery and health" };
  var EXP = { "new": "Complete beginner", some: "Some experience", exp: "Experienced" };
  var SRC = { friend: "Friend or family", social: "Facebook or Instagram", walk: "Walked past", google: "Google search", other: "Other" };
  var state = { wk: 0, q: "" };

  var dkey = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var sod = function (t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  var t12 = function (hhmm) { var p = hhmm.split(":"), h = +p[0]; return (h % 12 || 12) + ":" + p[1] + (h < 12 ? " am" : " pm"); };
  var ftime = function (t) { return new Date(t).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }); };
  var fdate = function (t) { return new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
  var status = function (m) { if (!m.expires) return "pending"; var l = m.expires - Date.now(); return l < 0 ? "expired" : l <= 7 * DAY ? "expiring" : "active"; };
  var isLive = function (m) { var s = status(m); return s === "active" || s === "expiring"; };
  var byId = function (arr, id) { return arr.filter(function (x) { return x.id === id; })[0]; };
  var opts = function (map, cur, blank) { return (blank ? '<option value="">' + blank + "</option>" : "") + Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === cur ? " selected" : "") + ">" + esc(map[k]) + "</option>"; }).join(""); };
  var age = function (dob) { if (!dob) return ""; var b = new Date(dob), n = new Date(), a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
  function wa(phone, msg) { var d = String(phone).replace(/\D/g, ""); if (d.length === 10 && d[0] === "9") d = "977" + d; return "https://wa.me/" + d + "?text=" + encodeURIComponent(msg); }

  /* ---------- demo data for the new tabs ---------- */
  function seed() {
    if (FC.get("fc_seeded2") || !FC.members().length) return;
    var now = Date.now(), ms = FC.members();
    var T = [["Bishal Rana", "Strength and powerlifting", 8, "9841000001", "Sun to Fri, mornings", "Competed in national powerlifting. Focus on safe heavy lifting and technique."],
      ["Sunita Maharjan", "Weight loss and conditioning", 6, "9841000002", "Sun to Fri, all day", "Builds interval and fat-loss programs for beginners and returning members."],
      ["Prakash Dahal", "Beginners and mobility", 4, "9841000003", "Mon to Fri, evenings", "Runs the Beginner start course and helps with injuries and form."],
      ["Anil Bista", "Personal coaching and muscle gain", 10, "9841000004", "Sun to Fri, by booking", "One-to-one coach for muscle gain, contest prep and nutrition plans."]]
      .map(function (r, i) { return { id: "t" + (i + 1), name: r[0], specialty: r[1], years: r[2], phone: r[3], hours: r[4], bio: r[5], fee: i === 3 ? 6000 : i === 0 ? 5000 : 4000 }; });
    var C = [["Strength floor, coached", "06:00", 60, [0, 1, 2, 3, 4, 5], "t1", 15], ["Conditioning", "07:30", 60, [0, 2, 4], "t2", 20], ["Lunch express", "12:30", 30, [1, 2, 3, 4, 5], "t2", 12],
      ["Conditioning", "17:30", 60, [1, 3, 5], "t3", 20], ["Beginner start", "18:30", 60, [1, 3], "t3", 10]]
      .map(function (r, i) { return { id: "c" + (i + 1), name: r[0], time: r[1], dur: r[2], days: r[3], trainerId: r[4], cap: r[5] }; });
    var G = Object.keys(GOALS), E = Object.keys(EXP), S = Object.keys(SRC), live = [], ck = [], bk = [];
    ms.forEach(function (m, i) {
      if (m.goal) return;
      m.goal = G[(i * 5) % G.length]; m.experience = E[(i * 2) % 3]; m.source = S[(i * 3) % S.length];
      m.gender = m.gender || (["Sita", "Anita", "Priya", "Nisha", "Mina", "Laxmi", "Gita"].indexOf(m.name.split(" ")[0]) > -1 ? "female" : "male");
      m.dob = (1986 + (i * 3) % 18) + "-" + ("0" + (1 + (i * 5) % 12)).slice(-2) + "-" + ("0" + (3 + (i * 7) % 24)).slice(-2);
      if (i === 3) m.dob = new Date().getFullYear() - 27 + "-" + ("0" + (new Date().getMonth() + 1)).slice(-2) + "-18";
      m.emergency = "Family, 98" + String(40000000 + (i * 7919) % 9999999); m.trainerId = i % 3 === 0 ? "" : T[i % 4].id;
      if (m.expires) {
        var seedN = i + 3, start = Math.max(m.start || m.joined, now - 30 * DAY), skip = i % 7 === 4 ? 12 : 0;
        for (var d = 30; d >= skip; d--) {
          var day = now - d * DAY; if (day < start || sod(day).getDay() === 6) continue;
          seedN = (seedN * 9301 + 49297) % 233280;
          if (seedN / 233280 < (i % 5 === 0 ? 0.8 : 0.5)) { var h = [6, 7, 8, 12, 17, 18, 19][seedN % 7], dt = sod(day); dt.setHours(h, (seedN % 50) + 5); if (dt.getTime() < now) ck.push({ id: FC.uid() + "k" + ck.length, memberId: m.id, memberName: m.name, ts: dt.getTime() }); }
        }
      }
    });
    ms.filter(isLive).slice(0, 8).forEach(function (m, i) { var d = sod(now + ((i % 3) + 1) * DAY); bk.push({ id: FC.uid() + "b" + i, classId: C[i % 5].id, date: dkey(d), memberId: m.id }); });
    FC.saveMembers(ms); FC.saveTrainers(T); FC.saveClasses(C); FC.saveCheckins(ck); FC.saveBookings(bk); FC.set("fc_seeded2", 1);
  }

  /* ---------- dialogs ---------- */
  function mk(id, cls) { var d = document.createElement("dialog"); d.id = id; if (cls) d.className = cls; document.body.appendChild(d); return d; }
  var dCls = mk("cls-dlg"), dTr = mk("tr-dlg"), dRo = mk("ro-dlg", "wide"), dPr = mk("pr-dlg", "wide");
  document.addEventListener("click", function (e) { var c = e.target.closest("[data-close]"); if (c) c.closest("dialog").close(); });

  /* ---------- Schedule ---------- */
  function weekStart() { var t = sod(Date.now()); t.setDate(t.getDate() - t.getDay() + state.wk * 7); return t; }
  function booked(cid, dk) { return FC.bookings().filter(function (b) { return b.classId === cid && b.date === dk; }); }
  function schedule() {
    var tr = FC.trainers(), cl = FC.classes(), ws = weekStart(), today = dkey(new Date());
    var h = '<div class="toolbar"><div class="wk"><button class="mini" data-m="wk" data-v="-1" type="button">Previous week</button><button class="mini" data-m="wk" data-v="0" type="button">This week</button><button class="mini" data-m="wk" data-v="1" type="button">Next week</button></div><span class="sp"></span><button class="btn solid" type="button" data-m="cls-new">Add session</button></div>' +
      '<p class="sub" style="margin-bottom:.5rem">Week of ' + fdate(ws) + '. Sessions repeat every week. Bookings are per date.</p>';
    for (var i = 0; i < 7; i++) {
      var d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i), dk = dkey(d);
      var list = cl.filter(function (c) { return c.days.indexOf(i) > -1; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
      if (!list.length && i === 6) continue;
      h += '<div class="day-h' + (dk === today ? " today" : "") + '">' + DN[i] + "<small>" + d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" }) + (dk === today ? ", today" : "") + "</small></div>";
      if (!list.length) h += '<p class="empty">No sessions.</p>';
      list.forEach(function (c) {
        var t = byId(tr, c.trainerId), n = booked(c.id, dk).length, pct = Math.min(100, Math.round(n / c.cap * 100));
        h += '<div class="cls"><div class="t">' + t12(c.time) + '</div><div><strong>' + esc(c.name) + '</strong><span class="sub">' + c.dur + " min, " + (t ? esc(t.name) : "No trainer set") + '</span></div>' +
          '<div><span class="sub">' + n + " of " + c.cap + ' booked</span><div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
          '<div class="acts"><button class="mini go" data-m="roster" data-id="' + c.id + '" data-date="' + dk + '">Bookings</button><button class="mini" data-m="cls-edit" data-id="' + c.id + '">Edit</button></div></div>';
      });
    }
    $("#tab-schedule").innerHTML = h;
  }
  function classForm(c) {
    c = c || { name: "", time: "06:00", dur: 60, days: [1, 2, 3, 4, 5], trainerId: "", cap: 15 };
    var tr = FC.trainers();
    dCls.innerHTML = '<form class="dlg-form" id="cls-form"><h2>' + (c.id ? "Edit session" : "Add session") + '</h2>' +
      '<div class="field"><label for="c-name">Session name</label><input id="c-name" type="text" required value="' + esc(c.name) + '"></div>' +
      '<div class="two"><div class="field"><label for="c-time">Start time</label><input id="c-time" type="time" required value="' + c.time + '"></div><div class="field"><label for="c-dur">Length (minutes)</label><input id="c-dur" type="number" min="10" max="240" required value="' + c.dur + '"></div></div>' +
      '<div class="two"><div class="field"><label for="c-tr">Trainer</label><select id="c-tr"><option value="">No trainer</option>' + tr.map(function (t) { return '<option value="' + t.id + '"' + (t.id === c.trainerId ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + '</select></div><div class="field"><label for="c-cap">Places</label><input id="c-cap" type="number" min="1" max="200" required value="' + c.cap + '"></div></div>' +
      '<fieldset><legend>Days</legend>' + DS.map(function (n, i) { return '<label><input type="checkbox" name="cd" value="' + i + '"' + (c.days.indexOf(i) > -1 ? " checked" : "") + "> " + n + "</label>"; }).join("") + '</fieldset>' +
      '<div class="form-foot"><button class="btn solid" type="submit">Save</button><button class="btn" type="button" data-close>Cancel</button>' + (c.id ? '<button class="mini del" type="button" data-m="cls-del" data-id="' + c.id + '">Delete session</button>' : "") + '</div></form>';
    $("#cls-form").onsubmit = function (e) {
      e.preventDefault();
      var days = Array.prototype.map.call(document.querySelectorAll("#cls-form [name=cd]:checked"), function (x) { return +x.value; });
      if (!days.length) { alert("Pick at least one day."); return; }
      var all = FC.classes(), o = c.id ? byId(all, c.id) : { id: "c" + FC.uid() }; if (!c.id) all.push(o);
      o.name = $("#c-name").value.trim(); o.time = $("#c-time").value; o.dur = +$("#c-dur").value; o.trainerId = $("#c-tr").value; o.cap = +$("#c-cap").value; o.days = days;
      FC.saveClasses(all); dCls.close(); render();
    };
    dCls.showModal();
  }
  function roster(cid, dk) {
    var c = byId(FC.classes(), cid), t = byId(FC.trainers(), c.trainerId), bs = booked(cid, dk), ms = FC.members(), full = bs.length >= c.cap;
    var taken = bs.map(function (b) { return b.memberId; });
    var avail = ms.filter(function (m) { return isLive(m) && taken.indexOf(m.id) < 0; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var dd = new Date(dk + "T00:00:00");
    dRo.innerHTML = '<div class="dlg-form"><h2>' + esc(c.name) + '</h2><p class="sub">' + DN[dd.getDay()] + " " + fdate(dd) + ", " + t12(c.time) + (t ? ", with " + esc(t.name) : "") + " &middot; " + bs.length + " of " + c.cap + ' booked</p>' +
      (bs.length ? '<ul class="list">' + bs.map(function (b) { var m = byId(ms, b.memberId); return '<li><div><strong>' + esc(m ? m.name : "Deleted member") + '</strong><span class="sub">' + esc(m ? m.phone : "") + '</span></div><button class="mini del" data-m="unbook" data-id="' + b.id + '" data-cls="' + cid + '" data-date="' + dk + '">Remove</button></li>'; }).join("") + "</ul>" : '<p class="empty">Nobody booked yet.</p>') +
      (full ? '<p class="sub">This session is full.</p>' : '<div class="two"><div class="field"><label for="bk-m">Book a member (active members only)</label><select id="bk-m">' + (avail.length ? avail.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + "</option>"; }).join("") : '<option value="">No one available</option>') + '</select></div><div class="field"><label>&nbsp;</label><button class="btn solid" type="button" data-m="book" data-id="' + cid + '" data-date="' + dk + '"' + (avail.length ? "" : " disabled") + '>Book</button></div></div>') +
      '<div class="form-foot"><button class="btn" type="button" data-close>Close</button></div></div>';
    if (!dRo.open) dRo.showModal();
  }

  /* ---------- Trainers ---------- */
  function trainers() {
    var tr = FC.trainers(), ms = FC.members(), cl = FC.classes();
    var h = '<div class="toolbar"><strong>' + tr.length + ' trainers</strong><span class="sp"></span><button class="btn solid" type="button" data-m="tr-new">Add trainer</button></div>';
    if (!tr.length) { $("#tab-trainers").innerHTML = h + '<p class="empty">No trainers yet.</p>'; return; }
    h += '<div class="tcards">' + tr.map(function (t) {
      var mine = ms.filter(function (m) { return m.trainerId === t.id; }), cs = cl.filter(function (c) { return c.trainerId === t.id; }), weekly = cs.reduce(function (s, c) { return s + c.days.length; }, 0);
      return '<div class="tcard"><div class="avatar" aria-hidden="true">' + esc(t.name.charAt(0)) + '</div><h3>' + esc(t.name) + '</h3><span class="sub">' + esc(t.specialty) + '</span>' +
        '<dl class="kv"><dt>Experience</dt><dd>' + esc(t.years) + ' years</dd><dt>Phone</dt><dd>' + esc(t.phone) + '</dd><dt>Works</dt><dd>' + esc(t.hours) + '</dd><dt>Personal coaching</dt><dd>' + (t.fee ? rs(t.fee) + " per month" : "Not offered") + '</dd><dt>Group sessions</dt><dd>' + weekly + ' per week</dd><dt>Clients</dt><dd>' + mine.length + (mine.length ? ": " + mine.slice(0, 4).map(function (m) { return esc(m.name.split(" ")[0]); }).join(", ") + (mine.length > 4 ? " and " + (mine.length - 4) + " more" : "") : "") + '</dd></dl>' +
        (t.bio ? '<p class="sub">' + esc(t.bio) + '</p>' : "") + '<div class="acts"><button class="mini" data-m="tr-edit" data-id="' + t.id + '">Edit</button><button class="mini del" data-m="tr-del" data-id="' + t.id + '">Delete</button></div></div>';
    }).join("") + "</div>";
    $("#tab-trainers").innerHTML = h;
  }
  function trainerForm(t) {
    t = t || { name: "", specialty: "", years: 1, phone: "", hours: "", bio: "", fee: 0 };
    dTr.innerHTML = '<form class="dlg-form" id="tr-form"><h2>' + (t.id ? "Edit trainer" : "Add trainer") + '</h2>' +
      '<div class="field"><label for="t-name">Name</label><input id="t-name" type="text" required value="' + esc(t.name) + '"></div>' +
      '<div class="field"><label for="t-spec">Speciality</label><input id="t-spec" type="text" required value="' + esc(t.specialty) + '"></div>' +
      '<div class="two"><div class="field"><label for="t-years">Years of experience</label><input id="t-years" type="number" min="0" max="60" required value="' + esc(t.years) + '"></div><div class="field"><label for="t-phone">Phone</label><input id="t-phone" type="tel" required value="' + esc(t.phone) + '"></div></div>' +
      '<div class="two"><div class="field"><label for="t-hours">Working days and hours</label><input id="t-hours" type="text" value="' + esc(t.hours) + '"></div><div class="field"><label for="t-fee">Personal coaching, Rs per month (0 if none)</label><input id="t-fee" type="number" min="0" value="' + esc(t.fee) + '"></div></div>' +
      '<div class="field"><label for="t-bio">About</label><textarea id="t-bio">' + esc(t.bio) + '</textarea></div>' +
      '<div class="form-foot"><button class="btn solid" type="submit">Save</button><button class="btn" type="button" data-close>Cancel</button></div></form>';
    $("#tr-form").onsubmit = function (e) {
      e.preventDefault();
      var all = FC.trainers(), o = t.id ? byId(all, t.id) : { id: "t" + FC.uid() }; if (!t.id) all.push(o);
      o.name = $("#t-name").value.trim(); o.specialty = $("#t-spec").value.trim(); o.years = +$("#t-years").value; o.phone = $("#t-phone").value.trim(); o.hours = $("#t-hours").value.trim(); o.fee = +$("#t-fee").value || 0; o.bio = $("#t-bio").value.trim();
      FC.saveTrainers(all); dTr.close(); render();
    };
    dTr.showModal();
  }

  /* ---------- Check-in ---------- */
  function checkin() {
    var ms = FC.members(), ck = FC.checkins(), now = Date.now(), t0 = sod(now).getTime(), q = state.q.toLowerCase();
    var today = ck.filter(function (k) { return k.ts >= t0; }).sort(function (a, b) { return b.ts - a.ts; });
    var wk = ck.filter(function (k) { return k.ts >= t0 - 6 * DAY; }).length;
    var lastVisit = {}; ck.forEach(function (k) { if (!lastVisit[k.memberId] || k.ts > lastVisit[k.memberId]) lastVisit[k.memberId] = k.ts; });
    var res = q ? ms.filter(function (m) { return (m.name + " " + m.phone).toLowerCase().indexOf(q) > -1; }).slice(0, 8) : [];
    var gone = ms.filter(function (m) { return isLive(m) && (!lastVisit[m.id] || now - lastVisit[m.id] > 14 * DAY); }).sort(function (a, b) { return (lastVisit[a.id] || 0) - (lastVisit[b.id] || 0); });
    var h = '<div class="cards" style="grid-template-columns:repeat(3,1fr)"><div class="card"><span>Checked in today</span><strong>' + today.length + '</strong></div><div class="card"><span>Visits, last 7 days</span><strong>' + wk + '</strong></div><div class="card hot"><span>Active, not seen in 14 days</span><strong>' + gone.length + '</strong><small>Good people to message</small></div></div>' +
      '<div class="split" style="margin-top:2rem"><div><h2>Check a member in</h2><div class="panel"><div class="toolbar"><input id="ck-q" type="search" placeholder="Type a name or phone number" aria-label="Find member" value="' + esc(state.q) + '"></div>' +
      (q ? (res.length ? '<ul class="list">' + res.map(function (m) { var s = status(m); return '<li><div><strong>' + esc(m.name) + '</strong><span class="sub">' + esc(m.phone) + " &middot; " + PL[m.plan].name + " &middot; " + (s === "pending" ? "Not paid yet" : s === "expired" ? "Expired " + fdate(m.expires) : "Active until " + fdate(m.expires)) + '</span></div><button class="mini go" data-m="checkin" data-id="' + m.id + '">Check in</button></li>'; }).join("") + "</ul>" : '<p class="empty">No member found.</p>') : '<p class="empty">Search to check someone in at the front desk.</p>') +
      '</div><h2>Not seen for 14 days</h2><div class="panel">' + (gone.length ? '<ul class="list">' + gone.slice(0, 10).map(function (m) { return '<li><div><strong>' + esc(m.name) + '</strong><span class="sub">' + (lastVisit[m.id] ? "Last visit " + fdate(lastVisit[m.id]) : "No visits yet") + '</span></div><a class="mini" target="_blank" rel="noopener" href="' + wa(m.phone, "Hi " + m.name.split(" ")[0] + ", we have not seen you at Fitness Club for a while. Everything ok? Come in this week and we will help you get back on track.") + '">Message</a></li>'; }).join("") + "</ul>" : '<p class="empty">Everyone active has visited recently.</p>') + '</div></div>' +
      '<div><h2>Today</h2><div class="panel">' + (today.length ? today.map(function (k) { return '<div class="cin"><div><strong>' + esc(k.memberName) + '</strong></div><span class="sub">' + ftime(k.ts) + "</span></div>"; }).join("") : '<p class="empty">No check-ins yet today.</p>') + '</div></div></div>';
    $("#tab-checkin").innerHTML = h;
    var qi = $("#ck-q"); qi.oninput = function () { state.q = this.value; var p = this.selectionStart; checkin(); var n = $("#ck-q"); n.focus(); n.setSelectionRange(p, p); };
  }

  /* ---------- Member profile ---------- */
  function profile(id) {
    var m = byId(FC.members(), id); if (!m) return;
    var tr = FC.trainers(), ck = FC.checkins().filter(function (k) { return k.memberId === id; }).sort(function (a, b) { return b.ts - a.ts; });
    var pay = FC.sales().filter(function (x) { return x.memberId === id; }).sort(function (a, b) { return b.ts - a.ts; }), spent = pay.reduce(function (s, x) { return s + x.amount; }, 0);
    var shop = FC.sales().filter(function (x) { return x.type === "shop" && x.customer && x.customer.name === m.name; }), m30 = ck.filter(function (k) { return k.ts > Date.now() - 30 * DAY; }).length;
    var cl = FC.classes(), up = FC.bookings().filter(function (b) { return b.memberId === id && b.date >= dkey(new Date()); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    dPr.innerHTML = '<form class="dlg-form" id="pr-form"><h2>' + esc(m.name) + '</h2>' +
      '<dl class="kv"><dt>Membership</dt><dd>' + PL[m.plan].name + ", " + (status(m) === "pending" ? "not paid yet" : status(m)) + (m.expires ? ", until " + fdate(m.expires) : "") + '</dd><dt>Joined</dt><dd>' + fdate(m.joined) + '</dd><dt>Visits</dt><dd>' + ck.length + " in total, " + m30 + " in the last 30 days" + (ck[0] ? ", last on " + fdate(ck[0].ts) : "") + '</dd><dt>Paid so far</dt><dd>' + rs(spent) + " on membership" + (shop.length ? ", " + shop.length + " shop order" + (shop.length > 1 ? "s" : "") : "") + '</dd><dt>Booked sessions</dt><dd>' + (up.length ? up.slice(0, 4).map(function (b) { var c = byId(cl, b.classId); return c ? esc(c.name) + " " + b.date.slice(5) : ""; }).join(", ") : "None coming up") + '</dd></dl>' +
      '<div class="two"><div class="field"><label for="p-name">Full name</label><input id="p-name" type="text" required value="' + esc(m.name) + '"></div><div class="field"><label for="p-phone">Phone</label><input id="p-phone" type="tel" required value="' + esc(m.phone) + '"></div></div>' +
      '<div class="two"><div class="field"><label for="p-email">Email</label><input id="p-email" type="email" value="' + esc(m.email) + '"></div><div class="field"><label for="p-dob">Date of birth' + (m.dob ? " (age " + age(m.dob) + ")" : "") + '</label><input id="p-dob" type="date" value="' + esc(m.dob) + '"></div></div>' +
      '<div class="two"><div class="field"><label for="p-goal">Main goal</label><select id="p-goal">' + opts(GOALS, m.goal, "Not set") + '</select></div><div class="field"><label for="p-exp">Gym experience</label><select id="p-exp">' + opts(EXP, m.experience, "Not set") + '</select></div></div>' +
      '<div class="two"><div class="field"><label for="p-tr">Personal trainer</label><select id="p-tr"><option value="">No trainer assigned</option>' + tr.map(function (t) { return '<option value="' + t.id + '"' + (t.id === m.trainerId ? " selected" : "") + ">" + esc(t.name) + " (" + esc(t.specialty) + ")</option>"; }).join("") + '</select></div><div class="field"><label for="p-src">How they heard about us</label><select id="p-src">' + opts(SRC, m.source, "Not set") + '</select></div></div>' +
      '<div class="field"><label for="p-em">Emergency contact</label><input id="p-em" type="text" placeholder="Name and phone" value="' + esc(m.emergency) + '"></div>' +
      '<div class="field"><label for="p-health">Injuries or health notes (only what the member chose to tell you)</label><textarea id="p-health">' + esc(m.health) + '</textarea></div>' +
      '<div class="field"><label for="p-notes">Staff notes</label><textarea id="p-notes">' + esc(m.notes) + '</textarea></div>' +
      '<div class="form-foot"><button class="btn solid" type="submit">Save profile</button><button class="btn" type="button" data-close>Close</button><a class="mini" target="_blank" rel="noopener" href="' + wa(m.phone, "Hi " + m.name.split(" ")[0] + ", this is Fitness Club.") + '">WhatsApp</a></div></form>';
    $("#pr-form").onsubmit = function (e) {
      e.preventDefault();
      var all = FC.members(), o = byId(all, id);
      o.name = $("#p-name").value.trim(); o.phone = $("#p-phone").value.trim(); o.email = $("#p-email").value.trim(); o.dob = $("#p-dob").value; o.goal = $("#p-goal").value; o.experience = $("#p-exp").value;
      o.trainerId = $("#p-tr").value; o.source = $("#p-src").value; o.emergency = $("#p-em").value.trim(); o.health = $("#p-health").value.trim(); o.notes = $("#p-notes").value.trim();
      FC.saveMembers(all); dPr.close(); renderAll();
    };
    dPr.showModal();
  }

  /* ---------- Customer insights (added to Overview) ---------- */
  function bars(title, counts, labels, total) {
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }), mx = Math.max.apply(null, keys.map(function (k) { return counts[k]; }).concat(1));
    return '<div class="panel"><h2>' + title + "</h2>" + (keys.length ? keys.map(function (k) { return '<div class="brow"><span>' + esc(labels[k] || k) + '</span><div class="bar"><i style="width:' + counts[k] / mx * 100 + '%"></i></div><b>' + counts[k] + "</b></div>"; }).join("") : '<p class="empty">Nothing recorded yet.</p>') + "</div>";
  }
  function insights() {
    var ms = FC.members(), ck = FC.checkins(), tr = FC.trainers(), n = new Date();
    var tally = function (f, skipBlank) { var o = {}; ms.forEach(function (m) { var k = f(m); if (k === "" && skipBlank !== false) k = "none"; o[k] = (o[k] || 0) + 1; }); return o; };
    var goal = tally(function (m) { return m.goal; }), src = tally(function (m) { return m.source; }), gen = tally(function (m) { return m.gender; }), exp = tally(function (m) { return m.experience; });
    var tl = {}; tr.forEach(function (t) { tl[t.id] = t.name; });
    var load = tally(function (m) { return m.trainerId; }); 
    var hours = {}, days = {}; ck.forEach(function (k) { var d = new Date(k.ts), hr = d.getHours(); hours[hr] = (hours[hr] || 0) + 1; days[d.getDay()] = (days[d.getDay()] || 0) + 1; });
    var hl = {}; Object.keys(hours).forEach(function (hr) { hl[hr] = t12(("0" + hr).slice(-2) + ":00"); });
    var dl = {}; DS.forEach(function (x, i) { dl[i] = DN[i]; });
    var bd = ms.filter(function (m) { return m.dob && +m.dob.slice(5, 7) === n.getMonth() + 1; }).sort(function (a, b) { return +a.dob.slice(8) - +b.dob.slice(8); });
    var l = { none: "Not set", male: "Male", female: "Female", "": "Not set" }, ll = {}; [GOALS, SRC, EXP].forEach(function (o) { Object.keys(o).forEach(function (k) { ll[k] = o[k]; }); }); ll.none = "Not set";
    tl.none = "No trainer";
    var h = '<h2>Know your customers</h2><p class="sub" style="margin:-.5rem 0 1rem">Built from what members tell you when they join and from check-ins. Fill in profiles to make this more useful.</p>' +
      '<div class="split">' + bars("Why they joined", goal, ll) + bars("How they found you", src, ll) + "</div>" +
      '<div class="split" style="margin-top:1.5rem">' + bars("Gym experience", exp, ll) + bars("Men and women", gen, { male: "Male", female: "Female", none: "Not set" }) + "</div>" +
      '<div class="split" style="margin-top:1.5rem">' + bars("Busiest days (check-ins)", days, dl) + bars("Busiest hours (check-ins)", hours, hl) + "</div>" +
      '<div class="split" style="margin-top:1.5rem">' + bars("Members per trainer", load, tl) +
      '<div class="panel"><h2>Birthdays in ' + n.toLocaleString("en-GB", { month: "long" }) + "</h2>" + (bd.length ? '<ul class="list">' + bd.map(function (m) { return '<li><div><strong>' + esc(m.name) + '</strong><span class="sub">' + +m.dob.slice(8) + " " + n.toLocaleString("en-GB", { month: "short" }) + ", turning " + (n.getFullYear() - +m.dob.slice(0, 4)) + '</span></div><a class="mini" target="_blank" rel="noopener" href="' + wa(m.phone, "Happy birthday " + m.name.split(" ")[0] + "! From everyone at Fitness Club.") + '">Wish</a></li>'; }).join("") + "</ul>" : '<p class="empty">No birthdays recorded this month.</p>') + "</div></div>";
    var box = document.getElementById("insights"); if (!box) { box = document.createElement("div"); box.id = "insights"; $("#tab-overview").appendChild(box); }
    box.innerHTML = h;
  }

  /* ---------- wiring ---------- */
  function render() { seed(); schedule(); trainers(); checkin(); insights(); }
  function renderAll() { if (window.FCAdminRender) window.FCAdminRender(); else render(); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-m]"); if (!b) return;
    var a = b.dataset.m, id = b.dataset.id;
    if (a === "wk") { state.wk = b.dataset.v === "0" ? 0 : state.wk + +b.dataset.v; schedule(); }
    else if (a === "cls-new") classForm();
    else if (a === "cls-edit") classForm(byId(FC.classes(), id));
    else if (a === "cls-del") { if (confirm("Delete this session and its bookings?")) { FC.saveClasses(FC.classes().filter(function (c) { return c.id !== id; })); FC.saveBookings(FC.bookings().filter(function (x) { return x.classId !== id; })); dCls.close(); render(); } }
    else if (a === "roster") roster(id, b.dataset.date);
    else if (a === "book") { var mid = $("#bk-m").value, c = byId(FC.classes(), id); if (mid && booked(id, b.dataset.date).length < c.cap) { var all = FC.bookings(); all.push({ id: FC.uid(), classId: id, date: b.dataset.date, memberId: mid }); FC.saveBookings(all); roster(id, b.dataset.date); schedule(); } }
    else if (a === "unbook") { FC.saveBookings(FC.bookings().filter(function (x) { return x.id !== id; })); roster(b.dataset.cls, b.dataset.date); schedule(); }
    else if (a === "tr-new") trainerForm();
    else if (a === "tr-edit") trainerForm(byId(FC.trainers(), id));
    else if (a === "tr-del") { if (confirm("Delete this trainer? Members and sessions keep working but will show no trainer.")) { FC.saveTrainers(FC.trainers().filter(function (t) { return t.id !== id; })); FC.saveMembers(FC.members().map(function (m) { if (m.trainerId === id) m.trainerId = ""; return m; })); FC.saveClasses(FC.classes().map(function (c) { if (c.trainerId === id) c.trainerId = ""; return c; })); render(); } }
    else if (a === "checkin") {
      var m = byId(FC.members(), id), s = status(m);
      if (s === "pending") { alert("This member has not paid yet. Mark them paid first."); return; }
      if (s === "expired" && !confirm(m.name + "'s membership expired on " + fdate(m.expires) + ". Check in anyway?")) return;
      var ck = FC.checkins(); ck.push({ id: FC.uid(), memberId: id, memberName: m.name, ts: Date.now() }); FC.saveCheckins(ck); state.q = ""; render();
    }
    else if (a === "profile") profile(id);
  });
  window.FCMore = { render: render };
})();
