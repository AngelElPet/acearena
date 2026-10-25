import { crumbNav, levelPlain } from './facts.mjs';
import { isMissing } from './missing.mjs';
import { placeEs, surfaceEs } from './places.mjs';
import { displayName, normalizeName } from './ranking.mjs';
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
    `        <li><time datetime="${esc(item.date)}">${esc(longDate(item.date))}</time>. ${esc(item.text)} <a href="noticias/${esc(item.slug)}.html">Ver la pieza</a>. Fuente: <a href="${esc(item.source.url)}" target="_blank" rel="noopener noreferrer">${esc(item.source.name)}</a>.</li>`
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
  const calItems = upcoming.map((event) => {
    const category = event.combined
      ? `${levelPlain('ATP', event.categoryAtp)} · ${levelPlain('WTA', event.categoryWta)}`
      : levelPlain(event.tour, placeEs(event.category));
    return `        <li><a href="torneos/${esc(event.slug)}.html">${esc(placeEs(event.name))}</a>. ${esc(placeEs(event.city))}. ${esc(dated(event))}. ${esc(category)}. ${esc(surfaceEs(event.surface))}.</li>`;
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
      <p>Las próximas cuatro semanas, del ${esc(longDay(from))} al ${esc(longDay(until))}.</p>
      <p class="as-of">Actualizado el ${esc(longDay(contentDay))}.</p>
      <ul class="event-list">
${calItems}
      </ul>
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
    return [`        <li>${esc(official.position)}. ${linked}. ${esc(String(official.points))} puntos.</li>`];
  }).slice(0, 5).join('\n');
  entries.push({
    file: 'guia-australian-open-2027.html',
    lastmod: rankings.asOf,
    page: {
      title: 'Guía del Australian Open 2027 | AceArena',
      description: 'Fechas oficiales del Australian Open 2027 en Melbourne Park y los españoles mejor clasificados a fecha del ranking.',
      canonical: guideUrl,
      depth: 0,
      jsonLd: [crumbLd([{ name: 'Inicio', url: `${site}/` }, { name: 'Guía del Australian Open 2027', url: guideUrl }])],
      main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      ${crumbNav([{ label: 'Inicio', href: 'index.html' }, { label: 'Guía del Australian Open 2027' }])}
      <h1>Guía del Australian Open 2027</h1>
      <p class="as-of">Actualizado el ${esc(longDay(rankings.asOf))}.</p>
      <p>${esc(ao.detail)} La sede es ${esc(ao.place)} y la superficie es ${esc(ao.surface)}.</p>
      <ul class="event-list">
        <li>Fechas: 11–31 de enero de 2027</li>
        <li>Semana de apertura: 11–16 de enero</li>
        <li>Cuadro principal: 17–31 de enero</li>
        <li>Finales de individuales: 30 y 31 de enero</li>
        <li>Superficie: ${esc(ao.surface)}</li>
      </ul>
      <p class="source-line">Fuente: ${ao.sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`).join(' · ')}</p>
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
