import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayload } from './validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const SITE = 'https://acearena.io';
const HOMEPAGE_MAX_AGE_DAYS = 60;
const LLMS_LATEST = 20;
const BEACON = `<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "d21dd5ee912c4c80b8c8a4232ec883fc"}'></script>`;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function readJson(name) {
  return JSON.parse(readFileSync(join(root, 'data', name), 'utf8'));
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function xml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function formatDay(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function formatStamp(iso) {
  const date = new Date(iso);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatDay(iso)}, ${hh}:${mm} UTC`;
}

function ageDays(iso, today) {
  const then = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.round((now - then) / 86400000);
}

function onHomepage(iso, today) {
  const age = ageDays(iso, today);
  return age >= 0 && age <= HOMEPAGE_MAX_AGE_DAYS;
}

function byDateDesc(items, getDate) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => getDate(b.item).localeCompare(getDate(a.item)) || a.index - b.index)
    .map(({ item }) => item);
}

function fillRegion(html, name, inner) {
  const start = `<!-- AUTO:${name} -->`;
  const end = `<!-- /AUTO:${name} -->`;
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end);
  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    throw new Error(`Falta la región AUTO:${name} en index.html`);
  }
  return `${html.slice(0, startAt + start.length)}\n${inner.trim()}\n${html.slice(endAt)}`;
}

function injectBeacon(html) {
  const stripped = html.replace(/\n?<script defer src='https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js' data-cf-beacon='\{"token": "d21dd5ee912c4c80b8c8a4232ec883fc"\}'><\/script>\n?/g, '\n');
  const at = stripped.lastIndexOf('</body>');
  if (at === -1) throw new Error('HTML sin </body>');
  const next = `${stripped.slice(0, at)}${BEACON}\n${stripped.slice(at)}`;
  if (!next.slice(0, next.lastIndexOf('</body>')).trimEnd().endsWith(BEACON)) {
    throw new Error('El beacon no quedó justo antes de </body>');
  }
  if (next.split(BEACON).length !== 2) {
    throw new Error('El beacon quedó duplicado');
  }
  return next;
}

function writeHtml(relativePath, html) {
  const full = join(publicDir, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, injectBeacon(html.endsWith('\n') ? html : `${html}\n`));
}

function writeText(relativePath, text) {
  const full = join(publicDir, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text.endsWith('\n') ? text : `${text}\n`);
}

function prefixFor(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

function chrome(depth) {
  const p = prefixFor(depth);
  const header = `
  <header class="header scrolled" id="header">
    <div class="container header-inner">
      <a href="${p}index.html" class="logo">
        <span class="logo-mark">A</span>
        <span class="logo-text">AceArena</span>
      </a>
      <nav class="nav" id="nav">
        <a href="${p}index.html#hoy">Hoy</a>
        <a href="${p}noticias/index.html">Noticias</a>
        <a href="${p}index.html#rankings">Rankings</a>
        <a href="${p}index.html#calendario">Calendario</a>
        <a href="${p}index.html#guia">Aprende tenis</a>
        <a href="${p}agencias.html" class="nav-quiet">Anúnciate</a>
      </nav>
      <button class="menu-toggle" id="menuToggle" aria-label="Abrir menú" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>`;

  const footer = `
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <a href="${p}index.html" class="logo">
          <span class="logo-mark">A</span>
          <span class="logo-text">AceArena</span>
        </a>
        <p>AceArena: tenis en español, con datos y sin ruido.</p>
      </div>
      <div class="footer-links">
        <div>
          <h4>El circuito</h4>
          <a href="${p}index.html#hoy">Hoy</a>
          <a href="${p}noticias/index.html">Noticias</a>
          <a href="${p}index.html#rankings">Rankings</a>
          <a href="${p}resultados.html">Resultados</a>
          <a href="${p}index.html#calendario">Calendario</a>
          <a href="${p}index.html#guia">Aprende tenis</a>
        </div>
        <div>
          <h4>AceArena</h4>
          <a href="${p}index.html#sobre">Sobre AceArena</a>
          <a href="${p}index.html#newsletter">Briefing</a>
          <a href="${p}agencias.html">Anúnciate</a>
          <a href="mailto:hola@acearena.io">Contacto</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="${p}aviso-legal.html">Aviso legal</a>
          <a href="${p}privacidad.html">Privacidad</a>
          <a href="${p}cookies.html">Cookies</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container">
        <p>© 2026 AceArena · Titular: Angel Cebria Morales · <a href="mailto:hola@acearena.io">hola@acearena.io</a> · <a href="${p}aviso-legal.html">Aviso legal</a> · <a href="${p}privacidad.html">Privacidad</a> · <a href="${p}cookies.html">Cookies</a></p>
      </div>
    </div>
  </footer>
  <div class="sticky-cta" id="stickyCta">
    <div class="sticky-inner">
      <span>El tenis de la semana, en 3 minutos</span>
      <a href="${p}index.html#newsletter" class="btn btn-primary btn-sm">Quiero el briefing</a>
    </div>
  </div>
  <script src="${p}script.js"></script>`;

  return { header, footer };
}

function page({ title, description, canonical, depth, jsonLd = [], main, ogType = 'website', robots = 'index, follow' }) {
  const p = prefixFor(depth);
  const { header, footer } = chrome(depth);
  const ld = jsonLd.map((block) => `  <script type="application/ld+json">\n  ${safeJson(block)}\n  </script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="AceArena">
  <meta name="robots" content="${esc(robots)}">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="alternate" type="application/rss+xml" title="AceArena" href="/feed.xml">
  <meta property="og:type" content="${esc(ogType)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="AceArena">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${p}styles.css">
${ld}
</head>
<body>
${header}
${main}
${footer}
</body>
</html>
`;
}

function newsCards(articles, hrefFor) {
  if (articles.length === 0) {
    return '<p class="rankings-note">No hay noticias de los últimos 60 días.</p>';
  }
  return articles.map((article) => `        <article class="news-card">
          <div class="news-meta">Por el equipo de AceArena · ${esc(formatDay(article.date))} · Fuente: ${esc(article.sources[0]?.name || article.tournament)}</div>
          <h3><a href="${esc(hrefFor(article))}">${esc(article.title)}</a></h3>
          <p>${esc(article.summary)}</p>
        </article>`).join('\n');
}

function resultRows(matches) {
  if (matches.length === 0) {
    return '<p class="rankings-note">No hay resultados de los últimos 60 días.</p>';
  }
  return matches.map((match) => `        <article class="result-row">
          <time datetime="${esc(match.date)}">${esc(formatDay(match.date))}</time>
          <div>
            <strong>${esc(match.winner)}</strong> venció a ${esc(match.loser)}
            <span class="result-meta">${esc(match.tournament)} · ${esc(match.round)} · ${esc(match.score)}</span>
          </div>
          <a href="${esc(match.source)}" target="_blank" rel="noopener noreferrer">Fuente</a>
        </article>`).join('\n');
}

function homepageResults(matches) {
  return `<div class="results-home">
      <h3 class="results-home-title">Resultados recientes</h3>
      <div class="results-list">
${resultRows(matches)}
      </div>
      <p class="results-more"><a href="noticias/index.html">Archivo de noticias</a> · <a href="resultados.html">Todos los resultados</a></p>
    </div>`;
}

function articleJsonLd(article) {
  const url = `${SITE}/noticias/${article.slug}.html`;
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary,
    datePublished: article.date,
    dateModified: article.updated,
    inLanguage: 'es',
    articleBody: article.body.join('\n\n'),
    keywords: article.tags.join(', '),
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'AceArena', url: SITE },
    publisher: { '@type': 'Organization', name: 'AceArena', url: SITE },
    about: [
      ...article.players.map((name) => ({ '@type': 'Person', name })),
      { '@type': 'SportsEvent', name: article.tournament, sport: 'Tennis' },
    ],
    citation: article.sources.map((source) => ({
      '@type': 'CreativeWork',
      name: source.name,
      url: source.url,
    })),
  };
}

function articlePage(article) {
  const url = `${SITE}/noticias/${article.slug}.html`;
  const paragraphs = article.body.map((paragraph) => `        <p>${esc(paragraph)}</p>`).join('\n');
  const tags = article.tags.map((tag) => `          <li>${esc(tag)}</li>`).join('\n');
  const sources = article.sources.map((source) => `          <li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a> <span class="source-url">${esc(source.url)}</span></li>`).join('\n');
  const main = `  <main class="section page-section">
    <article class="container article-wrap">
      <p class="news-meta">${esc(article.tournament)}</p>
      <h1>${esc(article.title)}</h1>
      <p class="article-byline">Por el equipo de AceArena</p>
      <p class="article-dates">Publicado el <time datetime="${esc(article.date)}">${esc(formatDay(article.date))}</time>. Actualizado el <time datetime="${esc(article.updated)}">${esc(formatDay(article.updated))}</time>.</p>
      <p class="article-kicker">${esc(article.players.join(' · '))}</p>
      <p class="article-summary">${esc(article.summary)}</p>
      <div class="article-body">
${paragraphs}
      </div>
      <ul class="tag-list">
${tags}
      </ul>
      <section class="sources">
        <h2>Fuentes</h2>
        <ol>
${sources}
        </ol>
      </section>
      <p class="results-more"><a href="index.html">Todas las noticias</a> · <a href="../resultados.html">Resultados</a></p>
    </article>
  </main>`;
  return page({
    title: `${article.title} | AceArena`,
    description: article.summary,
    canonical: url,
    depth: 1,
    ogType: 'article',
    jsonLd: [
      articleJsonLd(article),
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${SITE}/noticias/` },
          { '@type': 'ListItem', position: 3, name: article.title, item: url },
        ],
      },
    ],
    main,
  });
}

