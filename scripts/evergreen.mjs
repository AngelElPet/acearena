const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function surfaceFile(surface) {
  if (typeof surface !== 'string' || surface === '') return '';
  if (surface === 'indoor' || surface.includes('indoor')) return 'surface-indoor.svg';
  if (surface === 'grass' || surface.includes('hierba')) return 'surface-grass.svg';
  if (surface === 'clay' || surface.includes('tierra')) return 'surface-clay.svg';
  if (surface === 'hard' || surface.includes('dura')) return 'surface-hard.svg';
  return '';
}

function surfaceMark(surface, prefix) {
  const file = surfaceFile(surface);
  if (!file) return '';
  return `<img class="surface-icon" src="${prefix}assets/diagrams/${file}" alt="" width="36" height="36">`;
}

function initials(name) {
  const plain = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const parts = plain.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function avatar(name, esc) {
  const letters = esc(initials(name));
  return `<svg class="avatar" viewBox="0 0 72 72" role="img" aria-label="Iniciales de ${esc(name)}">
            <circle cx="36" cy="36" r="36" fill="#c6ff00"/>
            <text x="36" y="42" text-anchor="middle" fill="#12160a" font-family="Inter, sans-serif" font-size="22" font-weight="700">${letters}</text>
          </svg>`;
}

function longDate(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function sourceList(sources, esc) {
  return sources.map((source) => `          <li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a></li>`).join('\n');
}

function paragraphs(items, esc) {
  return items.map((paragraph) => `        <p>${esc(paragraph)}</p>`).join('\n');
}

function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function evergreenEntries({ playersDoc, calendarDoc, guidesDoc }, { esc, site }) {
  const entries = [];
  const players = playersDoc.players;
  const guides = guidesDoc.guides;

  const playerCards = players.map((player) => `        <article class="card player-card">
          ${avatar(player.name, esc)}
          <div>
            <p class="kicker">${esc(player.tour)} · ${esc(player.nationality)}</p>
            <h2><a href="${esc(player.slug)}.html">${esc(player.name)}</a></h2>
            <p>Número ${esc(player.ranking.position)} · ${esc(player.ranking.points)} puntos. Actualizado a ${esc(longDate(player.ranking.asOf))}.</p>
          </div>
        </article>`).join('\n');
  entries.push({
    file: 'jugadores/index.html',
    lastmod: playersDoc.updated,
    page: {
      title: 'Jugadores en español | AceArena',
      description: 'Fichas de tenistas de España y de América Latina con ranking fechado, estilo de juego y palmarés, y enlace a la ficha oficial de la ATP o la WTA.',
      canonical: `${site}/jugadores/`,
      depth: 1,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Jugadores', url: `${site}/jugadores/` },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Jugadores en español',
          url: `${site}/jugadores/`,
          inLanguage: 'es',
          isPartOf: { '@type': 'WebSite', name: 'AceArena', url: site },
        },
      ],
      main: `  <main class="section page-section" id="contenido">
    <div class="container">
      <p class="news-meta"><a href="../index.html">Inicio</a> · Jugadores</p>
      <div class="section-header">
        <span class="section-tag">Rankings</span>
        <h1>Jugadores en español</h1>
        <p>Fichas de España y de América Latina, con el ranking fechado y el enlace a la página oficial. El avatar es un dibujo con las iniciales: no es una foto. La portada sigue mostrando el top 5 de cada circuito. <a href="../race.html">Race a Turín</a>.</p>
      </div>
      <div class="card-grid">
${playerCards}
      </div>
    </div>
  </main>`,
    },
  });

  for (const player of players) {
    const url = `${site}/jugadores/${player.slug}.html`;
    const ranking = `Número ${player.ranking.position} · ${player.ranking.points} puntos. Actualizado a ${longDate(player.ranking.asOf)}.`;
    const note = player.ranking.note ? `\n        <p>${esc(player.ranking.note)}</p>` : '';
    const highlights = player.highlights.map((item) => `          <li>${esc(item)}</li>`).join('\n');
    entries.push({
      file: `jugadores/${player.slug}.html`,
      lastmod: playersDoc.updated,
      page: {
        title: `${player.name} | AceArena`,
        description: `${player.name}, ${player.tour}. ${ranking}`,
        canonical: url,
        depth: 1,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: player.name,
            url,
            sameAs: [player.profileUrl],
            nationality: player.nationality,
            birthDate: player.birthDate,
            height: player.height,
            jobTitle: 'tenista',
          },
          breadcrumb([
            { name: 'Inicio', url: `${site}/` },
            { name: 'Jugadores', url: `${site}/jugadores/` },
            { name: player.name, url },
          ]),
        ],
        main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      <p class="news-meta"><a href="../index.html">Inicio</a> · <a href="index.html">Jugadores en español</a> · ${esc(player.tour)} · ${esc(player.nationality)}</p>
      <div class="player-head">
        ${avatar(player.name, esc)}
        <h1>${esc(player.name)}</h1>
      </div>
      <p class="article-summary">${esc(ranking)}</p>${note}
      <p><a href="${esc(player.profileUrl)}" target="_blank" rel="noopener noreferrer">Ficha oficial ${esc(player.tour)}</a></p>
      <h2>Biografía</h2>
${paragraphs(player.bio, esc)}
      <h2>Cómo juega</h2>
${paragraphs(player.style, esc)}
      <h2>Trayectoria</h2>
      <ul>
${highlights}
      </ul>
      <section class="sources">
        <h2>Fuentes</h2>
        <ol>
${sourceList(player.sources, esc)}
        </ol>
      </section>
    </article>
  </main>`,
      },
    });
  }

  const calendarBlocks = calendarDoc.sections.map((section) => {
    const intro = section.intro ? `\n      <p class="section-intro">${esc(section.intro)}</p>` : '';
    const cards = section.events.map((event) => {
      const place = [event.place, event.surface].filter(Boolean).join(' · ');
      const icon = surfaceMark(event.surface, '');
      const placeLine = place ? `\n          <p class="news-meta surface-line">${icon}${esc(place)}</p>` : '';
      const detail = event.detail ? `\n          <p>${esc(event.detail)}</p>` : '';
      return `        <article class="card">
          <h3>${esc(event.name)}</h3>${placeLine}
          <p>${esc(event.when)}</p>${detail}
          <p>Fuentes: ${event.sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`).join(' · ')}</p>
        </article>`;
    }).join('\n');
    return `      <h2>${esc(section.title)}</h2>${intro}
      <div class="card-grid">
${cards}
      </div>`;
  }).join('\n');
  entries.push({
    file: 'calendario-2027.html',
    lastmod: calendarDoc.updated,
    page: {
      title: 'Calendario 2027 de tenis | AceArena',
      description: 'Grand Slams, finales de temporada y torneos 1000 de 2027 con las fechas ya publicadas. La Copa Davis de 2026, en Bolonia, abre la página.',
      canonical: `${site}/calendario-2027.html`,
      depth: 0,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Calendario 2027', url: `${site}/calendario-2027.html` },
        ]),
      ],
      main: `  <main class="section page-section" id="contenido">
    <div class="container">
      <p class="news-meta"><a href="index.html">Inicio</a> · Calendario</p>
      <div class="section-header">
        <span class="section-tag">Calendario</span>
        <h1>Calendario 2027</h1>
        <p>Grand Slams, finales y torneos de mil puntos. Si el cierre no está publicado, la ficha dice fecha por confirmar. Cada fecha enlaza la página de donde sale.</p>
      </div>
${calendarBlocks}
    </div>
  </main>`,
    },
  });

  const guideCards = guides.map((guide) => `        <article class="card">
          <p class="kicker">${esc(guide.kicker)}</p>
          <h2><a href="${esc(guide.slug)}.html">${esc(guide.title)}</a></h2>
          <p>${esc(guide.description)}</p>
        </article>`).join('\n');
  entries.push({
    file: 'aprende/index.html',
    lastmod: guidesDoc.updated,
    page: {
      title: 'Aprende tenis | AceArena',
      description: 'Cómo funcionan los rankings ATP y WTA, y las reglas básicas del marcador, con enlace a la fuente oficial.',
      canonical: `${site}/aprende/`,
      depth: 1,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Aprende tenis', url: `${site}/aprende/` },
        ]),
      ],
      main: `  <main class="section page-section" id="contenido">
    <div class="container">
      <p class="news-meta"><a href="../index.html">Inicio</a> · Aprende tenis</p>
      <div class="section-header">
        <span class="section-tag">Guías</span>
        <h1>Aprende tenis</h1>
        <p>Tres explicaciones cortas para seguir el circuito: el ranking ATP, el ranking WTA y el marcador.</p>
      </div>
      <div class="card-grid">
${guideCards}
      </div>
    </div>
  </main>`,
    },
  });

  for (const guide of guides) {
    const url = `${site}/aprende/${guide.slug}.html`;
    const diagrams = guide.slug === 'reglas-del-tenis-basicas' ? `      <div class="diagram-grid">
        <figure class="diagram">
          <img src="../assets/diagrams/court.svg" alt="Esquema de una pista: dos fondos, la red en el centro y los cuadros de saque." width="320" height="180">
          <figcaption>Esquema de la pista. No es un partido real.</figcaption>
        </figure>
        <figure class="diagram">
          <img src="../assets/diagrams/score.svg" alt="Esquema de un juego: 0, 15, 30, 40 y juego." width="360" height="120">
          <figcaption>Esquema del marcador de un juego, el orden que explica esta guía.</figcaption>
        </figure>
      </div>
` : '';
    const sections = guide.sections.map((section) => `      <h2>${esc(section.heading)}</h2>
${paragraphs(section.paragraphs, esc)}`).join('\n');
    const faqs = guide.faqs.map((faq) => `        <article class="faq-item"><h3>${esc(faq.q)}</h3><p>${esc(faq.a)}</p></article>`).join('\n');
    entries.push({
      file: `aprende/${guide.slug}.html`,
      lastmod: guidesDoc.updated,
      page: {
        title: `${guide.title} | AceArena`,
        description: guide.description,
        canonical: url,
        depth: 1,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: guide.faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
          },
          breadcrumb([
            { name: 'Inicio', url: `${site}/` },
            { name: 'Aprende tenis', url: `${site}/aprende/` },
            { name: guide.title, url },
          ]),
        ],
        main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      <p class="news-meta"><a href="../index.html">Inicio</a> · <a href="index.html">Aprende tenis</a></p>
      <p class="kicker">${esc(guide.kicker)}</p>
      <h1>${esc(guide.title)}</h1>
      <p class="article-summary">${esc(guide.intro)}</p>
${diagrams}${sections}
      <h2>Preguntas frecuentes</h2>
      <div class="faq-list">
${faqs}
      </div>
      <section class="sources">
        <h2>Fuentes</h2>
        <ol>
${sourceList(guide.sources, esc)}
        </ol>
      </section>
    </article>
  </main>`,
      },
    });
  }

  return entries;
}
