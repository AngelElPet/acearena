import { categoryLabel, correctionSentence, crumbNav } from './facts.mjs';
import { isMissing, sinDatoHtml } from './missing.mjs';
import { cityIfNew, placeEs, surfaceEs } from './places.mjs';
import { displayName, formatPoints, normalizeName } from './ranking.mjs';
import { tournamentHasData } from './tournaments.mjs';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function longDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function addDays(iso, days) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function crumbLd(items) {
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

function dated(event) {
  const start = longDate(event.startDate);
  if (isMissing(event.endDate)) return `Empieza el ${start}`;
  return `${start} – ${longDate(event.endDate)}`;
}

function mondayOf(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
}

function prominence(event) {
  const text = `${event.name || ''} ${event.category || ''} ${event.categoryAtp || ''} ${event.categoryWta || ''}`;
  if (/grand slam|masters 1000|wta 1000|\bfinals\b/i.test(text)) return 0;
  return 1;
}

function spokenSets(score) {
  const sets = String(score || '').replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (sets.length <= 1) return sets[0] || '';
  return `${sets.slice(0, -1).join(', ')} y ${sets[sets.length - 1]}`;
}

export function trustEntries({
  calendarDoc, rankings, players, spain, tournaments, corrections, contentDay,
}, { esc, site, longDay, ranking }) {
  const entries = [];
  const sheets = new Map((players || []).map((player) => [normalizeName(player.name), player]));

  const methodUrl = `${site}/metodologia.html`;
  entries.push({
    file: 'metodologia.html',
    lastmod: contentDay,
    page: {
      title: 'Metodología | AceArena',
      description: 'De dónde sale cada dato de AceArena, cuándo se actualiza y qué significa la raya gris.',
      canonical: methodUrl,
      depth: 0,
      jsonLd: [crumbLd([{ name: 'Inicio', url: `${site}/` }, { name: 'Metodología', url: methodUrl }])],
      main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([{ label: 'Inicio', href: 'index.html' }, { label: 'Metodología' }])}
      <h1>Metodología</h1>
      <p class="as-of">Actualizado el ${esc(longDay(contentDay))}.</p>
      <p>Cada cifra de AceArena sale de una fuente que se puede abrir. Si la fuente no trae el dato, la página muestra una raya gris.</p>
      <h2>De dónde sale cada dato</h2>
      <ul class="event-list">
        <li>Rankings: las listas oficiales de la ATP y de la WTA, con la fecha de esa lista.</li>
        <li>Resultados: la ATP, la WTA y las páginas de los torneos.</li>
        <li>Marcadores en vivo de la portada: SportScore.</li>
        <li>Fotos: Wikimedia Commons y otras fuentes con licencia que permite el uso comercial. La atribución está en la propia foto y en Créditos.</li>
        <li>Calendario ATP de 2026: si atptour.com no deja leer la ficha, la categoría y la fecha de cierre salen de Wikipedia, artículo «2026 ATP Tour», que cita a la ATP. El enlace está en la página del torneo.</li>
      </ul>
      <h2>Cuándo se actualiza</h2>
      <p>Una vez al día, por la mañana, en hora de Madrid. El ranking nuevo entra los lunes, cuando la ATP y la WTA publican la lista.</p>
      <h2>La raya gris</h2>
      <p>Una raya gris centrada quiere decir que ese campo no está en la fuente. No es un cero ni un hueco que vayamos a rellenar. Si un bloque entero no tiene datos, la raya aparece una sola vez.</p>
      <h2>Correcciones</h2>
      <p>Si un dato publicado estaba mal, se cambia y se deja la fecha en la pieza y en <a href="correcciones.html">Correcciones</a>. Para avisar de un error: <a href="mailto:hola@acearena.io">hola@acearena.io</a>.</p>
      <h2>Qué no hacemos</h2>
      <ul class="event-list">
        <li>No publicamos cuotas ni enlaces a apuestas.</li>
        <li>No inventamos citas.</li>
        <li>No generamos imágenes de personas reales.</li>
        <li>No indicamos canales de televisión.</li>
      </ul>
    </article>
  </main>`,
    },
  });

  const fixUrl = `${site}/correcciones.html`;
  const fixItems = (corrections.items || []).map((item) => (
    `        <li>${esc(correctionSentence(longDate(item.date), item.text))} <a href="noticias/${esc(item.slug)}.html">Ver la pieza</a>. Fuente: <a href="${esc(item.source.url)}" target="_blank" rel="noopener noreferrer">${esc(item.source.name)}</a>.</li>`
  )).join('\n');
  entries.push({
    file: 'correcciones.html',
    lastmod: corrections.updated,
    page: {
      title: 'Correcciones | AceArena',
      description: 'Cambios en piezas ya publicadas, con la fecha y la fuente de cada corrección.',
      canonical: fixUrl,
      depth: 0,
      jsonLd: [crumbLd([{ name: 'Inicio', url: `${site}/` }, { name: 'Correcciones', url: fixUrl }])],
      main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([{ label: 'Inicio', href: 'index.html' }, { label: 'Correcciones' }])}
      <h1>Correcciones</h1>
      <p class="as-of">Actualizado el ${esc(longDay(corrections.updated))}.</p>
      <p>Aquí queda cada cambio sobre una pieza ya publicada.</p>
      <ul class="event-list">
${fixItems}
      </ul>
    </article>
  </main>`,
    },
  });

  const from = addDays(contentDay, 1);
  const until = addDays(contentDay, 28);
  const upcoming = (tournaments || []).filter((event) => (
    tournamentHasData(event)
    && !isMissing(event.startDate)
    && event.startDate >= from
    && event.startDate <= until
  ));
  const calUrl = `${site}/calendario.html`;
  const weeks = new Map();
  for (const event of upcoming) {
    const key = mondayOf(event.startDate);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(event);
  }
  const calBlocks = [...weeks.keys()].sort().map((key) => {
    const events = weeks.get(key).sort((a, b) => (
      prominence(a) - prominence(b)
      || String(a.startDate).localeCompare(String(b.startDate))
      || placeEs(a.name).localeCompare(placeEs(b.name), 'es')
    ));
    const items = events.map((event) => {
      const city = cityIfNew(event.name, event.city);
      const category = categoryLabel(event);
      return `        <li><a href="torneos/${esc(event.slug)}.html">${esc(placeEs(event.name))}</a>.${city ? ` ${esc(city)}.` : ''} ${esc(dated(event))}. ${category ? esc(category) : sinDatoHtml()}. ${esc(surfaceEs(event.surface))}.</li>`;
    }).join('\n');
    const end = addDays(key, 6);
    return `      <h2>Semana del ${esc(longDate(key))} al ${esc(longDate(end))}</h2>
      <ul class="event-list">
${items}
      </ul>`;
  }).join('\n');
  entries.push({
    file: 'calendario.html',
    lastmod: contentDay,
    page: {
      title: 'Calendario de tenis | AceArena',
      description: 'Las próximas cuatro semanas del circuito, con ciudad, fechas, categoría y superficie.',
      canonical: calUrl,
      depth: 0,
      jsonLd: [crumbLd([{ name: 'Inicio', url: `${site}/` }, { name: 'Calendario', url: calUrl }])],
      main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([{ label: 'Inicio', href: 'index.html' }, { label: 'Calendario' }])}
      <h1>Calendario</h1>
      <p>Las próximas cuatro semanas, del ${esc(longDay(from))} al ${esc(longDay(until))}. En cada semana, Masters, Finals y WTA 1000 van primero.</p>
      <p class="as-of">Actualizado el ${esc(longDay(contentDay))}.</p>
${calBlocks}
      <p><a href="semana.html">Esta semana</a> · <a href="torneos/index.html">Torneos de 2026</a> · <a href="calendario-2027.html">Calendario 2027</a></p>
    </article>
  </main>`,
    },
  });

  const ao = calendarDoc.sections.flatMap((section) => section.events).find((event) => event.name === 'Australian Open');
  const guideUrl = `${site}/guia-australian-open-2027.html`;
  const ranked = (list) => (list || []).slice(0, 8).flatMap((row) => {
    const official = ranking.lookup(row.tour, row.name);
    if (!official) return [];
    const sheet = sheets.get(normalizeName(row.name));
    const name = displayName(official.name || row.name);
    const linked = sheet ? `<a href="jugadores/${esc(sheet.slug)}.html">${esc(name)}</a>` : esc(name);
    return [`        <li>${esc(formatPoints(official.position))}. ${linked}. ${esc(formatPoints(official.points))} puntos.</li>`];
  }).slice(0, 5).join('\n');
  const aoEvent = (tournaments || []).find((event) => /australian open/i.test(event.name || ''));
  const atpName = aoEvent?.championAtp || (aoEvent?.tour === 'ATP' ? aoEvent.champion : '');
  const atpFinalist = aoEvent?.finalistAtp || (aoEvent?.tour === 'ATP' ? aoEvent.finalist : '');
  const atpScore = aoEvent?.scoreAtp || (aoEvent?.tour === 'ATP' ? aoEvent.score : '');
  const wtaName = aoEvent?.championWta || (aoEvent?.tour === 'WTA' ? aoEvent.champion : '');
  const wtaFinalist = aoEvent?.finalistWta || (aoEvent?.tour === 'WTA' ? aoEvent.finalist : '');
  const linkSource = (source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`;
  const aoSource = ao.sources.map(linkSource).join(' · ');
  const atpSources = (aoEvent?.sources || []).filter((source) => /atp|wikipedia/i.test(`${source.name} ${source.url}`));
  const wtaSources = (aoEvent?.sources || []).filter((source) => /wta/i.test(`${source.name} ${source.url}`));
  const atpSource = atpSources.map(linkSource).join(' · ');
  const wtaSource = wtaSources.map(linkSource).join(' · ');
  const champLink = (name) => {
    const sheet = sheets.get(normalizeName(name));
    return sheet ? `<a href="jugadores/${esc(sheet.slug)}.html">${esc(name)}</a>` : esc(name);
  };
  const atpChamp = !isMissing(atpName)
    ? `        <li>ATP, 2026: ${champLink(atpName)}${!isMissing(atpFinalist) ? ` ganó a ${esc(atpFinalist)}` : ''}${!isMissing(atpScore) ? ` por ${esc(spokenSets(atpScore))}` : ''}. Fuente: ${atpSource}.</li>`
    : `        <li>ATP, 2026: ${sinDatoHtml()}.</li>`;
  const wtaChamp = !isMissing(wtaName)
    ? `        <li>WTA, 2026: ${esc(wtaName)}. Finalista: ${isMissing(wtaFinalist) ? sinDatoHtml() : esc(wtaFinalist)}. Fuente: ${wtaSource}.</li>`
    : `        <li>WTA, 2026: ${sinDatoHtml()}.</li>`;
  const spanishAo = !isMissing(atpName) && !isMissing(atpFinalist) && !isMissing(atpScore)
    ? `      <p>En 2026, ${champLink(atpName)} fue el campeón masculino: ganó la final a ${esc(atpFinalist)} por ${esc(spokenSets(atpScore))}.</p>
      <p class="source-line">Fuente: ${atpSource}</p>`
    : '';
  entries.push({
    file: 'guia-australian-open-2027.html',
    lastmod: rankings.asOf,
    page: {
      title: 'Guía del Australian Open 2027 | AceArena',
      description: 'Australian Open 2027 en Melbourne Park: fechas, Rod Laver Arena, superficie, campeones de 2026 y españoles del ranking, con enlace a cada fuente.',
      canonical: guideUrl,
      depth: 0,
      jsonLd: [crumbLd([{ name: 'Inicio', url: `${site}/` }, { name: 'Guía del Australian Open 2027', url: guideUrl }])],
      main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([{ label: 'Inicio', href: 'index.html' }, { label: 'Guía del Australian Open 2027' }])}
      <h1>Guía del Australian Open 2027</h1>
      <p class="as-of">Actualizado el ${esc(longDay(rankings.asOf))}.</p>
      <p>${esc(ao.detail)} La sede es ${esc(ao.place)}.</p>
      <ul class="event-list">
        <li>Sede: ${esc(ao.place)}</li>
        <li>Fechas: 11–31 de enero de 2027</li>
        <li>Semana de apertura: 11–16 de enero</li>
        <li>Cuadro principal: 17–31 de enero</li>
        <li>Finales de individuales: 30 y 31 de enero</li>
      </ul>
      <p class="source-line">Fuente: ${aoSource}</p>
      <h2>Pistas</h2>
      <p>El anuncio del 23 de marzo de 2026 nombra la Rod Laver Arena entre las pistas de ${esc(ao.place)}.</p>
      <p class="source-line">Fuente: ${aoSource}</p>
      <h2>Superficie</h2>
      <p>${esc(surfaceEs(aoEvent?.surface || ao.surface))}.</p>
      <p class="source-line">Fuente: ${wtaSource || aoSource}</p>
      <h2>Campeones de 2026</h2>
      <ul class="event-list">
${atpChamp}
${wtaChamp}
      </ul>
      <p>El anuncio de fechas dice que Carlos Alcaraz y Aryna Sabalenka, primeros cabezas de serie, llegaron a las finales de individuales de 2026.</p>
      <p class="source-line">Fuente: ${aoSource}</p>
      <h2>Españoles en el Australian Open</h2>
${spanishAo}
      <h2>Españoles mejor clasificados</h2>
      <p>Lista del ${esc(longDay(rankings.asOf))}.</p>
      <h3>ATP</h3>
      <ul class="event-list">
${ranked(spain.atp)}
      </ul>
      <h3>WTA</h3>
      <ul class="event-list">
${ranked(spain.wta)}
      </ul>
      <p><a href="aprende/como-funciona-el-ranking-atp.html">Cómo funciona el ranking ATP</a> · <a href="aprende/como-funciona-el-ranking-wta.html">Cómo funciona el ranking WTA</a> · <a href="aprende/grand-slams.html">Grand Slams</a> · <a href="jugadores/index.html">Fichas</a></p>
    </article>
  </main>`,
    },
  });

  return entries;
}
