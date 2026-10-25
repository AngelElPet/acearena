import { crumbNav, factsHtml, formatHeight, lastName, roundLower } from './facts.mjs';
import { linkProse, prefixHref, proseEntries } from './links.mjs';
import { sinDatoHtml } from './missing.mjs';
import { formatPoints, normalizeName } from './ranking.mjs';

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

function latestMatch(player, resultsDoc) {
  return (resultsDoc?.results || [])
    .filter((match) => normalizeName(match.winner) === normalizeName(player.name) || normalizeName(match.loser) === normalizeName(player.name))
    .sort((a, b) => b.date.localeCompare(a.date) || 0)[0] || null;
}

function lastResultSentence(player, resultsDoc) {
  const match = latestMatch(player, resultsDoc);
  if (!match) return '';
  const score = spokenScore(match.score);
  const when = dayMonth(match.date);
  const round = roundPhrase(match.round);
  return match.loser && normalizeName(match.loser) === normalizeName(player.name)
    ? `Cayó en ${round} del ${match.tournament} ante ${match.winner}, ${score}, el ${when}`
    : `${round.startsWith('la ') ? `Ganó ${round}` : `Ganó en ${round}`} del ${match.tournament} a ${match.loser}, ${score}, el ${when}`;
}

function cityOf(tournament, week) {
  const event = (week?.tournaments || []).find((item) => normalizeName(item.name) === normalizeName(tournament));
  if (!event) return '';
  const city = String(event.place || '').split(',')[0].trim();
  return city;
}

function roundIn(round) {
  const value = roundLower(round || 'primera ronda');
  if (value === 'final') return 'la final';
  if (value.startsWith('semi')) return 'las semifinales';
  if (value.startsWith('cuartos')) return 'los cuartos de final';
  if (value.endsWith('ronda')) return `la ${value}`;
  return value;
}

function hoySentence(player, hoy, week) {
  if (!hoy.opponent || !hoy.tournament) return '';
  const city = cityOf(hoy.tournament, week);
  const where = city ? ` de ${city}` : '';
  return `${lastName(player.name)} abre ante ${lastName(hoy.opponent)} en ${roundIn(hoy.round)}${where}`;
}

function hoyBlock(player, { week, resultsDoc, esc, ranking, linkIndex }) {
  const hoy = player.hoy && typeof player.hoy === 'object' ? player.hoy : {};
  const spot = (week?.spotlight || []).find((item) => normalizeName(item.name) === normalizeName(player.name));
  const asOf = hoy.asOf || week?.updated || ranking.asOf;
  const tournament = hoy.tournament || spot?.tournament || '';
  const sentence = hoySentence(player, { ...hoy, tournament }, week);
  const hit = tournament && linkIndex ? linkIndex.tournament(tournament) : null;
  const tourHtml = hit
    ? `<a href="${esc(prefixHref(hit.href, 1))}">${esc(hit.name)}</a>`
    : (tournament ? esc(tournament) : '');
  const source = spot?.sourceUrl || '';
  const sourceHtml = source ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">Fuente</a>` : '';
  const match = latestMatch(player, resultsDoc);
  const last = lastResultSentence(player, resultsDoc);
  const lastHtml = last
    ? `${esc(last)}${match?.source ? `. <a href="${esc(match.source)}" target="_blank" rel="noopener noreferrer">Fuente</a>` : ''}`
    : '';
  const rows = [
    { dt: 'Torneo', dd: tourHtml, missing: !tourHtml },
    { dt: 'Ronda', dd: hoy.round ? esc(roundLower(hoy.round)) : '', missing: !hoy.round },
    { dt: 'Rival', dd: hoy.opponent ? esc(hoy.opponent) : '', missing: !hoy.opponent },
    { dt: 'Día', dd: hoy.day ? esc(hoy.day) : '', missing: !hoy.day },
    { dt: 'Hora en Madrid', dd: hoy.startTimeMadrid ? esc(hoy.startTimeMadrid) : '', missing: !hoy.startTimeMadrid },
    { dt: 'Último resultado', dd: lastHtml, missing: !lastHtml },
  ];
  return `
      <h2>${esc(player.name)} hoy</h2>
      <p class="as-of">Actualizado el ${esc(longDate(asOf))}.</p>
      ${sentence ? `<p>${esc(sentence)}.</p>` : ''}
      ${factsHtml(rows)}
      ${sourceHtml ? `<p class="source-line">Fuente: ${sourceHtml}</p>` : ''}`;
}

