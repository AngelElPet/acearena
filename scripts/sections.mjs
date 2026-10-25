import { categoryLabel, crumbNav, factsHtml, formatHeight, levelPlain, levelShort, roundLower } from './facts.mjs';
import { prefixHref } from './links.mjs';
import { isMissing, proseHtml, showHtml, showText, sinDatoHtml } from './missing.mjs';
import { cityIfNew, placeEs, surfaceEs } from './places.mjs';
import { displayName, formatPoints, normalizeName } from './ranking.mjs';
import { prepareTournaments, tournamentHasData } from './tournaments.mjs';

const MISSING = 'sin dato';
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function longDate(iso) {
  if (!iso || iso === MISSING || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return MISSING;
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function esNumber(value) {
  if (value == null || value === '' || value === MISSING) return MISSING;
  const formatted = formatPoints(value);
  return formatted || MISSING;
}

function money(value, currency) {
  const formatted = esNumber(value);
  if (formatted === MISSING) return MISSING;
  return currency === 'USD' ? `${formatted} US$` : formatted;
}

function sourcesHtml(sources, esc) {
  return (sources || []).map((source) => (
    `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`
  )).join(' · ');
}

function uniqueSources(players) {
  const seen = new Set();
  const sources = [];
  for (const player of players) {
    for (const source of player.sources || []) {
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      sources.push(source);
    }
  }
  return sources;
}

function portrait(player, esc, prefix) {
  if (player.photo) {
    const photo = player.photo;
    const license = photo.licenseUrl
      ? `<a href="${esc(photo.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(photo.license)}</a>`
      : esc(photo.license);
    return `<figure class="portrait-figure">
        <img src="${prefix}${photo.src.replace(/^\//, '')}" alt="Foto de ${esc(player.name)}" width="${photo.width}" height="${photo.height}" loading="lazy">
        <figcaption>Foto: ${esc(photo.author)}. Licencia: ${license}. Fuente: <a href="${esc(photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(photo.sourceName)}</a>.</figcaption>
      </figure>`;
  }
  return `<figure class="portrait-figure" aria-hidden="true">
      <img src="${prefix}assets/silueta-jugador.svg" alt="" aria-hidden="true" width="160" height="200" loading="lazy">
    </figure>`;
}

function birthLine(player, esc) {
  const born = isMissing(player.birthDate) ? sinDatoHtml() : esc(longDate(player.birthDate));
  const age = isMissing(player.age) ? sinDatoHtml() : esc(`${player.age} años a ${longDate(player.ageAsOf)}`);
  return `Nacimiento: ${born}. Edad: ${age}.`;
}

function titlesLine(player, esc) {
  const count = showHtml(player.titlesSeason, esc);
  if (player.tour === 'ATP') {
    const names = Array.isArray(player.titlesSeasonNames) && player.titlesSeasonNames.length
      ? ` ${esc(player.titlesSeasonNames.map((name) => placeEs(name)).join(', '))}.`
      : '';
    return `Títulos ATP y Grand Slam en 2026, hasta el 18 de octubre: ${count}.${names}`;
  }
  return `Títulos en 2026: ${count}.`;
}

function careerHighHtml(player, esc) {
  if (isMissing(player.careerHigh)) return sinDatoHtml();
  const dated = !isMissing(player.careerHighDate) ? ` (${esc(longDate(player.careerHighDate))})` : '';
  return `${esc(String(player.careerHigh))}${dated}`;
}

function officialRank(player, ranking) {
  const row = ranking.lookup(player.tour, player.name);
  if (!row) throw new Error(`Sin ranking único para ${player.tour} ${player.name}`);
  return row;
}

function overlayRow(player, sheets) {
  const sheet = sheets?.get(`${player.tour}:${normalizeName(player.name)}`);
  const facts = sheet?.facts || {};
  const careerHigh = isMissing(player.careerHigh) && !isMissing(facts.careerHigh)
    ? `${facts.careerHigh}${facts.careerHighNote ? ` (${facts.careerHighNote})` : ''}`
    : player.careerHigh;
  const titlesCareer = isMissing(player.titlesCareer) && !isMissing(facts.titlesCareer) ? facts.titlesCareer : player.titlesCareer;
  const grandSlamBest = isMissing(player.grandSlamBest) && !isMissing(facts.grandSlamBest) ? facts.grandSlamBest : player.grandSlamBest;
  const heightSource = !isMissing(player.height) ? player.height : sheet?.height;
  return { ...player, careerHigh, titlesCareer, grandSlamBest, height: formatHeight(heightSource) };
}

function factRow(label, value, esc) {
  const missing = isMissing(value);
  return { dt: label, dd: missing ? '' : esc(String(value)), missing };
}

function sheet(player, esc, ranking, sheets) {
  const data = overlayRow(player, sheets);
  const ranked = officialRank(data, ranking);
  const slamIsCount = !isMissing(data.grandSlamBest) && /títulos de grand slam/i.test(String(data.grandSlamBest));
  const born = isMissing(data.birthDate) ? '' : longDate(data.birthDate);
  const age = isMissing(data.age) ? '' : `${data.age} años a ${longDate(data.ageAsOf)}`;
  return factsHtml([
    factRow('Nacimiento', born, esc),
    factRow('Edad', age, esc),
    { dt: 'Ranking', dd: esc(formatPoints(ranked.position)), missing: false },
    { dt: 'Puntos', dd: esc(formatPoints(ranked.points)), missing: false },
    { dt: 'Lista', dd: esc(longDate(ranking.asOf)), missing: false },
    factRow('Mejor ranking de carrera', data.careerHigh, esc),
    factRow('Mano', data.hand, esc),
    factRow('Estatura', data.height, esc),
    factRow('Títulos en 2026', data.titlesSeason, esc),
    slamIsCount && isMissing(data.titlesCareer) ? null : factRow('Títulos de carrera', data.titlesCareer, esc),
    factRow(slamIsCount ? 'Títulos de Grand Slam' : 'Mejor Grand Slam', placeEs(data.grandSlamBest), esc),
    factRow('Grand Slam en 2026', placeEs(data.grandSlam2026), esc),
    factRow('Premios de la temporada', money(data.prizeSeason, data.prizeCurrency), esc),
    factRow('Premios de carrera', money(data.prizeCareer, data.prizeCurrency), esc),
    factRow('Torneos de la temporada', data.tournamentsSeason, esc),
  ]);
}

function playerCard(player, esc, prefix, countryName, ranking, sheets) {
  const ranked = officialRank(player, ranking);
  const links = [];
  if (player.ficha) links.push(`<a href="${prefix}${esc(player.ficha)}">Ficha en AceArena</a>`);
  if (player.profileUrl) {
    links.push(`<a href="${esc(player.profileUrl)}" target="_blank" rel="noopener noreferrer">Ficha oficial ${esc(player.tour)}</a>`);
  }
  const id = `${player.tour.toLowerCase()}-${player.slug}`;
  return `        <article class="card player-card" id="${esc(id)}">
          ${portrait(player, esc, prefix)}
          <div>
            <p class="kicker">${esc(player.tour)} · ${esc(countryName)} · ${esc(formatPoints(ranked.position))}</p>
            <h2>${esc(displayName(ranked.name))}</h2>
            ${sheet(player, esc, ranking, sheets)}
            ${links.length ? `<p>${links.join(' · ')}</p>` : ''}
          </div>
        </article>`;
}

function personLd(player, pageUrl, countryName, site) {
  const data = {
    '@type': 'Person',
    name: player.name,
    url: `${pageUrl}#${player.tour.toLowerCase()}-${player.slug}`,
    jobTitle: 'tenista',
    nationality: countryName,
  };
  if (player.birthDate !== MISSING) data.birthDate = player.birthDate;
  if (player.profileUrl) data.sameAs = [player.profileUrl];
  if (player.photo) data.image = `${site}${player.photo.src}`;
  return data;
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

function datedPlain(event) {
  const startMissing = isMissing(event.startDate);
  const endMissing = isMissing(event.endDate);
  if (startMissing) return 'Fechas: —';
  const start = longDate(event.startDate);
  if (endMissing) return `Empieza el ${start}. Fin: —`;
  return `${start} – ${longDate(event.endDate)}`;
}

function datedHtml(event, esc) {
  const startMissing = isMissing(event.startDate);
  const endMissing = isMissing(event.endDate);
  if (startMissing) return `Fechas: ${sinDatoHtml()}`;
  const start = esc(longDate(event.startDate));
  if (endMissing) return `Empieza el ${start}. Fin: ${sinDatoHtml()}`;
  return `${start} – ${esc(longDate(event.endDate))}`;
}

function datedFieldHtml(event, esc) {
  if (isMissing(event.startDate)) return sinDatoHtml();
  return datedHtml(event, esc);
}

function tieFact(label, value, note, esc) {
  if (isMissing(value)) return `<li>${esc(label)}: ${sinDatoHtml()}.</li>`;
  const extra = note && !isMissing(note) ? ` ${esc(note)}` : '';
  return `<li>${esc(label)}: ${esc(String(value))}.${extra}</li>`;
}

export function sectionEntries({ countries, spain, tournaments, h2h, order, news, players, week, linkIndex, today }, { esc, site, ranking }) {
  const entries = [];
  const updated = countries.updated;
  const sheets = new Map((players || []).map((player) => [`${player.tour}:${normalizeName(player.name)}`, player]));
  const countryCards = new Map();
  for (const country of countries.countries) {
    for (const player of [...country.atp, ...country.wta]) {
      countryCards.set(`${player.tour}:${player.name}`, `${site}/paises/${country.slug}.html#${player.tour.toLowerCase()}-${player.slug}`);
    }
  }

  const indexUrl = `${site}/paises/`;
  const countryItems = countries.countries.map((country) => (
    `        <li><a href="${esc(country.slug)}.html">${esc(country.name)}</a>. ATP: ${country.atp.length}. WTA: ${country.wta.length}.</li>`
  )).join('\n');
  const gapItems = countries.gaps.map((gap) => `        <li>${proseHtml(gap, esc)}</li>`).join('\n');
  entries.push({
    file: 'paises/index.html',
    lastmod: updated,
    page: {
      title: 'Jugadores por país | AceArena',
      description: 'Los 20 mejores jugadores ATP y las 20 mejores jugadoras WTA de cada país con alguien en el top 200, con la fecha y la fuente de cada dato.',
      canonical: indexUrl,
      depth: 1,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Jugadores por país', url: indexUrl },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Jugadores por país',
          itemListElement: countries.countries.map((country, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: country.name,
            url: `${site}/paises/${country.slug}.html`,
          })),
        },
      ],
      main: `  <main class="section page-section" id="contenido">
    <div class="container">
      ${crumbNav([{ label: 'Inicio', href: '../index.html' }, { label: 'Jugadores por país' }])}
      <div class="section-header">
        <span class="section-tag">Rankings</span>
        <h1>Jugadores por país</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p>${esc(countries.criterion)}</p>
        <p class="as-of">Actualizado el ${esc(longDate(updated))}. Ranking del ${esc(longDate(ranking.asOf))}. <a href="../metodologia.html">Metodología</a>.</p>
      </div>
      <ul class="event-list">
${countryItems}
      </ul>
      <h2>Qué no publica la fuente</h2>
      <ul class="event-list">
${gapItems}
      </ul>
      <p>Jugadores del top 200 ATP sin código de nacionalidad en el informe: ${esc(String(countries.unassignedAtp))}. Jugadoras del top 200 WTA sin código: ${esc(String(countries.unassignedWta))}. No se les asigna un país.</p>
      <p><a href="../tenis-en-espana.html">Tenis en España</a> · <a href="../jugadores/index.html">Fichas ya publicadas</a> · <a href="../rankings.html">Top 20</a></p>
    </div>
  </main>`,
    },
  });

  for (const country of countries.countries) {
    const url = `${site}/paises/${country.slug}.html`;
    const players = [...country.atp, ...country.wta];
    const atpBlock = country.atp.length
      ? `      <h2>ATP</h2>\n      <div class="card-grid">\n${country.atp.map((player) => playerCard(player, esc, '../', country.name, ranking, sheets)).join('\n')}\n      </div>`
      : '      <h2>ATP</h2>\n      <p>Sin jugadores con código de este país en la lista consultada.</p>';
    const wtaBlock = country.wta.length
      ? `      <h2>WTA</h2>\n      <div class="card-grid">\n${country.wta.map((player) => playerCard(player, esc, '../', country.name, ranking, sheets)).join('\n')}\n      </div>`
      : '      <h2>WTA</h2>\n      <p>Sin jugadoras con código de este país en la lista consultada.</p>';
    entries.push({
      file: `paises/${country.slug}.html`,
      lastmod: updated,
      page: {
        title: `Jugadores de ${country.name} | AceArena`,
        description: `Los mejores jugadores ATP y jugadoras WTA de ${country.name}, con ranking del ${longDate(countries.atpAsOf)} y la fuente de cada dato.`,
        canonical: url,
        depth: 1,
        jsonLd: [
          breadcrumb([
            { name: 'Inicio', url: `${site}/` },
            { name: 'Jugadores por país', url: indexUrl },
            { name: country.name, url },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Tenistas de ${country.name}`,
            numberOfItems: players.length,
            itemListElement: players.map((player, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: personLd(player, url, country.name, site),
            })),
          },
        ],
        main: `  <main class="section page-section" id="contenido">
    <div class="container">
      ${crumbNav([
        { label: 'Inicio', href: '../index.html' },
        { label: 'Jugadores por país', href: 'index.html' },
        { label: esc(country.name) },
      ])}
      <div class="section-header">
        <span class="section-tag">${esc(country.code)}</span>
        <h1>${esc(country.name)}</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p class="as-of">Actualizado el ${esc(longDate(updated))}. Ranking ATP y WTA del ${esc(longDate(ranking.asOf))}.</p>
      </div>
${atpBlock}
${wtaBlock}
      <section class="sources">
        <h2>Fuentes</h2>
        <p>${sourcesHtml(uniqueSources(players), esc)}</p>
      </section>
    </div>
  </main>`,
      },
    });
  }

  const spainUrl = `${site}/tenis-en-espana.html`;
  const groups = [
    ['ATP', spain.tournaments.filter((event) => event.circuit === 'ATP')],
    ['Challenger', spain.tournaments.filter((event) => event.circuit === 'Challenger')],
    ['WTA y WTA 125', spain.tournaments.filter((event) => event.circuit === 'WTA')],
    ['ITF femenino', spain.tournaments.filter((event) => event.circuit === 'ITF')],
  ];
  const tournamentLists = groups.map(([title, events]) => {
    if (!events.length) {
      return `      <h2>${esc(title)}</h2>\n      <p>Sin torneos de este grupo en las fuentes consultadas.</p>`;
    }
    const items = events.map((event) => {
      const name = placeEs(event.name);
      const cityRaw = cityIfNew(event.name, event.city);
      const city = cityRaw ? ` ${esc(cityRaw)}.` : '';
      const internal = linkIndex.tournament(event.name);
      const title = internal ? `<a href="${esc(prefixHref(internal.href, 0))}">${esc(name)}</a>` : esc(name);
      return `        <li>
          <p class="kicker">${esc(levelPlain(event.circuit === 'WTA' ? 'WTA' : event.circuit, placeEs(event.category)))}</p>
          ${title}.${city} ${datedHtml(event, esc)}. Superficie: ${showHtml(surfaceEs(event.surface), esc)}.
          <p>Fuente: ${sourcesHtml(event.sources, esc)}</p>
        </li>`;
    }).join('\n');
    return `      <h2>${esc(title)}</h2>\n      <ul class="event-list">\n${items}\n      </ul>`;
  }).join('\n');
  const rankList = (players, label) => {
    const items = players.map((player) => {
      const ranked = officialRank(player, ranking);
      const href = countryCards.get(`${player.tour}:${player.name}`);
      const shown = displayName(ranked.name);
      const name = href
        ? `<a href="${esc(href.replace(site, '').replace(/^\//, ''))}">${esc(shown)}</a>`
        : esc(shown);
      return `        <li class="rank-person">
          ${portrait(player, esc, '')}
          <p>${esc(formatPoints(ranked.position))}. ${name}. ${esc(formatPoints(ranked.points))} puntos.</p>
        </li>`;
    }).join('\n');
    return `      <h2>${esc(label)}</h2>\n      <ul class="event-list">\n${items}\n      </ul>`;
  };
  const spainGaps = spain.gaps.map((gap) => `        <li>${esc(gap)}</li>`).join('\n');
  entries.push({
    file: 'tenis-en-espana.html',
    lastmod: spain.updated,
    page: {
      title: 'Tenis en España | AceArena',
      description: 'Torneos ATP, Challenger y WTA en España, incluidos los WTA 125 y el ITF femenino, y el top 50 español de cada circuito con la fecha del ranking.',
      canonical: spainUrl,
      depth: 0,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Tenis en España', url: spainUrl },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Tenis en España',
          url: spainUrl,
        },
      ],
      main: `  <main class="section page-section" id="contenido">
    <div class="container">
      ${crumbNav([{ label: 'Inicio', href: 'index.html' }, { label: 'Tenis en España' }])}
      <div class="section-header">
        <span class="section-tag">España</span>
        <h1>Tenis en España</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p>Torneos que las fuentes oficiales sitúan en España, y los 50 mejores del ranking ATP y del ranking WTA con código ESP.</p>
        <p class="as-of">Actualizado el ${esc(longDate(spain.updated))}. Ranking del ${esc(longDate(ranking.asOf))}.</p>
      </div>
${tournamentLists}
      <h2>Qué no está en la lista</h2>
      <ul class="event-list">
${spainGaps}
      </ul>
${rankList(spain.atp, 'Top 50 ATP')}
${rankList(spain.wta, 'Top 50 WTA')}
      <p><a href="paises/espana.html">Fichas de España</a> · <a href="rankings.html">Rankings</a></p>
    </div>
  </main>`,
    },
  });

  const tourEvents = prepareTournaments(tournaments);
  const tourUrl = `${site}/torneos/`;
  const visibleEvents = tourEvents.filter((event) => tournamentHasData(event));
  const tourItems = visibleEvents.map((event) => {
    const category = categoryLabel(event);
    return `        <li><a href="${esc(event.slug)}.html">${esc(placeEs(event.name))}</a>. ${category ? esc(category) : sinDatoHtml()}. ${datedHtml(event, esc)}.</li>`;
  }).join('\n');
  entries.push({
    file: 'torneos/index.html',
    lastmod: tournaments.updated,
    page: {
      title: 'Torneos de 2026 | AceArena',
      description: 'Páginas de los torneos ATP y WTA de 2026 con categoría, fechas, superficie y, cuando la fuente lo trae, campeón, finalista y marcador.',
      canonical: tourUrl,
      depth: 1,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Torneos', url: tourUrl },
        ]),
      ],
      main: `  <main class="section page-section" id="contenido">
    <div class="container">
      ${crumbNav([{ label: 'Inicio', href: '../index.html' }, { label: 'Torneos' }])}
      <div class="section-header">
        <span class="section-tag">2026</span>
        <h1>Torneos de la temporada</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p>${proseHtml(tournaments.coverage, esc)}</p>
        <p class="as-of">Actualizado el ${esc(longDate(tournaments.updated))}.</p>
      </div>
      <ul class="event-list">
${tourItems}
      </ul>
    </div>
  </main>`,
    },
  });
  function personLink(name, depth) {
    const found = linkIndex.player(name);
    const label = displayName(name);
    if (!found || isMissing(name)) return showHtml(label, esc);
    return `<a href="${esc(prefixHref(found.href, depth))}">${esc(label)}</a>`;
  }
  for (const event of tourEvents) {
    const url = `${site}/torneos/${event.slug}.html`;
    const title = placeEs(event.name);
    const indexed = tournamentHasData(event);
    const officialLinks = [
      ['ATP', event.officialUrlAtp || (event.tour === 'ATP' ? event.officialUrl : '')],
      ['WTA', event.officialUrlWta || (event.tour === 'WTA' ? event.officialUrl : '')],
      [event.tour, !event.combined ? event.officialUrl : ''],
    ].filter(([, href], index, all) => href && !isMissing(href) && all.findIndex((item) => item[1] === href) === index);
    const official = officialLinks.length
      ? `<p>${officialLinks.map(([label, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Fuente oficial${event.combined ? ` ${esc(label)}` : ''}</a>`).join(' · ')}</p>`
      : `<p>Enlace de la ficha del torneo: ${sinDatoHtml()}</p>`;
    const categoryRows = event.combined
      ? [
        factRow('Categoría ATP', levelShort('ATP', event.categoryAtp), esc),
        factRow('Categoría WTA', levelShort('WTA', event.categoryWta), esc),
      ]
      : [factRow('Categoría', levelPlain(event.tour === 'ATP y WTA' ? 'ATP' : event.tour, placeEs(event.category)), esc)];
    const resultRows = event.combined
      ? [
        { dt: 'Campeón ATP', dd: personLink(event.championAtp, 1), missing: isMissing(event.championAtp) },
        { dt: 'Finalista ATP', dd: personLink(event.finalistAtp, 1), missing: isMissing(event.finalistAtp) },
        factRow('Marcador ATP', event.scoreAtp, esc),
        { dt: 'Campeona WTA', dd: personLink(event.championWta, 1), missing: isMissing(event.championWta) },
        { dt: 'Finalista WTA', dd: personLink(event.finalistWta, 1), missing: isMissing(event.finalistWta) },
        factRow('Marcador WTA', event.scoreWta, esc),
      ]
      : [
        { dt: 'Campeón', dd: personLink(event.champion, 1), missing: isMissing(event.champion) },
        { dt: 'Finalista', dd: personLink(event.finalist, 1), missing: isMissing(event.finalist) },
        factRow('Marcador', event.score, esc),
      ];
    const factBlock = factsHtml([
      ...categoryRows,
      { dt: 'Fechas', dd: datedFieldHtml(event, esc), missing: isMissing(event.startDate) },
      factRow('Sede', placeEs(event.city), esc),
      factRow('Superficie', surfaceEs(event.surface), esc),
      ...resultRows,
    ]);
    const namedHere = new Map();
    const eventHit = `torneos/${event.slug}.html`;
    for (const player of players || []) {
      const labels = [player.hoy?.tournament, ...(player.nextEvents || []).map((item) => item.name), player.nextEvent?.name];
      if (labels.some((label) => label && linkIndex.tournament(label)?.href === eventHit)) namedHere.set(player.slug, player);
    }
    for (const spot of week?.spotlight || []) {
      if (linkIndex.tournament(spot.tournament)?.href === eventHit) {
        const player = (players || []).find((item) => normalizeName(item.name) === normalizeName(spot.name));
        if (player) namedHere.set(player.slug, player);
      }
    }
    const relatedNews = (news || []).filter((article) => linkIndex.tournament(article.tournament)?.href === eventHit);
    const ace = [
      ...relatedNews.map((article) => `<a href="../noticias/${esc(article.slug)}.html">${esc(article.title)}</a>`),
      ...[...namedHere.values()].map((player) => `<a href="../jugadores/${esc(player.slug)}.html">${esc(player.name)}</a>`),
      '<a href="../semana.html">Esta semana</a>',
    ];
    entries.push({
      file: `torneos/${event.slug}.html`,
      lastmod: tournaments.updated,
      noindex: !indexed,
      page: {
        title: `${title} | AceArena`,
        description: `${[title, categoryLabel(event), cityIfNew(event.name, event.city)].filter(Boolean).join(', ')}. ${datedPlain(event)}.`,
        canonical: url,
        depth: 1,
        robots: indexed ? undefined : 'noindex, follow',
        jsonLd: [
          breadcrumb([
            { name: 'Inicio', url: `${site}/` },
            { name: 'Torneos', url: tourUrl },
            { name: title, url },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'SportsEvent',
            name: title,
            url,
            startDate: isMissing(event.startDate) ? undefined : event.startDate,
            endDate: isMissing(event.endDate) ? undefined : event.endDate,
            sport: 'Tennis',
            location: isMissing(event.city) ? undefined : placeEs(event.city),
          },
        ],
        main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([
        { label: 'Inicio', href: '../index.html' },
        { label: 'Torneos', href: 'index.html' },
        { label: esc(title) },
      ])}
      <h1>${esc(title)}</h1>
      <p class="article-byline">Redacción AceArena</p>
      ${factBlock}
      ${official}
      <h2>En AceArena</h2>
      <ul class="event-list">
${ace.map((item) => `        <li>${item}</li>`).join('\n')}
      </ul>
      <section class="sources">
        <h2>Fuentes</h2>
        <p>${sourcesHtml(event.sources, esc)}</p>
      </section>
    </article>
  </main>`,
      },
    });
  }

  const h2hUrl = `${site}/cara-a-cara/`;
  const h2hItems = h2h.ties.map((tie) => (
    `        <li><a href="${esc(tie.slug)}.html">${esc(displayName(tie.playerA))} – ${esc(displayName(tie.playerB))}</a>. ${esc(placeEs(tie.tournament))}, ${esc(tie.round)}. ${esc(surfaceEs(tie.surface))}.</li>`
  )).join('\n');
  entries.push({
    file: 'cara-a-cara/index.html',
    lastmod: h2h.updated,
    page: {
      title: 'Cara a cara | AceArena',
      description: 'Enfrentamientos destacados de la semana, con superficie y fuente. Sin cuotas ni enlaces a apuestas.',
      canonical: h2hUrl,
      depth: 1,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Cara a cara', url: h2hUrl },
        ]),
      ],
      main: `  <main class="section page-section" id="contenido">
    <div class="container">
      ${crumbNav([{ label: 'Inicio', href: '../index.html' }, { label: 'Cara a cara' }])}
      <div class="section-header">
        <span class="section-tag">Semana</span>
        <h1>Cara a cara</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p>${esc(h2h.note)}</p>
      </div>
      <ul class="event-list">
${h2hItems}
      </ul>
    </div>
  </main>`,
    },
  });
  for (const tie of h2h.ties) {
    const url = `${site}/cara-a-cara/${tie.slug}.html`;
    const left = displayName(tie.playerA);
    const right = displayName(tie.playerB);
    const tourHit = linkIndex.tournament(tie.tournament);
    const tourLabel = tourHit
      ? `<a href="${esc(prefixHref(tourHit.href, 1))}">${esc(placeEs(tie.tournament))}</a>`
      : showHtml(placeEs(tie.tournament), esc);
    const relatedNews = (news || []).filter((article) => (article.players || []).some((name) => (
      normalizeName(name) === normalizeName(tie.playerA) || normalizeName(name) === normalizeName(tie.playerB)
    )));
    const ace = [
      ...(linkIndex.player(tie.playerA) ? [`<a href="${esc(prefixHref(linkIndex.player(tie.playerA).href, 1))}">${esc(left)}</a>`] : []),
      ...(linkIndex.player(tie.playerB) ? [`<a href="${esc(prefixHref(linkIndex.player(tie.playerB).href, 1))}">${esc(right)}</a>`] : []),
      ...relatedNews.map((article) => `<a href="../noticias/${esc(article.slug)}.html">${esc(article.title)}</a>`),
      '<a href="../semana.html">Esta semana</a>',
    ];
    entries.push({
      file: `cara-a-cara/${tie.slug}.html`,
      lastmod: h2h.updated,
      page: {
        title: `${left} – ${right} | AceArena`,
        description: `${left} contra ${right} en ${placeEs(tie.tournament)}. ${surfaceEs(tie.surface)}. Sin cuotas.`,
        canonical: url,
        depth: 1,
        jsonLd: [
          breadcrumb([
            { name: 'Inicio', url: `${site}/` },
            { name: 'Cara a cara', url: h2hUrl },
            { name: `${left} – ${right}`, url },
          ]),
        ],
        main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([
        { label: 'Inicio', href: '../index.html' },
        { label: 'Cara a cara', href: 'index.html' },
        { label: esc(`${left} – ${right}`) },
      ])}
      <h1>${personLink(tie.playerA, 1)} – ${personLink(tie.playerB, 1)}</h1>
      <p class="article-byline">Redacción AceArena</p>
      ${factsHtml([
        { dt: 'Torneo', dd: tourLabel, missing: isMissing(tie.tournament) },
        factRow('Ronda', roundLower(tie.round), esc),
        factRow('Fechas', tie.dates, esc),
        factRow('Superficie', surfaceEs(tie.surface), esc),
        factRow('Historial', [tie.h2h, tie.h2hNote].filter((part) => !isMissing(part)).join(' '), esc),
      ])}
      ${factsHtml([
        factRow(`Últimos cinco de ${left}`, tie.lastA, esc),
        factRow(`Últimos cinco de ${right}`, tie.lastB, esc),
      ])}
      <h2>En AceArena</h2>
      <ul class="event-list">
${ace.map((item) => `        <li>${item}</li>`).join('\n')}
      </ul>
      <section class="sources">
        <h2>Fuentes</h2>
        <p>${sourcesHtml(tie.sources, esc)}</p>
      </section>
    </article>
  </main>`,
      },
    });
  }

  const latest = news.reduce((max, article) => (article.date > max ? article.date : max), '');
  const contentDay = today || latest;
  const dayArticles = news.filter((article) => article.date === contentDay).slice(0, 5);
  const latestArticles = news.filter((article) => article.date === latest).slice(0, 5);
  const briefUrl = `${site}/hoy-en-30-segundos.html`;
  const shown = dayArticles.length ? dayArticles : latestArticles;
  const briefItems = shown.map((article) => (
    `        <li><a href="noticias/${esc(article.slug)}.html">${esc(article.summary)}</a></li>`
  )).join('\n') || `        <li>${sinDatoHtml()}</li>`;
  const briefLead = dayArticles.length
    ? `Piezas del ${esc(longDate(contentDay))}. Cada frase enlaza con la noticia.`
    : `Hoy no hay piezas nuevas. Lo último, del ${esc(longDate(latest))}:`;
  const spanishToday = (order.players || []).filter((player) => player.day === contentDay);
  const spanishLine = spanishToday.length
    ? `<ul class="event-list">\n${spanishToday.map((player) => `        <li>${esc(player.name)}, ${esc(roundLower(player.round))} ante ${esc(player.opponent)} en ${esc(player.tournament)}.</li>`).join('\n')}\n      </ul>`
    : `<p>Hoy, ${esc(longDate(contentDay))}, ningún español con ficha tiene un partido con día publicado.</p>`;
  entries.push({
    file: 'hoy-en-30-segundos.html',
    lastmod: latest || updated,
    page: {
      title: 'Lo de hoy en 30 segundos | AceArena',
      description: dayArticles.length
        ? `Lo publicado el ${longDate(contentDay)}, en pocas frases, con enlace a cada noticia.`
        : `Hoy no hay piezas nuevas. Lo último es del ${longDate(latest)}.`,
      canonical: briefUrl,
      depth: 0,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Lo de hoy en 30 segundos', url: briefUrl },
        ]),
      ],
      main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([{ label: 'Inicio', href: 'index.html' }, { label: 'Lo de hoy en 30 segundos' }])}
      <h1>Lo de hoy en 30 segundos</h1>
      <p class="article-byline">Redacción AceArena</p>
      <p>${briefLead}</p>
      <ul class="event-list">
${briefItems}
      </ul>
      <h2>Españoles</h2>
      ${spanishLine}
      <p><a href="noticias/index.html">Archivo de noticias</a> · <a href="horarios.html">Horarios</a></p>
    </article>
  </main>`,
    },
  });

  const hoursUrl = `${site}/horarios.html`;
  const attempts = (order.attempts || []).map((attempt) => (
    `        <li><a href="${esc(attempt.url)}" target="_blank" rel="noopener noreferrer">${esc(attempt.name)}</a>. ${esc(attempt.result)}</li>`
  )).join('\n');
  const sessionBlocks = (order.sessions || []).map((session) => {
    const rows = (session.items || []).map((item) => (
      `        <li>${esc(item.label)}. Inicio de jornada: ${esc(item.local)} hora local, ${esc(item.madrid)} en Madrid, ${esc(item.buenosAires)} en Buenos Aires y ${esc(item.mexicoCity)} en Ciudad de México.</li>`
    )).join('\n');
    return `      <h3>${esc(session.tournament)}, ${esc(session.place)}</h3>
      <p class="source-line">Fuente: <a href="${esc(session.source.url)}" target="_blank" rel="noopener noreferrer">${esc(session.source.name)}</a></p>
      <ul class="event-list">
${rows}
      </ul>`;
  }).join('\n');
  const playerLines = (order.players || []).map((player) => {
    const found = linkIndex.player(player.name);
    const sheet = (players || []).find((item) => normalizeName(item.name) === normalizeName(player.name));
    const day = player.day || sheet?.hoy?.day || '';
    const name = found ? `<a href="${esc(prefixHref(found.href, 0))}">${esc(player.name)}</a>` : esc(player.name);
    return `        <li>${name} abre ante ${esc(player.opponent)} en ${esc(roundLower(player.round))} de ${esc(player.tournament)}. Día: ${day ? esc(day) : sinDatoHtml()}.</li>`;
  }).join('\n');
  const matchBlock = order.matches && order.matches.length
    ? factsHtml(order.matches.map((match) => ({
      dt: `${match.playerA} – ${match.playerB}`,
      dd: esc(`${match.madrid} Madrid · ${match.buenosAires} Buenos Aires · ${match.mexicoCity} Ciudad de México`),
      missing: false,
    })))
    : `<p>Aún no hay orden de juego oficial con horas. Consulta del ${esc(longDate(order.date))}.</p>`;
  entries.push({
    file: 'horarios.html',
    lastmod: order.updated,
    page: {
      title: 'Horarios del día | AceArena',
      description: 'Inicio de jornada que publica cada torneo, en hora de Madrid, Buenos Aires y Ciudad de México. No es la hora del partido.',
      canonical: hoursUrl,
      depth: 0,
      jsonLd: [
        breadcrumb([
          { name: 'Inicio', url: `${site}/` },
          { name: 'Horarios', url: hoursUrl },
        ]),
      ],
      main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([{ label: 'Inicio', href: 'index.html' }, { label: 'Horarios' }])}
      <h1>Horarios del ${esc(longDate(order.date))}</h1>
      <p class="article-byline">Redacción AceArena</p>
      <p class="as-of">Actualizado el ${esc(longDate(order.updated))}.</p>
      <h2>Inicio de la jornada (horario oficial del torneo)</h2>
      <p>Es la hora a la que abre la sesión, no la hora de un partido.</p>
${sessionBlocks}
      <h2>Españoles con partido esta semana</h2>
      <ul class="event-list">
${playerLines}
      </ul>
${matchBlock}
      <h2>Fuentes consultadas</h2>
      <ul class="event-list">
${attempts}
      </ul>
    </article>
  </main>`,
    },
  });

  return entries;
}
