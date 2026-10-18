(function () {
  "use strict";

  var header = document.getElementById("header");
  var nav = document.getElementById("nav");
  var menuToggle = document.getElementById("menuToggle");

  function onScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open) {
    if (!nav || !menuToggle) return;
    nav.classList.toggle("open", open);
    if (header) header.classList.toggle("menu-open", open);
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("open"));
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false);
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });
  }

  var sticky = document.getElementById("stickyCta");
  if (sticky) {
    var toggleSticky = function () {
      sticky.classList.toggle("visible", window.scrollY > 700);
    };
    toggleSticky();
    window.addEventListener("scroll", toggleSticky, { passive: true });
  }

  function text(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function showEmpty(box, title, message, link) {
    clear(box);
    var wrap = text("div", "live-empty");
    wrap.appendChild(text("p", "live-empty-title", title));
    if (message) wrap.appendChild(text("p", null, message));
    if (link) {
      var more = document.createElement("p");
      var anchor = document.createElement("a");
      anchor.href = link.href;
      anchor.textContent = link.label;
      more.appendChild(anchor);
      wrap.appendChild(more);
    }
    box.appendChild(wrap);
  }

  function renderMatch(match) {
    var card = text("article", "live-card");
    var head = document.createElement("header");
    head.appendChild(text("span", "live-badge", "En juego"));
    head.appendChild(text("span", "live-comp", match.competition || "Tenis"));
    card.appendChild(head);

    function row(name, score) {
      var line = text("div", "score-row");
      line.appendChild(text("span", null, name || "Jugador"));
      line.appendChild(text("strong", null, score == null || score === "" ? "–" : String(score)));
      return line;
    }
    card.appendChild(row(match.home, match.home_score));
    card.appendChild(row(match.away, match.away_score));
    return card;
  }

  function isLive(match) {
    var status = String(match && match.status || "").toLowerCase();
    return status === "live" || status === "inprogress" || status === "in_progress";
  }

  var LIVE_RESULT = "Último resultado: Chwalińska gana a Kartal 2-6, 6-4 y 6-2 en la final de Wuhan.";
  var LIVE_LINK = { href: "resultados.html", label: "Resultados" };

  async function loadLiveMatches(options) {
    var box = document.getElementById("liveMatches");
    var button = document.getElementById("refreshLive");
    if (!box) return;
    if (button) button.disabled = true;
    if (options && options.announce) {
      showEmpty(box, "Consultando SportScore…", "Buscamos los partidos que se están jugando.");
    }
    try {
      var response = await fetch("https://sportscore.com/api/v1/matches/?sport=tennis&status=live&limit=8");
      if (!response.ok) throw new Error("HTTP " + response.status);
      var data = await response.json();
      var matches = Array.isArray(data.matches) ? data.matches.filter(isLive).slice(0, 6) : [];
      if (!matches.length) {
        showEmpty(box, "Ahora mismo no hay partidos en pista.", LIVE_RESULT, LIVE_LINK);
        return;
      }
      clear(box);
      matches.forEach(function (match) {
        box.appendChild(renderMatch(match));
      });
    } catch (error) {
      showEmpty(box, "Ahora mismo no hay partidos en pista.", LIVE_RESULT, LIVE_LINK);
    } finally {
      if (button) button.disabled = false;
    }
  }

  var refresh = document.getElementById("refreshLive");
  if (refresh) {
    refresh.addEventListener("click", function () {
      loadLiveMatches({ announce: true });
    });
  }
  if (document.getElementById("liveMatches")) {
    var startLive = function () {
      var run = function () { loadLiveMatches(); };
      if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 2500 });
      else setTimeout(run, 1);
    };
    if (document.readyState === "complete") startLive();
    else window.addEventListener("load", startLive, { once: true });
  }

  document.querySelectorAll("form[data-netlify]").forEach(function (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var button = form.querySelector('[type="submit"]');
      var fields = form.querySelector(".form-fields");
      var thanks = form.querySelector(".form-thanks");
      var fallback = form.querySelector(".form-thanks-fallback");
      if (button) button.disabled = true;
      var body = new URLSearchParams(new FormData(form)).toString();
      var confirmed = false;
      try {
        var response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body
        });
        confirmed = response.ok;
      } catch (err) {
        confirmed = false;
      }
      if (fields) fields.hidden = true;
      if (thanks) {
        thanks.hidden = false;
        thanks.focus();
      }
      if (fallback) fallback.hidden = confirmed;
      if (button) button.disabled = false;
    });
  });

  var thanksTitle = document.getElementById("thanksTitle");
  var thanksCopy = document.getElementById("thanksCopy");
  if (thanksTitle && thanksCopy && /(?:^|[?&])origen=briefing(?:&|$)/.test(window.location.search)) {
    thanksTitle.textContent = "¡Dentro!";
    thanksCopy.textContent = "Te escribiremos con el resumen del lunes. Para darte de baja, escribe a hola@acearena.io.";
  }

  var share = document.getElementById("sharePage");
  if (share) {
    share.addEventListener("click", async function () {
      var url = window.location.href.split("#")[0];
      try {
        await navigator.clipboard.writeText(url);
        var label = share.getAttribute("data-label") || "Compartir AceArena";
        share.textContent = "Enlace copiado";
        setTimeout(function () { share.textContent = label; }, 2000);
      } catch (err) {
        share.textContent = "Copia la URL del navegador";
      }
    });
  }
})();
