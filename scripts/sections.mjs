import { prefixHref } from './links.mjs';
import { isMissing, proseHtml, showHtml, showText, sinDatoHtml } from './missing.mjs';
import { placeEs, surfaceEs } from './places.mjs';
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

function sheet(player, esc, ranking) {
  const ranked = officialRank(player, ranking);
  const rows = [
    birthLine(player, esc),
    `Ranking: ${esc(ranked.position)}. Puntos: ${esc(formatPoints(ranked.points))}. Lista del ${esc(longDate(ranking.asOf))}.`,
    `Mejor ranking de carrera: ${careerHighHtml(player, esc)}.`,
    `Mano: ${showHtml(player.hand, esc)}.`,
    `Estatura: ${showHtml(player.height, esc)}.`,
    titlesLine(player, esc),
    `Títulos de carrera: ${showHtml(player.titlesCareer, esc)}.`,
    `Mejor resultado de Grand Slam en la carrera: ${showHtml(placeEs(player.grandSlamBest), esc)}.`,
    `Grand Slam en 2026: ${showHtml(placeEs(player.grandSlam2026), esc)}.`,
    `Premios de la temporada: ${showHtml(money(player.prizeSeason, player.prizeCurrency), esc)}.`,
    `Premios de carrera: ${showHtml(money(player.prizeCareer, player.prizeCurrency), esc)}.`,
    `Torneos de la temporada: ${showHtml(player.tournamentsSeason, esc)}.`,
  ];
  return `<ul class="event-list">\n${rows.map((row) => `          <li>${row}</li>`).join('\n')}\n        </ul>`;
}

