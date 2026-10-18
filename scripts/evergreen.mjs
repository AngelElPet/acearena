const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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

  const playerCards = players.map((player) => `        <article class="card">
          <p class="kicker">${esc(player.tour)}</p>
          <h2><a href="${esc(player.slug)}.html">${esc(player.name)}</a></h2>
          <p>Número ${esc(player.ranking.position)} · ${esc(player.ranking.points)} puntos. Actualizado a ${esc(longDate(player.ranking.asOf))}.</p>
        </article>`).join('\n');
  entries.push({
    file: 'jugadores/index.html',
    lastmod: playersDoc.updated,
    page: {
      title: 'Jugadores españoles | AceArena',
      description: 'Fichas de tenistas españoles con ranking fechado, estilo de juego y palmarés, y enlace a la ficha oficial de la ATP o la WTA.',
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
          name: 'Jugadores españoles',
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
        <h1>Jugadores españoles</h1>
        <p>Una ficha corta por jugador, con el ranking fechado y el enlace a la página oficial. La portada sigue mostrando el top 5 de cada circuito.</p>
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
      <p class="news-meta"><a href="../index.html">Inicio</a> · <a href="index.html">Jugadores</a> · ${esc(player.tour)}</p>
      <h1>${esc(player.name)}</h1>
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
      const placeLine = place ? `\n          <p class="news-meta">${esc(place)}</p>` : '';
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
${sections}
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
