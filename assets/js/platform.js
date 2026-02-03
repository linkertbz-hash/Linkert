/* АвтоПерегон PRO — platform.js
   Небольшие улучшения интерфейса для многостраничной версии:
   - мобильное меню
   - фильтры (направления/блог)
*/
(function () {
  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function initNavToggle(){
    var btn = $("#navToggle");
    var links = $("#navLinks");
    if (!btn || !links) return;

    function close(){
      document.body.classList.remove("nav-open");
      btn.setAttribute("aria-expanded", "false");
    }
    function toggle(){
      var open = document.body.classList.toggle("nav-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function(){ toggle(); });
    // close on click
    $all("#navLinks a").forEach(function(a){
      a.addEventListener("click", function(){ close(); }, true);
    });
    // close on escape
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape") close();
    });
  }

  function initSimpleFilter(inputId, itemSel, emptyId){
    var input = document.getElementById(inputId);
    if (!input) return;
    var items = $all(itemSel);
    var empty = document.getElementById(emptyId);

    function norm(s){ return String(s||"").toLowerCase().replace(/\s+/g,' ').trim(); }
    function apply(){
      var q = norm(input.value);
      var shown = 0;
      items.forEach(function(it){
        var hay = norm(it.getAttribute("data-hay") || it.textContent);
        var ok = !q || hay.indexOf(q) !== -1;
        it.style.display = ok ? "" : "none";
        if (ok) shown++;
      });
      if (empty) empty.style.display = shown ? "none" : "";
    }
    input.addEventListener("input", apply);
    apply();
  }

  document.addEventListener("DOMContentLoaded", function(){
    initNavToggle();
    initSimpleFilter("routesFilter", ".route-card", "routesEmpty");
    initSimpleFilter("blogFilter", ".post-card", "blogEmpty");
  });
})();