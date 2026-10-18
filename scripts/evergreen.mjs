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

function tiebreak(score) {
  return String(score).replace(/(\d+-\d+)\(7-(\d+)\)/g, '$1($2)');
}

function spokenScore(score) {
  const retired = /ret/i.test(score);
  const sets = tiebreak(score).replace(/\s*ret\.?/i, '').trim().split(/\s+/).filter(Boolean);
  const body = sets.length <= 1 ? (sets[0] || '') : `${sets.slice(0, -1).join(', ')} y ${sets[sets.length - 1]}`;
  return retired ? `${body}, con retirada` : body;
}

function roundPhrase(round) {
  const value = String(round || '').toLowerCase();
  if (value === 'final') return 'la final';
  if (value === 'semifinal') return 'semifinales';
  return value;
}

function dayMonth(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function lastResultBlock(player, resultsDoc, esc) {
  const matches = (resultsDoc?.results || [])
    .filter((match) => match.winner === player.name || match.loser === player.name)
    .sort((a, b) => b.date.localeCompare(a.date) || 0);
  const match = matches[0];
  if (!match) return '';
  const score = spokenScore(match.score);
  const when = dayMonth(match.date);
  const round = roundPhrase(match.round);
  const sentence = match.loser === player.name
    ? `cayó en ${round} del ${match.tournament} ante ${match.winner}, ${score}, el ${when}`
    : `${round.startsWith('la ') ? `ganó ${round}` : `ganó en ${round}`} del ${match.tournament} a ${match.loser}, ${score}, el ${when}`;
  return `\n      <p><strong>Último resultado:</strong> ${esc(sentence)}. <a href="${esc(match.source)}" target="_blank" rel="noopener noreferrer">Fuente</a>.</p>`;
}

function nextTournamentBlock(player, week, esc) {
  const events = Array.isArray(player.nextEvents) ? player.nextEvents.filter((event) => event && event.name && event.url) : [];
  if (events.length) {
    const linked = events.map((event) => `<a href="${esc(event.url)}" target="_blank" rel="noopener noreferrer">${esc(event.name)}</a> (${esc(event.dates)})`).join(' y ');
    return `\n      <p><strong>Próximos torneos:</strong> ${linked}.</p>`;
  }
  const spot = (week?.spotlight || []).find((item) => item.name === player.name);
  if (!spot) return '';
  return `\n      <p><strong>Próximo torneo:</strong> ${esc(spot.text)} <a href="${esc(spot.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(spot.sourceName)}</a>.</p>`;
}

function datedLine(name, place, when) {
  const where = place ? `, ${place}` : '';
  if (!when) return `${name}${where}`;
  if (when.startsWith('Empieza') || when.startsWith('Semana')) return `${name}${where}. ${when}`;
  return `${name}${where}, ${when}`;
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

export function evergreenEntries({ playersDoc, calendarDoc, guidesDoc, resultsDoc, week }, { esc, site }) {
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
      title: 'Jugadores | AceArena',
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
          name: 'Jugadores',
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
        <h1>Jugadores</h1>
        <p>Fichas de tenistas de España y de América Latina, con su ranking y el enlace a la ficha oficial. <a href="../rankings.html">Top 20 ATP y WTA</a> · <a href="../race.html">Race a Turín</a>.</p>
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
    const sheetParts = [
      player.hand ? `Mano: ${player.hand}` : '',
      player.backhand ? `Revés: ${player.backhand}` : '',
      player.height ? `Estatura: ${player.height.replace(' cm', '').replace(/^(\d)(\d{2})$/, '$1,$2')} m` : '',
      player.birthDate ? `Nacimiento: ${longDate(player.birthDate)}${player.birthPlace ? `, ${player.birthPlace}` : ''}` : '',
    ].filter(Boolean);
    const sheet = sheetParts.length
      ? `\n      <h2>Ficha técnica</h2>\n      <ul class="sheet">\n${sheetParts.map((part) => `        <li>${esc(part)}</li>`).join('\n')}\n      </ul>`
      : `\n      <h2>Ficha técnica</h2>\n${paragraphs(player.style, esc)}`;
    const favorites = player.favorites ? `\n      <p>${esc(player.favorites)}</p>` : '';
    const lastResult = lastResultBlock(player, resultsDoc, esc);
    const nextTournament = nextTournamentBlock(player, week, esc);
    const nextEvent = !nextTournament && player.nextEvent
      ? `\n      <h2>Próximo torneo</h2>\n      <ul class="event-list">\n        <li><a href="${esc(player.nextEvent.url)}" target="_blank" rel="noopener noreferrer">${esc(player.nextEvent.name)}</a>, ${esc(player.nextEvent.place)}, ${esc(player.nextEvent.dates)}</li>\n      </ul>`
      : '';
    const related = Array.isArray(player.related) && player.related.length
      ? `\n      <p class="results-more">${player.related.map((item) => `<a href="${esc(item.href)}">${esc(item.label)}</a>`).join(' · ')}</p>`
      : '';
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
      <p class="news-meta"><a href="../index.html">Inicio</a> · <a href="index.html">Jugadores</a> · ${esc(player.tour)} · ${esc(player.nationality)}</p>
      <div class="player-head">
        ${avatar(player.name, esc)}
        <h1>${esc(player.name)}</h1>
      </div>
      <p class="article-summary">${esc(ranking)}</p>${note}
      <p><a href="${esc(player.profileUrl)}" target="_blank" rel="noopener noreferrer">Ficha oficial ${esc(player.tour)}</a></p>${lastResult}${nextTournament}${nextEvent}
      <h2>Biografía</h2>
${paragraphs(player.bio, esc)}${sheet}${favorites}
      <h2>Trayectoria</h2>
      <ul>
${highlights}
      </ul>
      <section class="sources">
        <h2>Fuentes</h2>
        <ol>
${sourceList(player.sources, esc)}
        </ol>
      </section>${related}
    </article>
  </main>`,
      },
    });
  }

  const calendarBlocks = calendarDoc.sections.map((section) => {
    const items = section.events.map((event) => {
      const icon = surfaceMark(event.surface, '');
      const detail = event.detail ? `\n          <p>${esc(event.detail)}</p>` : '';
      const surface = event.surface ? `\n          <p class="event-where">${icon}${esc(event.surface)}</p>` : '';
      return `        <li>
          ${esc(datedLine(event.name, event.place, event.when))}${surface}${detail}
          <p>Fuentes: ${event.sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`).join(' · ')}</p>
        </li>`;
    }).join('\n');
    return `      <h2>${esc(section.title)}</h2>
      <ul class="event-list">
${items}
      </ul>`;
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
        <p>Las grandes citas de 2027, con la fuente oficial de cada fecha.</p>
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
        <figure class="photo-figure">
          <img src="../photos/pistas.webp" srcset="../photos/pistas-400.webp 400w, ../photos/pistas-800.webp 800w, ../photos/pistas.webp 1600w" sizes="(max-width: 1120px) 100vw, 720px" alt="Pistas de tenis vacías al aire libre, con árboles al fondo." width="1600" height="900">
          <figcaption>Foto: Hameltion, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>, vía <a href="https://commons.wikimedia.org/wiki/File:Tennis_courts_at_Chapel_Hill_High_School.jpg" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>.</figcaption>
        </figure>
        <p>Guías cortas para seguir el circuito: rankings, marcador, Grand Slams, glosario y el camino hasta la ATP y la WTA.</p>
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
          <figcaption>La pista, vista desde arriba.</figcaption>
        </figure>
        <figure class="diagram">
          <img src="../assets/diagrams/score.svg" alt="Esquema de un juego: 0, 15, 30, 40 y juego." width="360" height="120">
          <figcaption>Cómo avanza el marcador de un juego.</figcaption>
        </figure>
      </div>
` : '';
    const sections = Array.isArray(guide.sections)
      ? guide.sections.map((section) => `      <h2>${esc(section.heading)}</h2>
${paragraphs(section.paragraphs, esc)}`).join('\n')
      : '';
    const eventItems = Array.isArray(guide.events)
      ? guide.events.map((event) => {
          const line = datedLine(event.name, event.place, event.dates);
          const extra = event.detail ? `${line.endsWith('.') ? ' ' : '. '}${esc(event.detail)}` : '';
          return `        <li>${esc(line)}${extra}</li>`;
        }).join('\n')
      : '';
    const pathway = guide.slug === 'como-se-llega-al-circuito' ? `      <figure class="diagram">
        <img src="../assets/diagrams/escalones.svg" alt="Cuatro escalones: júnior, ITF, Challenger o WTA 125, y ATP o WTA." width="720" height="200">
        <figcaption>Los cuatro escalones, de la base al circuito.</figcaption>
      </figure>
      <p><a href="../jugadores/rafael-jodar.html">Rafael Jódar</a> empezó 2026 como número 168 y en agosto alcanzó el 11.</p>
` : '';
    const eventList = eventItems ? `      <ul class="event-list">\n${eventItems}\n      </ul>\n` : '';
    const terms = Array.isArray(guide.terms) ? `      <div class="faq-list">
${guide.terms.map((term) => `        <article class="faq-item"><h2>${esc(term.name)}</h2><p>${esc(term.description)}</p></article>`).join('\n')}
      </div>
` : '';
    const faqs = guide.faqs.map((faq) => `        <article class="faq-item"><h3>${esc(faq.q)}</h3><p>${esc(faq.a)}</p></article>`).join('\n');
    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: guide.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ];
    if (Array.isArray(guide.terms)) {
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        name: guide.title,
        url,
        inLanguage: 'es',
        hasDefinedTerm: guide.terms.map((term) => ({
          '@type': 'DefinedTerm',
          name: term.name,
          description: term.description,
        })),
      });
    }
    jsonLd.push(breadcrumb([
      { name: 'Inicio', url: `${site}/` },
      { name: 'Aprende tenis', url: `${site}/aprende/` },
      { name: guide.title, url },
    ]));
    entries.push({
      file: `aprende/${guide.slug}.html`,
      lastmod: guidesDoc.updated,
      page: {
        title: `${guide.title} | AceArena`,
        description: guide.description,
        canonical: url,
        depth: 1,
        jsonLd,
        main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      <p class="news-meta"><a href="../index.html">Inicio</a> · <a href="index.html">Aprende tenis</a></p>
      <p class="kicker">${esc(guide.kicker)}</p>
      <h1>${esc(guide.title)}</h1>
      <p class="article-summary">${esc(guide.intro)}</p>
${diagrams}${pathway}${terms}${eventList}${sections}
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