export function homeHoyHtml({ players, week, results, articles, linkIndex, contentDay, esc, longDay }) {
  const lead = articles[0];
  const leadHtml = lead
    ? `<p class="hoy-lead"><a href="noticias/${esc(lead.slug)}.html">${esc(lead.title)}</a>. ${esc(lead.summary)}</p>`
    : '';
  const weekNames = new Set((week?.tournaments || []).map((event) => normalizeName(event.name)));
  const spaniards = (players || []).filter((player) => {
    if (player.nationality !== 'España') return false;
    const tournament = player.hoy?.tournament;
    return tournament && weekNames.has(normalizeName(tournament));
  });
  const items = spaniards.map((player) => {
    const hoy = player.hoy || {};
    const sentence = hoySentence(player, hoy, week);
    const hit = linkIndex.tournament(hoy.tournament);
    const href = hit ? hit.href : `jugadores/${player.slug}.html`;
    const match = (results || []).find((item) => normalizeName(item.winner) === normalizeName(player.name) || normalizeName(item.loser) === normalizeName(player.name));
    const when = match ? longDay(match.date).replace(/ de \d{4}$/, '') : '';
    const last = match
      ? `${normalizeName(match.loser) === normalizeName(player.name) ? 'Cayó' : 'Ganó'} el ${when}. <a href="${esc(match.source)}" target="_blank" rel="noopener noreferrer">Fuente</a>`
      : `Último resultado: ${sinDatoHtml()}`;
    return `        <li><a href="${esc(href)}">${esc(sentence)}</a>. ${last}</li>`;
  }).join('\n');
  return `<section class="hoy-tenis" aria-labelledby="hoy-title">
        <h2 id="hoy-title">Hoy en el tenis</h2>
        <p class="as-of">Actualizado el ${esc(longDay(contentDay))}.</p>
        ${leadHtml}
        <h3>Los españoles esta semana</h3>
        <ul class="event-list">
${items}
        </ul>
      </section>`;
}

