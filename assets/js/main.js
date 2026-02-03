/* АвтоПерегон PRO — main.js */
(function () {
  const TG_USER = "linkertxz";
  const PHONE_E164 = "+79950202019";
  const VK_URL = "https://vk.ru/id1060477401";

  // ---------- Firebase (для заявок "на сайте") ----------
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
    return { db: firebase.firestore() };
  }

  async function sendLeadToFirestore(payload) {
    if (!firebaseEnabled()) return { ok: false, reason: "firebase-disabled" };
    try {
      const { db } = initFirebase();
      const ts = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("leads").add({ ...payload, ts, source: "website" });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: "write-failed", error: e };
    }
  }

  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = "none"), 2600);
  }

  function normalizePhone(input) {
    if (!input) return "";
    const digits = String(input).replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("8")) return "+7" + digits.slice(1);
    if (digits.length === 11 && digits.startsWith("7")) return "+" + digits;
    if (digits.length === 10) return "+7" + digits;
    return input.startsWith("+") ? input : ("+" + digits);
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  function openTelegram(message) {
    const text = encodeURIComponent(message || "");
    const httpsUrl = "https://t.me/" + TG_USER + (message ? ("?text=" + text) : "");
    // deep link
    if (isMobile()) {
      const tgUrl = "tg://resolve?domain=" + TG_USER + (message ? ("&text=" + text) : "");
      window.location.href = tgUrl;
      setTimeout(() => window.open(httpsUrl, "_blank"), 550);
    } else {
      window.open(httpsUrl, "_blank");
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Скопировано: " + text);
      return true;
    } catch (e) {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Скопировано: " + text);
        return true;
      } catch (e2) {
        toast("Не удалось скопировать");
        return false;
      }
    }
  }

  // ---------- Smooth scroll ----------
  $all('a[href^="#"]').forEach(a => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id && id.length > 1 ? document.querySelector(id) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // ---------- Floating contact FAB ----------
  const fab = $("#contactFab");
  const fabBtn = $("#contactFabBtn");
  const fabMenu = $("#contactFabMenu");

  function closeFab() {
    if (!fab) return;
    fab.classList.remove("open");
  }
  function toggleFab() {
    if (!fab) return;
    fab.classList.toggle("open");
  }
  if (fabBtn) fabBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleFab();
  });
  document.addEventListener("click", (e) => {
    if (!fab) return;
    if (fab.contains(e.target)) return;
    closeFab();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFab();
  });

  // Generic contact triggers
  $all('[data-contact="tg"]').forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openTelegram("Здравствуйте! Хочу заказать услугу. Опишите, пожалуйста, маршрут/задачу — я отвечу.");
      closeFab();
    });
  });

  $all('[data-contact="max"]').forEach(el => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      await copyToClipboard(PHONE_E164);
      toast("Номер скопирован — откройте MAX и вставьте.");
      closeFab();
    });
  });

  // Telegram buttons by IDs (на старых кнопках)
  const tgIds = ["tgHeaderBtn", "tgHeroBtn", "tgHowBtn", "tgContactsBtn", "tgBtn", "tgAfterBtn", "tgFloatBtn"];
  tgIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openTelegram("Здравствуйте! Хочу заказать услугу по перегону авто. Укажите, пожалуйста, маршрут и категорию (B/C/D/CE).");
    });
  });


  // ---------- Callback request (floating "Заказать звонок") ----------
  const cbBtn = $("#callbackFabBtn");
  const cbModal = $("#callbackModal");
  const cbForm = $("#callbackForm");
  const cbPhone = $("#callbackPhone");
  const cbName = $("#callbackName");
  const cbTime = $("#callbackTime");
  const cbComment = $("#callbackComment");
  const cbSendBtn = $("#callbackSendBtn");

  function utmPayload() {
    try {
      const p = new URLSearchParams(location.search || "");
      const keys = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"];
      const out = {};
      keys.forEach(k => { const v = p.get(k); if (v) out[k] = v; });
      return out;
    } catch (_) { return {}; }
  }

  function openCallback() {
    if (!cbModal) return;
    cbModal.classList.add("open");
    cbModal.setAttribute("aria-hidden", "false");
    setTimeout(() => { try { cbPhone && cbPhone.focus(); } catch (_) {} }, 30);
  }
  function closeCallback() {
    if (!cbModal) return;
    cbModal.classList.remove("open");
    cbModal.setAttribute("aria-hidden", "true");
  }

  if (cbBtn && cbModal) {
    cbBtn.addEventListener("click", (e) => { e.preventDefault(); openCallback(); });

    cbModal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.dataset && t.dataset.close === "1")) closeCallback();
      // клик по фону
      if (t && t.classList && t.classList.contains("modal-backdrop")) closeCallback();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && cbModal.classList.contains("open")) closeCallback();
    });
  }

  if (cbForm) {
    cbForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = String(cbName?.value || "").trim();
      const phone = normalizePhone(String(cbPhone?.value || ""));
      const timeVal = String(cbTime?.value || "asap");
      const comment = String(cbComment?.value || "").trim();

      if (!phone || phone.replace(/\D/g, "").length < 10) { toast("Укажите номер телефона"); return; }

      const timeMap = {
        asap: "Как можно скорее",
        "15m": "В течение 15 минут",
        "1h": "В течение часа",
        today: "Сегодня",
        tomorrow: "Завтра"
      };
      const when = timeMap[timeVal] || "Как можно скорее";

      const userUid = String(localStorage.getItem("auth_uid") || "").trim();
      const userEmail = String(localStorage.getItem("auth_email") || "").trim();

      const msg = [
        "Заявка: Заказать звонок",
        name ? ("Имя: " + name) : null,
        "Телефон: " + phone,
        "Когда удобно: " + when,
        comment ? ("Комментарий: " + comment) : null,
        "Страница: " + location.pathname,
      ].filter(Boolean).join("\n");

      const payload = {
        type: "callback",
        name, phone,
        preferredTime: when,
        comment,
        page: location.pathname,
        msg,
        status: "new",
        utm: utmPayload()
      };
      if (userUid) payload.userUid = userUid;
      if (userEmail) payload.userEmail = userEmail;

      const prev = cbSendBtn ? cbSendBtn.textContent : "";
      if (cbSendBtn) { cbSendBtn.disabled = true; cbSendBtn.textContent = "Отправляем…"; cbSendBtn.classList.add("is-loading"); }

      try {
        const res = await sendLeadToFirestore(payload);
        if (res.ok) {
          toast("Заявка отправлена ✅ Перезвоним в ближайшее время.");
          try { cbForm.reset(); } catch (_) {}
          closeCallback();
          return;
        }
        // fallback — отправить в Telegram
        toast("Не удалось отправить — открою Telegram.");
        openTelegram(msg);
      } finally {
        if (cbSendBtn) { cbSendBtn.disabled = false; cbSendBtn.textContent = prev || "Отправить"; cbSendBtn.classList.remove("is-loading"); }
      }
    });
  }


  // ---------- Peregon calculator ----------
  const calcForm = $("#peregonCalc");
  if (calcForm) {
    const out = $("#calcOut");
    const outPrice = $("#outPrice");
    const outDetails = $("#outDetails");
    const leadWrap = $("#leadWrap");
    const leadForm = $("#leadForm");
    const leadMsg = $("#leadMsg");

    const categorySel = $("#category");
    const cWeightWrap = $("#cWeightWrap");
    const dTypeWrap = $("#dTypeWrap");
    const ceLoadWrap = $("#ceLoadWrap");
    const ticketWrap = $("#ticketWrap");
    const urgentWrap = $("#urgentWrap");
    const waitWrap = $("#waitWrap");

    function money(n) {
      try { return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽"; }
      catch (_) { return Math.round(n) + " ₽"; }
    }

    function getRate(category, oneWayKm, opts) {
      const km = oneWayKm;
      if (category === "B") {
        if (km <= 200) return 35;
        if (km <= 800) return 32;
        return 30;
      }
      if (category === "C") {
        const w = opts.cWeight || "c10";
        if (w === "c20") {
          if (km <= 200) return 65;
          if (km <= 600) return 60;
          return 55;
        } else {
          if (km <= 200) return 55;
          if (km <= 600) return 50;
          return 45;
        }
      }
      if (category === "D") {
        const t = opts.dType || "dSmall";
        if (t === "dBig") {
          if (km <= 200) return 100; // в тарифах была дыра 101–200, считаем как до 100
          if (km <= 600) return 90;
          return 85;
        } else {
          if (km <= 200) return 80;
          if (km <= 600) return 75;
          return 70;
        }
      }
      if (category === "CE") {
        if (km <= 200) return 120; // в тарифах была дыра 101–200, считаем как до 100
        if (km <= 600) return 110;
        return 100;
      }
      return 0;
    }

    function calcPrice(data) {
      const from = String(data.from || "").trim();
      const to = String(data.to || "").trim();
      const oneWay = Math.max(0, Number(data.km || 0));
      const roundKm = oneWay * 2;

      const category = data.category || "B";
      const night = !!data.night;
      const urgent = !!data.urgent;
      const waitHours = Math.max(0, Number(data.waitHours || 0));
      const waitBillHours = waitHours > 0 ? Math.ceil(waitHours) : 0;

      const opts = {
        cWeight: data.cWeight || "c10",
        dType: data.dType || "dSmall",
        ceLoad: Number(data.ceLoad || 0)
      };

      const rate = getRate(category, oneWay, opts);

      let service = 0;
      let min = 0;
      let fixedAdd = 0;
      let mult = 1;

      const lines = [];
      if (category === "B") {
        if (oneWay <= 75) {
          const ticket = Math.max(0, Number(data.ticket || 0));
          service = 6000;
          lines.push(`B до 75 км: базовая стоимость 6 000 ₽`);
          if (night) {
            service *= 1.2;
            lines.push(`Ночь: +20%`);
          }
          if (urgent) {
            service *= 1.2;
            lines.push(`Срочно: +20%`);
          }
          fixedAdd += ticket;
          lines.push(`Билет обратно: ${money(ticket)}`);
        } else {
          service = Math.max(roundKm * rate, 6000);
          lines.push(`B: расчёт по кругу ${roundKm} км × ${rate} ₽/км`);
          if (night) {
            service *= 1.2;
            lines.push(`Ночь: +20%`);
          }
          if (urgent) {
            service *= 1.2;
            lines.push(`Срочно: +20%`);
          }
        }
      }

      if (category === "C") {
        if (opts.cWeight === "c20") {
          min = 15000;
          lines.push(`C 10–20 т: минимум ${money(min)}`);
        } else {
          min = 12000;
          lines.push(`C до 10 т: минимум ${money(min)}`);
        }
        service = Math.max(roundKm * rate, min);
        lines.push(`Расчёт по кругу ${roundKm} км × ${rate} ₽/км`);
        if (night) {
          service *= 1.2;
          lines.push(`Ночь: +20%`);
        }
        if (urgent) {
          fixedAdd += 2000;
          lines.push(`Срочно: +2 000 ₽`);
        }
        if (waitBillHours > 0) {
          fixedAdd += waitBillHours * 800;
          lines.push(`Ожидание: ${waitBillHours} ч × 800 ₽/ч`);
        }
      }

      if (category === "D") {
        if (opts.dType === "dBig") {
          min = 25000;
          lines.push(`D большой/туристический: минимум ${money(min)}`);
        } else {
          min = 18000;
          lines.push(`D малый/средний: минимум ${money(min)}`);
        }
        service = Math.max(roundKm * rate, min);
        lines.push(`Расчёт по кругу ${roundKm} км × ${rate} ₽/км`);
        if (night) {
          service *= 1.2;
          lines.push(`Ночь: +20%`);
        }
      }

      if (category === "CE") {
        min = 25000;
        service = Math.max(roundKm * rate, min);
        lines.push(`CE: минимум ${money(min)}`);
        lines.push(`Расчёт по кругу ${roundKm} км × ${rate} ₽/км`);
        if (opts.ceLoad > 0) {
          mult *= (1 + opts.ceLoad / 100);
          lines.push(`Гружёный прицеп: +${opts.ceLoad}%`);
        }
        service *= mult;

        if (night) {
          service *= 1.25;
          lines.push(`Ночь: +25%`);
        }
        if (urgent) {
          fixedAdd += 5000;
          lines.push(`Срочно: +5 000 ₽`);
        }
        if (waitBillHours > 0) {
          fixedAdd += waitBillHours * 2000;
          lines.push(`Ожидание: ${waitBillHours} ч × 2 000 ₽/ч`);
        }
      }

      const price = service + fixedAdd;

      // details text
      const details = [
        `Маршрут: ${from} → ${to}`,
        `Категория: ${category}`,
        (category === "B" && oneWay <= 75) ? `Расстояние: ${oneWay} км (до 75)` : `Расстояние: ${oneWay} км (круг: ${roundKm} км)`,
        ...lines.map(s => "• " + s)
      ].join("\n");

      return { price, details, oneWay, roundKm, category, rate };
    }

    function updateVisibility() {
      const c = categorySel ? categorySel.value : "B";
      cWeightWrap.style.display = (c === "C") ? "" : "none";
      dTypeWrap.style.display = (c === "D") ? "" : "none";
      ceLoadWrap.style.display = (c === "CE") ? "" : "none";
      ticketWrap.style.display = (c === "B") ? "" : "none";
      urgentWrap.style.display = (c === "B" || c === "C" || c === "CE") ? "" : "none";
      // Текст для "Срочно" зависит от категории
      try {
        const lab = document.getElementById("urgentLabel");
        if (lab) lab.textContent = (c === "B") ? "Срочно (+20%)" : "Срочно";
      } catch (_) { }

      waitWrap.style.display = (c === "C" || c === "CE") ? "" : "none";
    }

    if (categorySel) categorySel.addEventListener("change", updateVisibility);
    updateVisibility();

    // Prefill from URL (для страниц направлений/блога)
    try {
      const p = new URLSearchParams(location.search || "");
      const qFrom = p.get("from");
      const qTo = p.get("to");
      const qKm = p.get("km");
      const qCat = p.get("category");

      const fromEl = document.getElementById("from");
      const toEl = document.getElementById("to");
      const kmEl = document.getElementById("km");

      if (qFrom && fromEl && !fromEl.value) fromEl.value = qFrom;
      if (qTo && toEl && !toEl.value) toEl.value = qTo;
      if (qKm && kmEl && !kmEl.value) kmEl.value = qKm;
      if (qCat && categorySel) categorySel.value = qCat;

      updateVisibility();

      // если передан auto=1 — сразу считаем
      if (p.get("auto") === "1") {
        setTimeout(function () {
          try { calcForm.requestSubmit(); } catch (_) {}
        }, 50);
      }
    } catch (_) {}

    calcForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(calcForm);
      const data = Object.fromEntries(fd.entries());
      data.night = !!fd.get("night");
      data.urgent = !!fd.get("urgent");

      const km = Number(data.km || 0);
      if (!km || km <= 0) {
        toast("Укажите расстояние (км) в одну сторону");
        return;
      }

      const r = calcPrice(data);
      out.style.display = "block";
      outPrice.textContent = money(r.price);
      outDetails.textContent = r.details;
      if (leadWrap) leadWrap.style.display = "block";

      // автозаполнение текста для заявки
      if (leadMsg) {
        leadMsg.value = [
          `Маршрут: ${String(data.from || "").trim()} → ${String(data.to || "").trim()}`,
          `Категория: ${data.category}`,
          `Расстояние (1 сторона): ${km} км (круг: ${km * 2} км)`,
          `Оценка: ${money(r.price)}`,
          `Доп. условия: ${data.night ? "ночь" : "день"}${data.urgent ? ", срочно" : ""}`
        ].join("\n");
      }

      toast("Готово. Нажмите «Написать в Telegram» — зафиксируем цену.");

      try {
        const uid = String(localStorage.getItem("auth_uid") || "").trim();
        const key = uid ? ("last_estimate_" + uid) : "last_estimate_guest";
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data, r }));
      } catch (_) { }
    });

    const leadSendSiteBtn = document.getElementById("leadSendSiteBtn");
    if (leadSendSiteBtn && leadForm) {
      leadSendSiteBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const name = String($("#leadName")?.value || "").trim();
        const phone = normalizePhone(String($("#leadPhone")?.value || ""));
        const msg = String($("#leadMsg")?.value || "").trim();
        if (!phone || phone.length < 10) { toast("Укажите номер телефона"); return; }

        // Если пользователь авторизован (на этом домене), привязываем заявку к аккаунту
        // (на главной странице нет Firebase Auth скрипта, поэтому берём UID/Email из localStorage)
        const userUid = String(localStorage.getItem("auth_uid") || "").trim();
        const userEmail = String(localStorage.getItem("auth_email") || "").trim();
        const payload = { name, phone, msg, status: "new" };
        if (userUid) payload.userUid = userUid;
        if (userEmail) payload.userEmail = userEmail;

        const prev = leadSendSiteBtn.textContent;
        leadSendSiteBtn.classList.add("is-loading");
        leadSendSiteBtn.disabled = true;
        leadSendSiteBtn.textContent = "Отправляем…";
        try {
          const res = await sendLeadToFirestore(payload);
          if (res.ok) {
            toast("Заявка отправлена ✅ Мы свяжемся с вами.");
            try {
              const leads = JSON.parse(localStorage.getItem("leads") || "[]");
              leads.unshift({ ts: Date.now(), name, phone, msg, source: "website" });
              localStorage.setItem("leads", JSON.stringify(leads.slice(0, 50)));
            } catch (_) {}
            return;
          }
          toast("Не удалось отправить. Нажмите Telegram или позвоните.");
        } finally {
          leadSendSiteBtn.classList.remove("is-loading");
          leadSendSiteBtn.disabled = false;
          leadSendSiteBtn.textContent = prev;
        }
      });
    }

    if (leadForm) {
      leadForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = String($("#leadName")?.value || "").trim();
        const phone = normalizePhone(String($("#leadPhone")?.value || ""));
        const msg = String($("#leadMsg")?.value || "").trim();

        if (!phone || phone.length < 10) {
          toast("Укажите номер телефона");
          return;
        }

        const text = [
          "Заявка с сайта АвтоПерегон PRO",
          name ? ("Имя: " + name) : null,
          "Телефон: " + phone,
          "",
          msg
        ].filter(Boolean).join("\n");

        // сохраняем лид локально (на всякий)
        try {
          const leads = JSON.parse(localStorage.getItem("leads") || "[]");
          leads.unshift({ ts: Date.now(), name, phone, msg });
          localStorage.setItem("leads", JSON.stringify(leads.slice(0, 50)));
        } catch (_) { }

        openTelegram(text);
      });
    }
  }

  // ---------- Sober driver calculator (если есть на странице) ----------
  const soberForm = $("#soberCalc");
  if (soberForm) {
    const out = $("#soberOut");
    const outPrice = $("#soberPrice");
    const outDetails = $("#soberDetails");
    const hoursInput = $("#sdHours");

    function money(n) {
      try { return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽"; }
      catch (_) { return Math.round(n) + " ₽"; }
    }

    soberForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const hours = Math.max(1, Number(hoursInput ? hoursInput.value : 1));
      const min = 2000;
      const extra = 900;
      const price = min + Math.max(0, hours - 1) * extra;

      if (out) out.style.display = "block";
      if (outPrice) outPrice.textContent = money(price);
      if (outDetails) outDetails.textContent = `Время: ${hours} ч · Минимум ${money(min)}, далее 1 час — ${money(extra)}.`;

      try { localStorage.setItem("last_sober", JSON.stringify({ ts: Date.now(), hours, price })); } catch (_) { }

      toast("Готово. Напишите — уточним адрес и время.");
    });
  }
})();
