/* АвтоПерегон PRO — admin.js (заказы + лиды + отзывы + пользователи) */
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

  function escapeHtml(str){
    return String(str||"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function fmt(ts){
    try {
      const d = ts?.toDate ? ts.toDate() : (typeof ts === "number" ? new Date(ts) : null);
      return d ? d.toLocaleString("ru-RU") : "";
    } catch(e){ return ""; }
  }
  function money(n){
    try { return new Intl.NumberFormat("ru-RU").format(Math.round(Number(n)||0)) + " ₽"; }
    catch(e){ return (Math.round(Number(n)||0) + " ₽"); }
  }

  const STATUS = [
    ["new","Новый"],
    ["inwork","В работе"],
    ["assigned","Назначен водитель"],
    ["onroute","В пути"],
    ["paid","Бронь оплачена"],
    ["done","Выполнено"],
    ["cancelled","Отменено"],
    ["spam","Спам"]
  ];

  function setActiveTab(tab){
    const map = {
      orders: $("#tabOrders"),
      leads: $("#tabLeads"),
      reviews: $("#tabReviews"),
      users: $("#tabUsers"),
      stats: $("#tabStats"),
    };
    Object.keys(map).forEach(k => { if (map[k]) map[k].style.display = (k===tab ? "" : "none"); });
    $all(".admin-tabs button").forEach(b => {
      b.classList.toggle("primary", b.dataset.tab === tab);
      b.classList.toggle("ghost", b.dataset.tab !== tab);
    });
  }

  async function main(){
    if (!firebaseEnabled()){
      toast("Firebase не подключен — админка не работает");
      $("#authGate").innerHTML = "<b>Firebase не подключен</b><p class='note'>Включите Firebase в assets/js/firebase-config.js</p>";
      return;
    }

    const { db, auth } = initFirebase();

    // tabs
    $all(".admin-tabs button").forEach(btn => {
      btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
    });
    setActiveTab("orders");

    $("#logoutBtn")?.addEventListener("click", async () => {
      try { await auth.signOut(); } catch(e){}
      try { localStorage.removeItem("auth_uid"); localStorage.removeItem("auth_email"); } catch(e){}
      location.href = "login.html";
    });

    function filterTable(wrapSel, q){
      const ql = String(q||"").trim().toLowerCase();
      $all(wrapSel + " [data-hay]").forEach(row => {
        const hay = String(row.getAttribute("data-hay")||"").toLowerCase();
        row.style.display = (!ql || hay.includes(ql)) ? "" : "none";
      });
    }

    $("#ordersSearch")?.addEventListener("input", e => filterTable("#ordersTableWrap", e.target.value));
    $("#leadsSearch")?.addEventListener("input", e => filterTable("#leadsTableWrap", e.target.value));
    $("#reviewsSearch")?.addEventListener("input", e => filterTable("#reviewsTableWrap", e.target.value));
    $("#usersSearch")?.addEventListener("input", e => filterTable("#usersTableWrap", e.target.value));

    $("#ordersReload")?.addEventListener("click", () => loadOrders());
    $("#leadsReload")?.addEventListener("click", () => loadLeads());
    $("#reviewsReload")?.addEventListener("click", () => loadReviews());
    $("#usersReload")?.addEventListener("click", () => loadUsers());

    async function checkAdmin(u){
      const s = await db.collection("admins").doc(u.uid).get();
      return s.exists;
    }

    async function loadOrders(){
      const wrap = $("#ordersTableWrap");
      if (!wrap) return;
      wrap.innerHTML = "<small class='note'>Загрузка…</small>";
      let items = [];
      try {
        const snap = await db.collection("orders").limit(250).get();
        snap.forEach(doc => items.push({ id:doc.id, ...doc.data() }));
      } catch(e){
        wrap.innerHTML = "<b>Ошибка загрузки заказов</b><p class='note'>Проверьте правила Firestore.</p>";
        return;
      }
      items.sort((a,b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

      const rows = items.map(o => {
        const route = `${o.fromCity||"—"} → ${o.toCity||"—"}`;
        const hay = `${route} ${o.phone||""} ${o.userEmail||""} ${o.status||""} ${o.publicId||""}`;
        const statusOpts = STATUS.map(([v,t]) => `<option value="${v}" ${String(o.status||"new")==v?"selected":""}>${t}</option>`).join("");
        const booking = (o.bookingAmount != null) ? money(o.bookingAmount) : "—";
        const est = (o.estimatePrice != null) ? money(o.estimatePrice) : "—";
        return `
          <tr data-hay="${escapeHtml(hay)}">
            <td>${fmt(o.createdAt)}<div class="note">№ <b>${escapeHtml(o.publicId||"")}</b></div></td>
            <td><b>${escapeHtml(route)}</b><div class="note">Кат.: <b>${escapeHtml(o.category||"B")}</b></div></td>
            <td>${escapeHtml(o.phone||"—")}<div class="note">${escapeHtml(o.userEmail||"")}</div></td>
            <td>
              <select class="admStatus" data-id="${escapeHtml(o.id)}">${statusOpts}</select>
              <div class="note">Оценка: <b>${est}</b></div>
              <div class="note">Бронь: <b>${booking}</b></div>
            </td>
            <td>
              <input class="admDriverName" data-id="${escapeHtml(o.id)}" placeholder="Водитель" value="${escapeHtml(o.driverName||"")}"/>
              <input class="admDriverPhone" data-id="${escapeHtml(o.id)}" placeholder="Телефон" value="${escapeHtml(o.driverPhone||"")}"/>
            </td>
            <td>
              <button class="btn small primary admSave" data-id="${escapeHtml(o.id)}" type="button">Сохранить</button>
            </td>
          </tr>
        `;
      }).join("");

      wrap.innerHTML = `
        <table class="table">
          <thead><tr>
            <th>Дата</th><th>Маршрут</th><th>Контакт</th><th>Статус</th><th>Водитель</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      $all(".admSave").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          const st = $(`.admStatus[data-id="${id}"]`)?.value || "new";
          const dn = $(`.admDriverName[data-id="${id}"]`)?.value || "";
          const dp = $(`.admDriverPhone[data-id="${id}"]`)?.value || "";
          try {
            await db.collection("orders").doc(id).set({
              status: st,
              driverName: dn,
              driverPhone: dp,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              ...(st === "done" ? { doneAt: firebase.firestore.FieldValue.serverTimestamp() } : {})
            }, { merge:true });
            toast("Сохранено ✅");
          } catch(e){
            toast("Ошибка сохранения");
          }
        });
      });
    }

    async function loadLeads(){
      const wrap = $("#leadsTableWrap");
      if (!wrap) return;
      wrap.innerHTML = "<small class='note'>Загрузка…</small>";
      let items = [];
      try {
        const snap = await db.collection("leads").limit(250).get();
        snap.forEach(doc => items.push({ id:doc.id, ...doc.data() }));
      } catch(e){
        wrap.innerHTML = "<b>Ошибка загрузки лидов</b><p class='note'>Проверьте правила Firestore.</p>";
        return;
      }
      items.sort((a,b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

      const rows = items.map(l => {
        const hay = `${l.name||""} ${l.phone||""} ${l.service||""} ${l.message||""} ${l.fromCity||""} ${l.toCity||""}`;
        return `
          <tr data-hay="${escapeHtml(hay)}">
            <td>${fmt(l.createdAt)}</td>
            <td><b>${escapeHtml(l.name||"—")}</b><div class="note">${escapeHtml(l.phone||"—")}</div></td>
            <td>${escapeHtml(l.service||"—")}</td>
            <td>${escapeHtml(l.fromCity||"")} ${l.toCity ? "→ " + escapeHtml(l.toCity) : ""}</td>
            <td class="note">${escapeHtml(l.message||"")}</td>
          </tr>
        `;
      }).join("");

      wrap.innerHTML = `
        <table class="table">
          <thead><tr><th>Дата</th><th>Контакт</th><th>Услуга</th><th>Маршрут</th><th>Сообщение</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    async function loadReviews(){
      const wrap = $("#reviewsTableWrap");
      if (!wrap) return;
      wrap.innerHTML = "<small class='note'>Загрузка…</small>";
      let items = [];
      try {
        const snap = await db.collection("reviews").limit(250).get();
        snap.forEach(doc => items.push({ id:doc.id, ...doc.data() }));
      } catch(e){
        wrap.innerHTML = "<b>Ошибка загрузки отзывов</b><p class='note'>Проверьте правила Firestore.</p>";
        return;
      }
      items.sort((a,b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

      const rows = items.map(r => {
        const hay = `${r.name||""} ${r.route||""} ${r.text||""} ${r.userEmail||""}`;
        return `
          <tr data-hay="${escapeHtml(hay)}">
            <td>${fmt(r.createdAt)}</td>
            <td><b>${escapeHtml(r.name||"Клиент")}</b><div class="note">${escapeHtml(r.userEmail||"")}</div></td>
            <td>${escapeHtml(r.route||"—")}</td>
            <td class="note" style="max-width:480px;">${escapeHtml(String(r.text||"")).slice(0,260)}${String(r.text||"").length>260?"…":""}</td>
            <td>
              <label class="pill" style="display:flex; gap:10px; align-items:center; justify-content:center;">
                <input class="admPublish" data-id="${escapeHtml(r.id)}" type="checkbox" ${r.published ? "checked":""} style="width:auto; margin:0;"> опубликован
              </label>
            </td>
          </tr>
        `;
      }).join("");

      wrap.innerHTML = `
        <table class="table">
          <thead><tr><th>Дата</th><th>Автор</th><th>Маршрут</th><th>Текст</th><th>Публикация</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      $all(".admPublish").forEach(ch => {
        ch.addEventListener("change", async () => {
          const id = ch.dataset.id;
          try {
            await db.collection("reviews").doc(id).set({
              published: !!ch.checked,
              moderatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge:true });
            toast("Сохранено ✅");
          } catch(e){
            toast("Ошибка сохранения");
          }
        });
      });
    }

    async function loadUsers(){
      const wrap = $("#usersTableWrap");
      if (!wrap) return;
      wrap.innerHTML = "<small class='note'>Загрузка…</small>";
      let items = [];
      try {
        const snap = await db.collection("users").limit(250).get();
        snap.forEach(doc => items.push({ id:doc.id, ...doc.data() }));
      } catch(e){
        wrap.innerHTML = "<b>Ошибка загрузки пользователей</b><p class='note'>Проверьте правила Firestore.</p>";
        return;
      }
      items.sort((a,b) => {
        const ea = String(a.email||"").toLowerCase();
        const eb = String(b.email||"").toLowerCase();
        return ea.localeCompare(eb);
      });

      const rows = items.map(u => {
        const hay = `${u.email||""} ${u.id||""}`;
        return `
          <tr data-hay="${escapeHtml(hay)}">
            <td><b>${escapeHtml(u.email||"—")}</b><div class="note">${escapeHtml(u.id)}</div></td>
            <td>${fmt(u.createdAt)}</td>
            <td>${fmt(u.updatedAt)}</td>
          </tr>
        `;
      }).join("");

      wrap.innerHTML = `
        <table class="table">
          <thead><tr><th>Email / UID</th><th>Создан</th><th>Обновлён</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    async function loadStats(){
      try {
        const s = await db.collection("stats").doc("public").get();
        if (!s.exists) return;
        const d = s.data() || {};
        $("#sRuns").value = (d.runs ?? "");
        $("#sPartners").value = (d.partners ?? "");
        $("#sRegions").value = (d.regions ?? "");
      } catch(e){}
    }
    $("#statsForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await db.collection("stats").doc("public").set({
          runs: Number($("#sRuns").value||0),
          partners: Number($("#sPartners").value||0),
          regions: Number($("#sRegions").value||0),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });
        $("#statsMsg").textContent = "Сохранено ✅";
        toast("Статистика сохранена");
      } catch(e){
        $("#statsMsg").textContent = "Ошибка сохранения. Проверьте правила Firestore.";
        toast("Ошибка сохранения");
      }
    });

    // auth
    auth.onAuthStateChanged(async (u) => {
      if (!u) { location.href = "login.html?next=admin.html"; return; }
      // store local for other pages
      try { localStorage.setItem("auth_uid", u.uid); localStorage.setItem("auth_email", u.email || ""); } catch(e){}
      let ok = false;
      try { ok = await checkAdmin(u); } catch(e){ ok = false; }
      if (!ok){
        $("#authGate").innerHTML = "<b>Доступ запрещён</b><p class='note'>Ваш аккаунт не отмечен как администратор. Добавьте документ <code>admins/&lt;UID&gt;</code> в Firestore.</p>";
        $("#adminPanel").style.display = "none";
        return;
      }
      $("#authGate").style.display = "none";
      $("#adminPanel").style.display = "";

      await loadOrders();
      await loadLeads();
      await loadReviews();
      await loadUsers();
      await loadStats();
    });
  }

  document.addEventListener("DOMContentLoaded", main);
})();