function playerCard(player, esc, prefix, countryName, ranking) {
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
            <p class="kicker">${esc(player.tour)} · ${esc(countryName)} · ${esc(ranked.position)}</p>
            <h2>${esc(displayName(ranked.name))}</h2>
            ${sheet(player, esc, ranking)}
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

export function sectionEntries({ countries, spain, tournaments, h2h, order, news, players, linkIndex }, { esc, site, ranking }) {
  const entries = [];
  const updated = countries.updated;
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
      <p class="news-meta"><a href="../index.html">Inicio</a> · Jugadores por país</p>
      <div class="section-header">
        <span class="section-tag">Rankings</span>
        <h1>Jugadores por país</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p>${esc(countries.criterion)}</p>
        <p class="as-of">Ranking ATP y WTA del ${esc(longDate(ranking.asOf))}. Informe de finales ATP a ${esc(longDate(countries.atpReportAsOf))}.</p>
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
      ? `      <h2>ATP</h2>\n      <div class="card-grid">\n${country.atp.map((player) => playerCard(player, esc, '../', country.name, ranking)).join('\n')}\n      </div>`
      : '      <h2>ATP</h2>\n      <p>Sin jugadores con código de este país en la lista consultada.</p>';
    const wtaBlock = country.wta.length
      ? `      <h2>WTA</h2>\n      <div class="card-grid">\n${country.wta.map((player) => playerCard(player, esc, '../', country.name, ranking)).join('\n')}\n      </div>`
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
      <p class="news-meta"><a href="../index.html">Inicio</a> · <a href="index.html">Jugadores por país</a> · ${esc(country.name)}</p>
      <div class="section-header">
        <span class="section-tag">${esc(country.code)}</span>
        <h1>${esc(country.name)}</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p>Hasta 20 jugadores del ranking ATP y 20 jugadoras del ranking WTA. Si un campo no está en la fuente, aparece ${sinDatoHtml()}.</p>
        <p class="as-of">Ranking ATP y WTA del ${esc(longDate(ranking.asOf))}. Finales ATP a ${esc(longDate(countries.atpReportAsOf))}.</p>
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
      const cityRaw = placeEs(event.city);
      const city = cityRaw && cityRaw !== name ? ` ${esc(cityRaw)}.` : '';
      const internal = linkIndex.tournament(event.name);
      const title = internal ? `<a href="${esc(prefixHref(internal.href, 0))}">${esc(name)}</a>` : esc(name);
      return `        <li>
          <p class="kicker">${esc(placeEs(event.category))}</p>
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
          <p>${esc(ranked.position)}. ${name}. ${esc(formatPoints(ranked.points))} puntos.</p>
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
      description: 'Torneos ATP, Challenger, WTA, WTA 125 e ITF femenino en España, y el top 50 español de cada circuito con la fecha del ranking.',
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
      <p class="news-meta"><a href="index.html">Inicio</a> · Tenis en España</p>
      <div class="section-header">
        <span class="section-tag">España</span>
        <h1>Tenis en España</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p>Torneos que las fuentes oficiales sitúan en España, y los 50 mejores del ranking ATP y del ranking WTA con código ESP. Ranking del ${esc(longDate(ranking.asOf))}.</p>
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
    const category = event.combined
      ? `ATP ${showHtml(event.categoryAtp, esc)} · WTA ${showHtml(event.categoryWta, esc)}`
      : showHtml(placeEs(event.category), esc);
    return `        <li><a href="${esc(event.slug)}.html">${esc(placeEs(event.name))}</a>. ${esc(event.tour)}, ${category}. ${datedHtml(event, esc)}.</li>`;
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
      <p class="news-meta"><a href="../index.html">Inicio</a> · Torneos</p>
      <div class="section-header">
        <span class="section-tag">2026</span>
        <h1>Torneos de la temporada</h1>
        <p class="article-byline">Redacción AceArena</p>
        <p>${proseHtml(tournaments.coverage, esc)}</p>
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
    const categoryItem = event.combined
      ? `<li>Categoría ATP: ${showHtml(event.categoryAtp, esc)}. Categoría WTA: ${showHtml(event.categoryWta, esc)}.</li>`
      : `<li>Categoría: ${showHtml(placeEs(event.category), esc)}.</li>`;
    const resultItems = event.combined
      ? `<li>Campeón ATP: ${personLink(event.championAtp, 1)}.</li>
        <li>Finalista ATP: ${personLink(event.finalistAtp, 1)}.</li>
        <li>Marcador de la final ATP: ${showHtml(event.scoreAtp, esc)}.</li>
        <li>Campeona WTA: ${personLink(event.championWta, 1)}.</li>
        <li>Finalista WTA: ${personLink(event.finalistWta, 1)}.</li>
        <li>Marcador de la final WTA: ${showHtml(event.scoreWta, esc)}.</li>`
      : `<li>Campeón: ${personLink(event.champion, 1)}.</li>
        <li>Finalista: ${personLink(event.finalist, 1)}.</li>
        <li>Marcador de la final: ${showHtml(event.score, esc)}.</li>`;
    const relatedNews = (news || []).filter((article) => linkIndex.tournament(article.tournament)?.href === `torneos/${event.slug}.html`);
    const ace = [
      ...relatedNews.map((article) => `<a href="../noticias/${esc(article.slug)}.html">${esc(article.title)}</a>`),
      '<a href="../semana.html">Esta semana</a>',
    ];
    entries.push({
      file: `torneos/${event.slug}.html`,
      lastmod: tournaments.updated,
      noindex: !indexed,
      page: {
        title: `${title} | AceArena`,
        description: `${title}, ${event.tour}. ${event.combined ? `ATP ${showText(event.categoryAtp)}. WTA ${showText(event.categoryWta)}.` : showText(placeEs(event.category))}. ${datedPlain(event)}.`,
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
      <p class="news-meta"><a href="../index.html">Inicio</a> · <a href="index.html">Torneos</a> · ${esc(event.tour)}</p>
      <h1>${esc(title)}</h1>
      <p class="article-byline">Redacción AceArena</p>
      <ul class="event-list">
        ${categoryItem}
        <li>Fechas: ${datedFieldHtml(event, esc)}.</li>
        <li>Sede: ${showHtml(placeEs(event.city), esc)}.</li>
        <li>Superficie: ${showHtml(surfaceEs(event.surface), esc)}.</li>
        ${resultItems}
      </ul>
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
      <p class="news-meta"><a href="../index.html">Inicio</a> · Cara a cara</p>
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
      <p class="news-meta"><a href="../index.html">Inicio</a> · <a href="index.html">Cara a cara</a> · <a href="../semana.html">Esta semana</a></p>
      <h1>${personLink(tie.playerA, 1)} – ${personLink(tie.playerB, 1)}</h1>
      <p class="article-byline">Redacción AceArena</p>
      <ul class="event-list">
        <li>Torneo: ${tourLabel}.</li>
        <li>Ronda: ${showHtml(tie.round, esc)}.</li>
        <li>Fechas: ${showHtml(tie.dates, esc)}.</li>
        <li>Superficie: ${showHtml(surfaceEs(tie.surface), esc)}.</li>
        ${tieFact('Historial', tie.h2h, tie.h2hNote, esc)}
        ${tieFact(`Últimos cinco de ${left}`, tie.lastA, tie.lastNote, esc)}
        ${tieFact(`Últimos cinco de ${right}`, tie.lastB, '', esc)}
      </ul>
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
  const dayArticles = news.filter((article) => article.date === latest).slice(0, 5);
  const briefUrl = `${site}/hoy-en-30-segundos.html`;
  const briefItems = dayArticles.map((article) => (
    `        <li><a href="noticias/${esc(article.slug)}.html">${esc(article.summary)}</a></li>`
  )).join('\n') || `        <li>${sinDatoHtml()}</li>`;
  entries.push({
    file: 'hoy-en-30-segundos.html',
    lastmod: latest || updated,
    page: {
      title: 'Lo de hoy en 30 segundos | AceArena',
      description: `Lo publicado el ${longDate(latest)}, en pocas frases, con enlace a cada noticia.`,
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
      <p class="news-meta"><a href="index.html">Inicio</a> · Lo de hoy en 30 segundos</p>
      <h1>Lo de hoy en 30 segundos</h1>
      <p class="article-byline">Redacción AceArena</p>
      <p>Piezas con fecha ${esc(longDate(latest))}. Cada frase enlaza con la noticia completa.</p>
      <ul class="event-list">
${briefItems}
      </ul>
      <p><a href="noticias/index.html">Archivo de noticias</a></p>
    </article>
  </main>`,
    },
  });

  const hoursUrl = `${site}/horarios.html`;
  const attempts = (order.attempts || []).map((attempt) => (
    `        <li><a href="${esc(attempt.url)}" target="_blank" rel="noopener noreferrer">${esc(attempt.name)}</a>. ${esc(attempt.result)}</li>`
  )).join('\n');
  const matchItems = (order.matches || []).map((match) => (
    `        <li>${showHtml(match.tournament, esc)}. ${showHtml(match.playerA, esc)} – ${showHtml(match.playerB, esc)}. Madrid: ${showHtml(match.madrid, esc)}. Buenos Aires: ${showHtml(match.buenosAires, esc)}. Ciudad de México: ${showHtml(match.mexicoCity, esc)}.</li>`
  )).join('\n');
  const matchBlock = order.matches && order.matches.length
    ? `      <ul class="event-list">\n${matchItems}\n      </ul>`
    : `      <ul class="event-list">
        <li>Orden de juego del ${esc(longDate(order.date))}: ${sinDatoHtml()}.</li>
        <li>Hora en Madrid: ${sinDatoHtml()}.</li>
        <li>Hora en Buenos Aires: ${sinDatoHtml()}.</li>
        <li>Hora en Ciudad de México: ${sinDatoHtml()}.</li>
      </ul>`;
  entries.push({
    file: 'horarios.html',
    lastmod: order.updated,
    page: {
      title: 'Horarios del día | AceArena',
      description: 'Horas de Madrid, Buenos Aires y Ciudad de México a partir del orden de juego oficial. Sin canales de televisión.',
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
      <p class="news-meta"><a href="index.html">Inicio</a> · Horarios</p>
      <h1>Horarios del ${esc(longDate(order.date))}</h1>
      <p class="article-byline">Redacción AceArena</p>
      <p>${proseHtml(order.note, esc)}</p>
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
