/* АвтоПерегон PRO — reviews.js */
(function () {
  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function toast(msg){
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
    return !bad && typeof window.firebase !== "undefined" && typeof firebase.firestore === "function";
  }

  function initFirebase() {
    const cfg = window.PEREGON_FIREBASE.config;
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
    return { db: firebase.firestore(), auth: firebase.auth() };
  }

  function stars(n){
    const k = Math.max(1, Math.min(5, Number(n)||5));
    return "★★★★★".slice(0,k) + "☆☆☆☆☆".slice(0,5-k);
  }

  function fmtDate(ts){
    try {
      const d = ts?.toDate ? ts.toDate() : (typeof ts === "number" ? new Date(ts) : null);
      if (!d) return "";
      return d.toLocaleDateString("ru-RU");
    } catch(e){ return ""; }
  }

  async function loadReviews() {
    const wrap = $("#reviewsList");
    if (!wrap) return;
    if (!firebaseEnabled()) {
      wrap.innerHTML = '<div class="card" style="grid-column:1/-1;"><b>Отзывы</b><p class="note">Firebase не подключен. Чтобы отзывы работали онлайн, включите Firebase в <code>assets/js/firebase-config.js</code>.</p></div>';
      return;
    }

    const { db } = initFirebase();
    wrap.innerHTML = '<div class="card" style="grid-column:1/-1;"><small class="note">Загрузка отзывов…</small></div>';
    try {
      const snap = await db.collection("reviews").where("published","==",true).orderBy("createdAt","desc").limit(60).get();
      if (snap.empty) {
        wrap.innerHTML = '<div class="card" style="grid-column:1/-1;"><b>Пока нет опубликованных отзывов</b><p class="note">Оставьте отзыв — он появится после модерации.</p></div>';
        return;
      }
      const items = [];
      snap.forEach(doc => {
        const r = doc.data() || {};
        items.push({
          id: doc.id,
          name: (r.name || "Клиент").toString(),
          rating: r.rating || 5,
          text: (r.text || "").toString(),
          route: (r.route || "").toString(),
          createdAt: r.createdAt
        });
      });

      wrap.innerHTML = items.map(r => `
        <div class="card review-card">
          <div class="review-top">
            <b>${escapeHtml(r.name)}</b>
            <span class="pill">${stars(r.rating)}</span>
          </div>
          ${r.route ? `<div class="note" style="margin-top:6px;">Маршрут: <b>${escapeHtml(r.route)}</b></div>` : ``}
          <p style="margin:10px 0 0;">${escapeHtml(r.text).replace(/\n/g,"<br/>")}</p>
          <div class="note" style="margin-top:10px; opacity:.75;">${fmtDate(r.createdAt)}</div>
        </div>
      `).join("");
    } catch (e) {
      wrap.innerHTML = '<div class="card" style="grid-column:1/-1;"><b>Не удалось загрузить отзывы</b><p class="note">Проверьте правила Firestore и подключение Firebase.</p></div>';
    }
  }

  function escapeHtml(str){
    return String(str||"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  async function submitReview(e){
    e.preventDefault();
    const name = String($("#revName")?.value || "").trim();
    const route = String($("#revRoute")?.value || "").trim();
    const rating = Number($("#revRating")?.value || 5);
    const text = String($("#revText")?.value || "").trim();
    const honey = String($("#revSite")?.value || "").trim(); // honeypot

    if (honey) { toast("Спасибо!"); return; } // bots
    if (!name || name.length < 2) { toast("Укажите имя"); return; }
    if (!text || text.length < 20) { toast("Напишите отзыв (минимум 20 символов)"); return; }

    if (!firebaseEnabled()) {
      toast("Firebase не подключен — отзыв не отправлен");
      return;
    }

    const btn = $("#revSubmit");
    const old = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.classList.add("is-loading"); btn.textContent = "Отправляем…"; }

    try {
      const { db, auth } = initFirebase();
      const u = auth.currentUser;
      const payload = {
        name,
        route,
        rating: Math.max(1, Math.min(5, rating || 5)),
        text,
        published: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        source: "website"
      };
      if (u) {
        payload.userUid = u.uid;
        payload.userEmail = u.email || "";
      }
      await db.collection("reviews").add(payload);
      toast("Отзыв отправлен ✅ Появится после модерации.");
      $("#revName").value = "";
      $("#revRoute").value = "";
      $("#revText").value = "";
      $("#revRating").value = "5";
      await loadReviews();
    } catch (e2) {
      toast("Не удалось отправить отзыв. Проверьте правила Firestore.");
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove("is-loading"); btn.textContent = old; }
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    const form = $("#reviewForm");
    if (form) form.addEventListener("submit", submitReview);
    loadReviews();
  });
})();