function newsIndex(articles) {
  const url = `${SITE}/noticias/`;
  const main = `  <main class="section page-section">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Archivo</span>
        <h1>Lo que tienes que saber</h1>
        <p>Lo más importante del circuito, con fecha, firma y fuente. La portada muestra las piezas de los últimos 60 días.</p>
      </div>
      <div class="news-grid">
${newsCards(articles, (article) => `${article.slug}.html`)}
      </div>
      <p class="results-more"><a href="../resultados.html">Resultados</a> · <a href="/data/news.json">Datos JSON</a></p>
    </div>
  </main>`;
  return page({
    title: 'Noticias de tenis | AceArena',
    description: 'Archivo de noticias de tenis de AceArena, con fecha, fuentes y enlace a cada pieza.',
    canonical: url,
    depth: 1,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Noticias de tenis',
      url,
      inLanguage: 'es',
      isPartOf: { '@type': 'WebSite', name: 'AceArena', url: SITE },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: articles.map((article, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${SITE}/noticias/${article.slug}.html`,
          name: article.title,
        })),
      },
    }],
    main,
  });
}

function competitor(name) {
  return { '@type': name.includes(' / ') ? 'SportsTeam' : 'Person', name };
}

function resultsPage(matches, updated) {
  const url = `${SITE}/resultados.html`;
  const rows = matches.map((match) => `            <tr>
              <td><time datetime="${esc(match.date)}">${esc(formatDay(match.date))}</time></td>
              <td>${esc(match.tournament)}</td>
              <td>${esc(match.round)}</td>
              <td>${esc(match.winner)}</td>
              <td>${esc(match.loser)}</td>
              <td>${esc(match.score)}</td>
              <td><a href="${esc(match.source)}" target="_blank" rel="noopener noreferrer">Fuente</a></td>
            </tr>`).join('\n');
  const empty = matches.length === 0
    ? '<p class="rankings-note">No hay resultados en el fichero.</p>'
    : '';
  const main = `  <main class="section page-section">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Resultados</span>
        <h1>Resultados recientes</h1>
        <p>Marcadores con torneo, ronda, fecha y fuente. Actualizado el ${esc(formatStamp(updated))}.</p>
      </div>
      ${empty}
      <div class="results-table-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Torneo</th>
              <th>Ronda</th>
              <th>Ganador</th>
              <th>Perdedor</th>
              <th>Marcador</th>
              <th>Fuente</th>
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="results-more"><a href="noticias/index.html">Noticias</a> · <a href="/data/results.json">Datos JSON</a></p>
    </div>
  </main>`;
  return page({
    title: 'Resultados de tenis | AceArena',
    description: 'Resultados recientes de tenis con torneo, ronda, marcador y enlace a la fuente.',
    canonical: url,
    depth: 0,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Resultados recientes de tenis',
      url,
      numberOfItems: matches.length,
      itemListElement: matches.map((match, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'SportsEvent',
          name: `${match.tournament} · ${match.round}: ${match.winner} vs ${match.loser}`,
          startDate: match.date,
          sport: 'Tennis',
          url: match.source,
          competitor: [competitor(match.winner), competitor(match.loser)],
          winner: competitor(match.winner),
        },
      })),
    }],
    main,
  });
}

function legalPage({ file, title, description, blocks }) {
  const body = blocks.map((block) => {
    if (typeof block === 'string') return `        <p>${esc(block)}</p>`;
    const links = block.links.map((link) => `<a href="${esc(link.href)}">${esc(link.label)}</a>`).join(' · ');
    return `        <p>${links}</p>`;
  }).join('\n');
  const main = `  <main class="section page-section">
    <article class="container article-wrap">
      <p class="news-meta">AceArena</p>
      <h1>${esc(title)}</h1>
      <div class="article-body">
${body}
      </div>
    </article>
  </main>`;
  return page({
    title: `${title} | AceArena`,
    description,
    canonical: `${SITE}/${file}`,
    depth: 0,
    main,
  });
}

function sitemap(urls) {
  const body = urls.map((entry) => `  <url>
    <loc>${xml(entry.loc)}</loc>
    <lastmod>${xml(entry.lastmod)}</lastmod>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function rss(articles) {
  const newest = maxDay(articles.map((article) => article.updated));
  const items = articles.map((article) => {
    const link = `${SITE}/noticias/${article.slug}.html`;
    return `    <item>
      <title>${xml(article.title)}</title>
      <link>${xml(link)}</link>
      <guid isPermaLink="true">${xml(link)}</guid>
      <pubDate>${xml(new Date(`${article.date}T00:00:00Z`).toUTCString())}</pubDate>
      <description>${xml(article.summary)}</description>
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AceArena — Noticias de tenis</title>
    <link>${SITE}/noticias/</link>
    <description>Noticias de tenis publicadas por AceArena, con fuente en cada pieza.</description>
    <language>es</language>
    <lastBuildDate>${xml(new Date(`${newest}T00:00:00Z`).toUTCString())}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function editionLabel(iso, today) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const long = `${WEEKDAYS[date.getUTCDay()]}, ${day} de ${MONTHS_LONG[month - 1]} de ${year}`;
  const tag = iso.slice(0, 10) === today ? 'Edición de hoy' : 'Edición del día';
  return `${long} · ${tag}`;
}

function llmsTxt(articles, resultsUpdated) {
  const lines = articles.slice(0, LLMS_LATEST).map((article) => {
    const title = article.title.replace(/[\[\]]/g, '');
    const summary = article.summary.replace(/\s+/g, ' ').trim();
    return `- [${title}](${SITE}/noticias/${article.slug}.html): ${summary}`;
  });
  return `# AceArena

> Medio digital en español sobre tenis profesional (ATP y WTA). Cada noticia lleva fecha, autor y fuente; los rankings indican la fecha oficial. ${SITE}

AceArena no publica todavía cifras de audiencia.

## Noticias

${lines.join('\n')}

## Resultados

- [Resultados recientes](${SITE}/resultados.html): marcadores con torneo, ronda, fecha y fuente. Actualizado el ${formatStamp(resultsUpdated)}.
- Datos de noticias: ${SITE}/data/news.json
- Datos de resultados: ${SITE}/data/results.json

## El sitio

- [Portada](${SITE}/): lo último del circuito, rankings ATP y WTA con fecha y guía de Grand Slams.
- [Agencias](${SITE}/agencias.html): patrocinio con precios públicos. Bronze desde 4.500 €/trimestre, Silver desde 12.000 €/trimestre, Gold desde 28.000 €/trimestre, Platinum a medida.
`;
}

function maxDay(values) {
  return values.filter(Boolean).sort().at(-1) ?? '2026-01-01';
}

function build() {
  const news = readJson('news.json');
  const resultsDoc = readJson('results.json');
  const errors = validatePayload(news, resultsDoc);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const articles = byDateDesc(news, (article) => article.date);
  const matches = byDateDesc(resultsDoc.results, (match) => match.date);
  const homeArticles = articles.filter((article) => onHomepage(article.date, today));
  const homeMatches = matches.filter((match) => onHomepage(match.date, today));
  const contentDay = maxDay([
    ...articles.map((article) => article.updated),
    resultsDoc.updated.slice(0, 10),
  ]);

  rmSync(publicDir, { recursive: true, force: true });
  mkdirSync(publicDir, { recursive: true });

  for (const file of ['styles.css', 'script.js', 'agencias.html', 'media-kit-acearena.pdf']) {
    copyFileSync(join(root, file), join(publicDir, file));
  }

  let home = readFileSync(join(root, 'index.html'), 'utf8');
  home = fillRegion(home, 'EDITION', editionLabel(contentDay, today));
  home = fillRegion(home, 'NEWS', newsCards(homeArticles, (article) => `noticias/${article.slug}.html`));
  home = fillRegion(home, 'RESULTS', homepageResults(homeMatches));
  writeHtml('index.html', home);

  writeHtml('noticias/index.html', newsIndex(articles));
  for (const article of articles) {
    writeHtml(`noticias/${article.slug}.html`, articlePage(article));
  }
  writeHtml('resultados.html', resultsPage(matches, resultsDoc.updated));

  const analyticsNote = 'AceArena utiliza Cloudflare Web Analytics para medir las visitas de forma agregada. Esta herramienta no usa cookies ni almacena datos personales.';
  const ownerName = 'Angel Cebria Morales';
  const ownerNif = '54140612S';
  const ownerAddress = 'C/ Victoria Kent, 16 A, 12590 Almenara (Castellón), España';
  const ownerEmail = 'hola@acearena.io';
  const legalLinks = {
    links: [
      { href: 'aviso-legal.html', label: 'Aviso legal' },
      { href: 'privacidad.html', label: 'Privacidad' },
      { href: 'cookies.html', label: 'Cookies' },
    ],
  };
  writeHtml('aviso-legal.html', legalPage({
    file: 'aviso-legal.html',
    title: 'Aviso legal',
    description: 'Aviso legal de AceArena (acearena.io): titular, condiciones de uso y propiedad intelectual.',
    blocks: [
      'En cumplimiento de la Ley 34/2002 (LSSI), estos son los datos del titular de acearena.io:',
      `Titular: ${ownerName}.`,
      `NIF: ${ownerNif}.`,
      `Domicilio: ${ownerAddress}.`,
      `Contacto: ${ownerEmail}.`,
      'AceArena es un medio digital de tenis en español. Las noticias y los resultados se publican con la fuente de cada dato. Los enlaces externos llevan a sitios de terceros, con sus propias condiciones.',
      'Los marcadores en vivo proceden de SportScore y los rankings de las fuentes oficiales indicadas en cada tabla. Hacemos lo posible por mantenerlos exactos; ante cualquier discrepancia prevalece la fuente oficial.',
      'El diseño, el código y los textos propios de AceArena pertenecen a su titular. Las marcas de jugadores, torneos y anunciantes mencionadas pertenecen a sus dueños.',
      legalLinks,
    ],
  }));
  writeHtml('privacidad.html', legalPage({
    file: 'privacidad.html',
    title: 'Privacidad',
    description: 'Cómo trata AceArena tus datos en la newsletter y los formularios de contacto, y cómo ejercer tus derechos.',
    blocks: [
      `Responsable del tratamiento: ${ownerName}.`,
      `NIF: ${ownerNif}.`,
      `Domicilio: ${ownerAddress}.`,
      `Contacto: ${ownerEmail}.`,
      analyticsNote,
      'El briefing y el formulario de agencias se envían con Netlify Forms. Usamos el email y el mensaje para responderte o para enviarte el briefing. Puedes pedir la baja cuando quieras escribiendo a hola@acearena.io.',
      'AceArena no vende datos personales ni los cede para publicidad. Para acceder, rectificar, suprimir, oponerte o limitar un tratamiento, o para pedir la portabilidad, escribe a hola@acearena.io.',
      legalLinks,
    ],
  }));
  writeHtml('cookies.html', legalPage({
    file: 'cookies.html',
    title: 'Cookies',
    description: 'AceArena no usa cookies publicitarias. Medimos las visitas con Cloudflare Web Analytics, sin cookies.',
    blocks: [
      `Responsable: ${ownerName}. NIF: ${ownerNif}. Domicilio: ${ownerAddress}. Contacto: ${ownerEmail}.`,
      'AceArena no usa cookies publicitarias. Medimos las visitas con Cloudflare Web Analytics, sin cookies.',
      analyticsNote,
      'No hace falta aceptar un banner para esa medición: las visitas se cuentan de forma agregada.',
      'Si más adelante una herramienta del sitio usara cookies, esta página lo dirá antes de activarla.',
      legalLinks,
    ],
  }));
  writeHtml('404.html', page({
    title: 'Bola fuera | AceArena',
    description: 'Esta página no existe o ha cambiado de sitio.',
    canonical: `${SITE}/404.html`,
    depth: 0,
    robots: 'noindex, follow',
    main: `  <main class="section page-section">
    <article class="container article-wrap">
      <p class="news-meta">404</p>
      <h1>Bola fuera</h1>
      <p>Esta página no existe o ha cambiado de sitio. Pero el partido sigue: vuelve a la portada para ver lo último del circuito.</p>
      <p class="hero-cta">
        <a class="btn btn-primary" href="index.html">Ir a la portada</a>
        <a class="btn btn-outline" href="noticias/index.html">Últimas noticias</a>
        <a class="btn btn-outline" href="index.html#rankings">Rankings</a>
      </p>
    </article>
  </main>`,
  }));
  writeHtml('gracias.html', page({
    title: '¡Recibido! | AceArena',
    description: 'Mensaje recibido. AceArena te responde en menos de 48 horas laborables.',
    canonical: `${SITE}/gracias.html`,
    depth: 0,
    robots: 'noindex, follow',
    main: `  <main class="section page-section">
    <article class="container article-wrap">
      <p class="news-meta">AceArena</p>
      <h1 id="thanksTitle">¡Gracias! Lo tenemos.</h1>
      <p id="thanksCopy">Te respondemos en menos de 48 horas laborables. Si es urgente, escríbenos a sponsors@acearena.io (patrocinio) o hola@acearena.io (todo lo demás).</p>
      <p class="hero-cta">
        <a class="btn btn-primary" href="index.html#noticias">Ver lo último del circuito</a>
        <a class="btn btn-outline" href="index.html#newsletter">Apúntate al briefing</a>
      </p>
    </article>
  </main>`,
  }));

  const staticBeaconFiles = ['agencias.html'];
  for (const file of staticBeaconFiles) {
    writeHtml(file, readFileSync(join(publicDir, file), 'utf8'));
  }

  mkdirSync(join(publicDir, 'data'), { recursive: true });
  copyFileSync(join(root, 'data', 'news.json'), join(publicDir, 'data', 'news.json'));
  copyFileSync(join(root, 'data', 'results.json'), join(publicDir, 'data', 'results.json'));

  const urls = [
    { loc: `${SITE}/`, lastmod: contentDay },
    { loc: `${SITE}/noticias/`, lastmod: contentDay },
    { loc: `${SITE}/resultados.html`, lastmod: resultsDoc.updated.slice(0, 10) },
    { loc: `${SITE}/agencias.html`, lastmod: contentDay },
    { loc: `${SITE}/aviso-legal.html`, lastmod: contentDay },
    { loc: `${SITE}/privacidad.html`, lastmod: contentDay },
    { loc: `${SITE}/cookies.html`, lastmod: contentDay },
    ...articles.map((article) => ({
      loc: `${SITE}/noticias/${article.slug}.html`,
      lastmod: article.updated,
    })),
  ];
  writeText('sitemap.xml', sitemap(urls));
  writeText('feed.xml', rss(articles));
  writeText('llms.txt', llmsTxt(articles, resultsDoc.updated));
  writeText('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`Build OK: ${articles.length} artículos (${homeArticles.length} en portada), ${matches.length} resultados (${homeMatches.length} en portada)`);
}

build();
