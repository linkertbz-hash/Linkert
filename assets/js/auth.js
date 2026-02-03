/* АвтоПерегон PRO — auth.js (Firebase-only)
   Вход/регистрация работают через Firebase Authentication (Email/Password).
*/
(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = "none"), 2600);
  }

  function normalizeEmail(input) {
    return String(input || "").trim().toLowerCase();
  }

  function firebaseEnabled() {
    const cfg = (window.PEREGON_FIREBASE && window.PEREGON_FIREBASE.config) || null;
    const enabled = !!(window.PEREGON_FIREBASE && window.PEREGON_FIREBASE.enabled);
    if (!enabled || !cfg) return false;
    const bad = Object.values(cfg).some(v => typeof v === "string" && v.startsWith("YOUR_"));
    return !bad && typeof window.firebase !== "undefined";
  }

  function initFirebase() {
    const cfg = window.PEREGON_FIREBASE.config;
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
    const auth = firebase.auth();
    try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (_) {}
    return { auth, db: firebase.firestore() };
  }

  async function ensureUserDocFast(db, uid, email) {
    const ref = db.collection("users").doc(uid);
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    try {
      await ref.update({ email, lastLoginAt: ts });
    } catch (_) {
      await ref.set({ email, orders: 0, createdAt: ts, lastLoginAt: ts }, { merge: true });
    }
  }

  function authErrorMessage(err, kind) {
    const code = (err && err.code) ? String(err.code) : "";
    // kind: "login" | "register"
    if (code === "auth/invalid-login-credentials" || code === "auth/wrong-password") return "Неверный пароль";
    if (code === "auth/user-not-found") return "Аккаунт не найден";
    if (code === "auth/invalid-email") return "Некорректный email";
    if (code === "auth/too-many-requests") return "Слишком много попыток. Попробуйте позже";
    if (code === "auth/network-request-failed") return "Проблема с сетью. Проверьте интернет";
    if (kind === "register") {
      if (code === "auth/email-already-in-use") return "Этот email уже зарегистрирован";
      if (code === "auth/weak-password") return "Пароль слишком простой (минимум 6 символов)";
      if (code === "auth/operation-not-allowed") return "Регистрация отключена в настройках Firebase";
    }
    // Fallback: не показываем технические коды пользователю
    return kind === "register" ? "Ошибка регистрации" : "Ошибка входа";
  }

  function setBtnLoading(btn, loadingText) {
    if (!btn) return () => {};
    const prev = btn.textContent;
    btn.classList.add("is-loading");
    btn.disabled = true;
    btn.textContent = loadingText || prev;
    return () => {
      btn.classList.remove("is-loading");
      btn.disabled = false;
      btn.textContent = prev;
    };
  }

  let fb = null;
  if (firebaseEnabled()) {
    try { fb = initFirebase(); } catch (_) { fb = null; }
  } else {
    toast("Firebase не настроен. Проверь assets/js/firebase-config.js");
  }

  const loginForm = $("#loginForm");
  const regForm = $("#regForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = normalizeEmail($("#loginEmail")?.value);
      const pass = String($("#loginPass")?.value || "");
      if (!email || !email.includes("@")) return toast("Введите корректный email");
      if (pass.length < 4) return toast("Пароль слишком короткий");

      const btn = $("#loginBtn") || loginForm.querySelector('button[type="submit"]');
      const done = setBtnLoading(btn, "Входим…");

      try {
        fb = fb || initFirebase();
        const cred = await fb.auth.signInWithEmailAndPassword(email, pass);
        await ensureUserDocFast(fb.db, cred.user.uid, email);
        try { localStorage.setItem("auth_email", email); localStorage.setItem("auth_uid", cred.user.uid); } catch (_) {}
        window.location.replace("cabinet.html");
      } catch (err) {
        toast(authErrorMessage(err, "login"));
      } finally {
        done();
      }
    });
  }

  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = normalizeEmail($("#regEmail")?.value);
      const pass = String($("#regPass")?.value || "");
      const pass2 = String($("#regPass2")?.value || "");
      if (!email || !email.includes("@")) return toast("Введите корректный email");
      if (pass.length < 6) return toast("Пароль минимум 6 символов");
      if (pass !== pass2) return toast("Пароли не совпадают");

      const btn = $("#registerBtn") || regForm.querySelector('button[type="submit"]');
      const done = setBtnLoading(btn, "Регистрируем…");

      try {
        fb = fb || initFirebase();
        const cred = await fb.auth.createUserWithEmailAndPassword(email, pass);
        await ensureUserDocFast(fb.db, cred.user.uid, email);
        try { localStorage.setItem("auth_email", email); localStorage.setItem("auth_uid", cred.user.uid); } catch (_) {}
        window.location.replace("cabinet.html");
      } catch (err) {
        toast(authErrorMessage(err, "register"));
      } finally {
        done();
      }
    });
  }
})();