function playerPortrait(player, esc) {
  if (player.photo) {
    const photo = player.photo;
    const license = photo.licenseUrl
      ? `<a href="${esc(photo.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(photo.license)}</a>`
      : esc(photo.license || '');
    return `<figure class="portrait-figure">
          <img src="..${esc(photo.src)}" alt="Foto de ${esc(player.name)}" width="${esc(String(photo.width))}" height="${esc(String(photo.height))}" loading="lazy">
          <figcaption>Foto: ${esc(photo.author)}. Licencia: ${license}. Fuente: <a href="${esc(photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(photo.sourceName)}</a>.</figcaption>
        </figure>`;
  }
  if (player.portrait === 'silhouette') {
    return `<figure class="portrait-figure" aria-hidden="true">
          <img src="../assets/silueta-jugador.svg" alt="" aria-hidden="true" width="160" height="200" loading="lazy">
        </figure>`;
  }
  return avatar(player.name, esc);
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

export function evergreenEntries({ playersDoc, calendarDoc, guidesDoc, resultsDoc, week, h2h, news, linkIndex }, { esc, site, ranking }) {
  const entries = [];
  const players = playersDoc.players;
  const guides = guidesDoc.guides;

  const playerCards = players.map((player) => {
    const row = ranking.lookup(player.tour, player.name);
    if (!row) throw new Error(`Sin ranking único para ${player.name}`);
    return `        <article class="card player-card">
          ${playerPortrait(player, esc)}
          <div>
            <p class="kicker">${esc(player.tour)} · ${esc(player.nationality)}</p>
            <h2><a href="${esc(player.slug)}.html">${esc(player.name)}</a></h2>
            <p>Número ${esc(row.position)} · ${esc(formatPoints(row.points))} puntos. Actualizado a ${esc(longDate(ranking.asOf))}.</p>
          </div>
        </article>`;
  }).join('\n');
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

  const prose = proseEntries(linkIndex, 1);
  for (const player of players) {
    const row = ranking.lookup(player.tour, player.name);
    if (!row) throw new Error(`Sin ranking único para ${player.name}`);
    const url = `${site}/jugadores/${player.slug}.html`;
    const rankingLine = `Número ${row.position} · ${formatPoints(row.points)} puntos. Actualizado a ${longDate(ranking.asOf)}.`;
    const note = player.ranking.note ? `\n        <p>${esc(player.ranking.note)}</p>` : '';
    const height = formatHeight(player.height);
    const born = player.birthDate
      ? `${longDate(player.birthDate)}${player.birthPlace ? `, ${player.birthPlace}` : ''}`
      : '';
    const tech = (value) => (value ? esc(value) : sinDatoHtml());
    const sheetParts = [
      `Mano: ${tech(player.hand)}`,
      `Revés: ${tech(player.backhand)}`,
      `Estatura: ${tech(height)}`,
      `Nacimiento: ${tech(born)}`,
    ];
    const sheet = `\n      <h2>Ficha técnica</h2>\n      ${factsHtml(sheetParts.map((part) => {
      const split = part.split(': ');
      return { dt: split[0], dd: split.slice(1).join(': '), missing: split[1] === sinDatoHtml() };
    }))}`;
    const favorites = player.favorites ? `\n      <p>${linkProse(player.favorites, esc, prose)}</p>` : '';
    const today = hoyBlock(player, { week, resultsDoc, esc, ranking, linkIndex });
    const extraEvents = (player.nextEvents || []).filter((event) => event?.name && event.url);
    const nextEvent = extraEvents.length
      ? `\n      <h2>Próximos torneos</h2>\n      <ul class="event-list">\n${extraEvents.map((event) => {
        const internal = linkIndex.tournament(event.name);
        const href = internal ? prefixHref(internal.href, 1) : event.url;
        const external = internal ? '' : ' target="_blank" rel="noopener noreferrer"';
        return `        <li><a href="${esc(href)}"${external}>${esc(event.name)}</a>${event.dates ? `, ${esc(event.dates)}` : ''}</li>`;
      }).join('\n')}\n      </ul>`
      : (!extraEvents.length && player.nextEvent && !player.hoy?.tournament
        ? `\n      <h2>Próximo torneo</h2>\n      <ul class="event-list">\n        <li><a href="${esc(player.nextEvent.url)}" target="_blank" rel="noopener noreferrer">${esc(player.nextEvent.name)}</a>, ${esc(player.nextEvent.place)}, ${esc(player.nextEvent.dates)}</li>\n      </ul>`
        : '');
    const aceLinks = [];
    for (const article of news || []) {
      if ((article.players || []).some((name) => normalizeName(name) === normalizeName(player.name))) {
        aceLinks.push(`<a href="../noticias/${esc(article.slug)}.html">${esc(article.title)}</a>`);
      }
    }
    for (const tie of h2h?.ties || []) {
      if ([tie.playerA, tie.playerB].some((name) => normalizeName(name) === normalizeName(player.name))) {
        aceLinks.push(`<a href="../cara-a-cara/${esc(tie.slug)}.html">${esc(tie.playerA)} – ${esc(tie.playerB)}</a>`);
      }
    }
    const mentionedTournament = linkIndex.tournament(player.hoy?.tournament || '');
    if (mentionedTournament) aceLinks.push(`<a href="${esc(prefixHref(mentionedTournament.href, 1))}">${esc(mentionedTournament.name)}</a>`);
    aceLinks.push('<a href="../semana.html">Esta semana</a>');
    const related = `\n      <h2>En AceArena</h2>\n      <ul class="event-list">\n${aceLinks.map((item) => `        <li>${item}</li>`).join('\n')}\n      </ul>`;
    const highlights = player.highlights.map((item) => `          <li>${linkProse(item, esc, prose)}</li>`).join('\n');
    entries.push({
      file: `jugadores/${player.slug}.html`,
      lastmod: playersDoc.updated,
      page: {
        title: `${player.name} | AceArena`,
        description: `${player.name}, ${player.tour}. ${rankingLine}`,
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
      ${crumbNav([
        { label: 'Inicio', href: '../index.html' },
        { label: 'Jugadores', href: 'index.html' },
        { label: esc(player.name) },
      ])}
      <p class="news-meta">${esc(player.tour)} · ${esc(player.nationality)}</p>
      <div class="player-head">
        ${playerPortrait(player, esc)}
        <h1>${esc(player.name)}</h1>
      </div>
      <p class="article-summary">${esc(rankingLine)}</p>
      <p class="as-of">Actualizado el ${esc(longDate(playersDoc.updated))}.</p>${note}
      <p><a href="${esc(player.profileUrl)}" target="_blank" rel="noopener noreferrer">Ficha oficial ${esc(player.tour)}</a></p>${today}${nextEvent}
      <h2>Biografía</h2>
${player.bio.map((paragraph) => `        <p>${linkProse(paragraph, esc, prose)}</p>`).join('\n')}${sheet}${favorites}
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
