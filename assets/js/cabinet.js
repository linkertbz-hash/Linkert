/* АвтоПерегон PRO — cabinet.js (обновлённый кабинет) */
(function () {
  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function toast(msg){
    if (window.toast) { try { window.toast(msg); return; } catch(e){} }
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = "none"), 2600);
  }

  function firebaseEnabled() {
    const cfg = (window.PEREGON_FIREBASE && window.PEREGON_FIREBASE.config) || null;
    const enabled = !!(window.PEREGON_FIREBASE && window.PEREGON_FIREBASE.enabled);
    if (!enabled || !cfg) return false;
    const bad = Object.values(cfg).some(v => typeof v === "string" && v.startsWith("YOUR_"));
    return !bad && typeof window.firebase !== "undefined" && typeof firebase.auth === "function" && typeof firebase.firestore === "function";
  }
  function initFirebase() {
    const cfg = window.PEREGON_FIREBASE.config;
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
    return { db: firebase.firestore(), auth: firebase.auth() };
  }

  // Loyalty tiers (done orders count -> discount)
  function discountFor(doneCount){
    const n = Number(doneCount)||0;
    if (n >= 20) return 10;
    if (n >= 10) return 7;
    if (n >= 6) return 5;
    if (n >= 3) return 3;
    return 0;
  }
  function nextTierText(doneCount){
    const n = Number(doneCount)||0;
    if (n < 3) return `До скидки 3% осталось ${3-n} выполн. заказ(ов).`;
    if (n < 6) return `До скидки 5% осталось ${6-n} выполн. заказ(ов).`;
    if (n < 10) return `До скидки 7% осталось ${10-n} выполн. заказ(ов).`;
    if (n < 20) return `До скидки 10% осталось ${20-n} выполн. заказ(ов).`;
    return "Максимальная скидка 10% активна ✅";
  }

  function money(n){
    try { return new Intl.NumberFormat("ru-RU").format(Math.round(Number(n)||0)) + " ₽"; }
    catch(e){ return (Math.round(Number(n)||0) + " ₽"); }
  }
  function fmtDate(ts){
    try {
      const d = ts?.toDate ? ts.toDate() : (typeof ts === "number" ? new Date(ts) : null);
      if (!d) return "";
      return d.toLocaleString("ru-RU");
    } catch(e){ return ""; }
  }
  function statusLabel(s){
    const map = {
      "new":"Новый","inwork":"В работе","assigned":"Назначен водитель","onroute":"В пути",
      "paid":"Бронь оплачена","done":"Выполнено","cancelled":"Отменено","spam":"Спам"
    };
    return map[s] || String(s || "—");
  }

  function showPanel(key){
    const panels = {
      orders: $("#panelOrders"),
      new: $("#panelNew"),
      pay: $("#panelPay"),
      docs: $("#panelDocs"),
    };
    Object.keys(panels).forEach(k => { if (panels[k]) panels[k].style.display = (k===key ? "" : "none"); });
    // Scroll to content
    try { window.scrollTo({ top: ($("#panelOrders")?.getBoundingClientRect().top||0) + window.scrollY - 90, behavior:"smooth" }); } catch(e){}
  }

  function getEstimateKey(uid){
    return uid ? ("last_estimate_" + uid) : "last_estimate_guest";
  }

  function readEstimate(uid){
    try {
      const raw = localStorage.getItem(getEstimateKey(uid));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e){ return null; }
  }

  function fillEstimateBox(est, discountPct){
    const box = $("#estimateBox");
    if (!box) return;
    if (!est || !est.r || !est.r.price) { box.style.display="none"; return; }
    const base = Number(est.r.price)||0;
    const withDisc = base * (1 - (Number(discountPct)||0)/100);
    const booking = withDisc * 0.40;
    $("#estBase").textContent = money(base);
    $("#estWithDiscount").textContent = money(withDisc);
    $("#estBooking").textContent = money(booking);
    box.style.display = "";
    box.dataset.base = String(base);
    box.dataset.withDisc = String(withDisc);
    box.dataset.booking = String(booking);
  }

  function renderOrders(list){
    const wrap = $("#ordersList");
    if (!wrap) return;
    if (!list.length){
      wrap.innerHTML = `<div class="card" style="grid-column:1/-1;"><b>Пока нет заказов</b><p class="note">Создайте заявку — и она появится здесь со статусом.</p></div>`;
      return;
    }
    wrap.innerHTML = list.map(o => {
      const route = `${escapeHtml(o.fromCity||"—")} → ${escapeHtml(o.toCity||"—")}`;
      const status = statusLabel(o.status);
      const badge = `<span class="pill">${escapeHtml(status)}</span>`;
      const created = fmtDate(o.createdAt);
      const pub = escapeHtml(o.publicId||"");
      const cat = escapeHtml(o.category||"B");
      const booking = (o.bookingAmount != null) ? money(o.bookingAmount) : "—";
      const driver = o.driverName ? `<div class="note" style="margin-top:8px;">Водитель: <b>${escapeHtml(o.driverName)}</b> ${o.driverPhone ? `(${escapeHtml(o.driverPhone)})` : ""}</div>` : "";
      const estLine = o.estimatePrice ? `<div class="note">Оценка: <b>${money(o.estimatePrice)}</b></div>` : "";
      const comment = o.comment ? `<div class="note" style="margin-top:8px;">Комментарий: ${escapeHtml(o.comment)}</div>` : "";
      return `
        <details class="card" data-hay="${escapeHtml(route + " " + status + " " + (o.phone||"") + " " + (o.publicId||""))}">
          <summary style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div>
              <b>${route}</b>
              <div class="note">${created} · Кат.: <b>${cat}</b> ${pub ? ` · № <b>${pub}</b>` : ""}</div>
            </div>
            ${badge}
          </summary>
          <div class="hr"></div>
          <div class="grid" style="grid-template-columns:1fr; gap:10px;">
            ${estLine}
            <div class="note">Бронь 40%: <b>${booking}</b></div>
            ${driver}
            ${comment}
            <div class="note">Оплата и реквизиты согласуются после подтверждения заказа. Быстрее всего — через Telegram.</div>
            <a class="btn success wide" href="#" data-contact="tg" onclick="return false;">Написать в Telegram</a>
          </div>
        </details>
      `;
    }).join("");
  }

  function escapeHtml(str){
    return String(str||"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  async function main(){
    // Tabs
    $("#tabOrdersBtn")?.addEventListener("click", () => showPanel("orders"));
    $("#tabNewBtn")?.addEventListener("click", () => showPanel("new"));
    $("#tabPayBtn")?.addEventListener("click", () => showPanel("pay"));
    $("#tabDocsBtn")?.addEventListener("click", () => showPanel("docs"));

    if (!firebaseEnabled()){
      toast("Firebase не подключен — кабинет не работает");
      return;
    }

    const { db, auth } = initFirebase();

    // Logout
    $("#logoutBtn")?.addEventListener("click", async () => {
      try { await auth.signOut(); } catch(e){}
      try {
        localStorage.removeItem("auth_uid");
        localStorage.removeItem("auth_email");
      } catch(e){}
      location.href = "login.html";
    });

    const ordersSearch = $("#ordersSearch");
    ordersSearch?.addEventListener("input", () => {
      const q = String(ordersSearch.value||"").trim().toLowerCase();
      $all("#ordersList details").forEach(d => {
        const hay = String(d.getAttribute("data-hay")||"").toLowerCase();
        d.style.display = (!q || hay.includes(q)) ? "" : "none";
      });
    });

    $("#ordersRefreshBtn")?.addEventListener("click", () => {
      toast("Обновляем…");
      loadOrders();
    });

    // Import estimate
    $("#importEstimateBtn")?.addEventListener("click", () => {
      const uid = String(localStorage.getItem("auth_uid")||"").trim();
      const est = readEstimate(uid);
      if (!est || !est.data) { toast("Нет сохранённого расчёта"); return; }
      $("#oFrom").value = String(est.data.from||"").trim();
      $("#oTo").value = String(est.data.to||"").trim();
      $("#oCategory").value = String(est.data.category||"B");
      $("#oNight").checked = !!est.data.night;
      $("#oUrgent").checked = !!est.data.urgent;
      const wait = Number(est.data.wait||0);
      $("#oWait").value = wait ? String(wait) : "";
      toast("Расчёт подтянут ✅ Можно оформить заявку");
      // estimate box updated later after discount known
    });

    // Create order
    $("#orderForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = auth.currentUser;
      if (!u) { toast("Нужно войти"); return; }

      const fromCity = String($("#oFrom").value||"").trim();
      const toCity = String($("#oTo").value||"").trim();
      const category = String($("#oCategory").value||"B");
      const phone = String($("#oPhone").value||"").trim();
      const dateText = String($("#oDate").value||"").trim();
      const comment = String($("#oComment").value||"").trim();
      const night = !!$("#oNight").checked;
      const urgent = !!$("#oUrgent").checked;
      const waitHours = Number(String($("#oWait").value||"").replace(",",".")) || 0;

      if (!fromCity || !toCity) { toast("Укажите маршрут"); return; }
      if (!phone || phone.length < 7) { toast("Укажите телефон"); return; }

      const doneCount = Number($("#cabDone")?.textContent||"0") || 0;
      const disc = discountFor(doneCount);

      // try to attach estimate
      const est = readEstimate(u.uid);
      let estimatePrice = null;
      let estimateDetails = null;
      let bookingAmount = null;

      try {
        if (est?.r?.price) {
          estimatePrice = Number(est.r.price) || null;
          estimateDetails = String(est.r.details||"");
          const withDisc = (Number(estimatePrice)||0) * (1 - disc/100);
          bookingAmount = withDisc * 0.40;
        }
      } catch(e){}

      // public id
      const publicId = String(Math.random()).slice(2,8);

      const payload = {
        userUid: u.uid,
        userEmail: u.email || "",
        fromCity, toCity, category,
        phone, dateText, comment,
        night, urgent, waitHours,
        status: "new",
        publicId,
        estimatePrice,
        estimateDetails,
        bookingPercent: 40,
        bookingAmount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        source: "cabinet"
      };

      const btn = $("#createOrderBtn");
      const old = btn?.textContent;
      if (btn){ btn.disabled=true; btn.classList.add("is-loading"); btn.textContent="Создаём…"; }

      try {
        await db.collection("orders").add(payload);
        toast("Заказ создан ✅ Мы свяжемся с вами.");
        showPanel("orders");
        $("#orderForm").reset();
        $("#estimateBox").style.display = "none";
        await loadOrders();
      } catch (e2) {
        toast("Не удалось создать заказ. Проверьте правила Firestore.");
      } finally {
        if (btn){ btn.disabled=false; btn.classList.remove("is-loading"); btn.textContent=old; }
      }
    });

    async function ensureUserDoc(u){
      const ref = db.collection("users").doc(u.uid);
      const snap = await ref.get();
      if (!snap.exists){
        await ref.set({
          email: u.email || "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          orders: 0,
          discount: 0,
        }, { merge: true });
      } else {
        await ref.set({ email: u.email || "", updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
    }

    async function checkAdmin(uid){
      try {
        const s = await db.collection("admins").doc(uid).get();
        if (s.exists){
          $("#adminLink").style.display = "";
        }
      } catch(e){}
    }

    async function loadOrders(){
      const u = auth.currentUser;
      if (!u) return;
      const wrap = $("#ordersList");
      if (wrap) wrap.innerHTML = `<div class="card" style="grid-column:1/-1;"><small class="note">Загрузка…</small></div>`;

      let docs = [];
      try {
        // without orderBy to avoid composite indexes; sort locally
        const snap = await db.collection("orders").where("userUid","==",u.uid).limit(200).get();
        snap.forEach(d => docs.push({ id:d.id, ...d.data() }));
      } catch(e){
        docs = [];
      }
      docs.sort((a,b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

      const total = docs.length;
      const done = docs.filter(o => o.status === "done").length;
      const disc = discountFor(done);

      $("#cabOrders").textContent = String(total);
      $("#cabDone").textContent = String(done);
      $("#cabDiscount").textContent = String(disc) + "%";
      $("#cabNextTier").textContent = nextTierText(done);

      // show estimate box if exists
      fillEstimateBox(readEstimate(u.uid), disc);

      renderOrders(docs);
    }

    // Auth state
    auth.onAuthStateChanged(async (u) => {
      if (!u) {
        location.href = "login.html?next=cabinet.html";
        return;
      }
      $("#cabEmail").textContent = u.email || "—";
      try {
        localStorage.setItem("auth_uid", u.uid);
        localStorage.setItem("auth_email", u.email || "");
      } catch(e){}

      try { await ensureUserDoc(u); } catch(e){}
      await checkAdmin(u.uid);
      await loadOrders();
    });
  }

  document.addEventListener("DOMContentLoaded", main);
})();
