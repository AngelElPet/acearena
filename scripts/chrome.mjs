export function navLinks(p) {
  return `<a href="${p}index.html">Hoy</a>
        <a href="${p}noticias/index.html">Noticias</a>
        <a href="${p}calendario.html">Calendario</a>
        <a href="${p}rankings.html">Rankings</a>
        <a href="${p}jugadores/index.html">Jugadores</a>
        <a href="${p}tenis-en-espana.html">España</a>
        <div class="nav-more">
          <button type="button" class="nav-more-btn" id="moreToggle" aria-expanded="false" aria-controls="moreMenu">Más</button>
          <div class="nav-more-panel" id="moreMenu" hidden>
            <a href="${p}paises/index.html">Países</a>
            <a href="${p}cara-a-cara/index.html">Cara a cara</a>
            <a href="${p}horarios.html">Horarios</a>
            <a href="${p}hoy-en-30-segundos.html">En 30 segundos</a>
            <a href="${p}aprende/index.html">Aprende</a>
            <a href="${p}sobre.html">Sobre</a>
            <a href="${p}metodologia.html">Metodología</a>
          </div>
        </div>`;
}

export function footerHtml(p) {
  return `  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <a class="logo" href="${p}index.html"><img src="${p}assets/logo.svg" alt="AceArena" width="140" height="40" loading="lazy"></a>
        <p>AceArena: tenis, con datos y sin ruido.</p>
      </div>
      <div class="footer-links">
        <div>
          <h2>Secciones</h2>
          <a href="${p}index.html">Hoy</a>
          <a href="${p}noticias/index.html">Noticias</a>
          <a href="${p}calendario.html">Calendario</a>
          <a href="${p}rankings.html">Rankings</a>
          <a href="${p}jugadores/index.html">Jugadores</a>
          <a href="${p}tenis-en-espana.html">España</a>
          <a href="${p}paises/index.html">Países</a>
          <a href="${p}cara-a-cara/index.html">Cara a cara</a>
          <a href="${p}horarios.html">Horarios</a>
          <a href="${p}hoy-en-30-segundos.html">En 30 segundos</a>
          <a href="${p}aprende/index.html">Aprende</a>
          <a href="${p}torneos/index.html">Torneos</a>
          <a href="${p}semana.html">Esta semana</a>
          <a href="${p}race.html">Race a Turín</a>
          <a href="${p}resultados.html">Resultados</a>
        </div>
        <div>
          <h2>AceArena</h2>
          <a href="${p}sobre.html">Sobre</a>
          <a href="${p}metodologia.html">Metodología</a>
          <a href="${p}correcciones.html">Correcciones</a>
          <a href="${p}agencias.html">Anúnciate</a>
          <a href="mailto:hola@acearena.io">Contacto</a>
          <a href="https://www.instagram.com/acearenaes/" rel="noopener noreferrer">Instagram</a>
          <a href="${p}index.html#newsletter">Resumen del lunes</a>
        </div>
        <div>
          <h2>Legal</h2>
          <a href="${p}aviso-legal.html">Aviso legal</a>
          <a href="${p}privacidad.html">Privacidad</a>
          <a href="${p}cookies.html">Cookies</a>
          <a href="${p}creditos.html">Créditos</a>
        </div>
      </div>
    </div>
    <div class="container footer-bottom">
      <p>© 2026 AceArena · <a href="mailto:hola@acearena.io">hola@acearena.io</a></p>
    </div>
  </footer>`;
}
