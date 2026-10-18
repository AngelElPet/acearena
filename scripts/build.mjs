import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSocialCards } from './cards.mjs';
import { evergreenEntries } from './evergreen.mjs';
import { writeArticleHeaders } from './headers.mjs';
import { validateEvergreen, validatePayload, validateRace, validateWeek } from './validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const SITE = 'https://acearena.io';
const HOMEPAGE_MAX_AGE_DAYS = 60;
const LLMS_LATEST = 20;
const BEACON = `<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "d21dd5ee912c4c80b8c8a4232ec883fc"}'></script>`;
const BYLINE = 'Redacción AceArena';
const CRITICAL_CSS = `<style>
body{margin:0;background:#07090d;color:#f4f7fb;font-family:Inter,system-ui,sans-serif}
.container{width:min(1120px,calc(100% - 2rem));margin-inline:auto}
.hero-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(16rem,.8fr);gap:1.5rem;align-items:start}
.hero h1{margin:0 0 1rem;font-size:clamp(2.4rem,6vw,4.4rem);line-height:1.05;max-width:18ch}
.hero-actions{display:flex;flex-wrap:wrap;gap:.75rem}
.fact-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}
.hero:has(.hero-banner){padding-top:0}
.hero-banner{margin:0 0 1.4rem}
.hero-banner img{display:block;width:100%;height:clamp(11rem,28vw,18rem);object-fit:cover;object-position:center}
.page-section>.hero-banner{margin:-2rem 0 1.4rem}
@media (max-width:800px){
  .hero-layout,.fact-row,.diagram-grid,.mock-grid,.result-row{grid-template-columns:1fr}
}
</style>`;
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
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <header class="header scrolled" id="header">
    <div class="header-inner">
      <a class="logo" href="${p}index.html">
        <img src="${p}assets/logo.svg" alt="AceArena" width="162" height="46">
      </a>
      <button class="menu-toggle" id="menuToggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="Abrir menú">
        <span></span><span></span><span></span>
      </button>
      <nav class="nav" id="nav" aria-label="Principal">
        <a href="${p}index.html#hoy">Hoy</a>
        <a href="${p}noticias/index.html">Noticias</a>
        <a href="${p}rankings.html">Rankings</a>
        <a href="${p}calendario-2027.html">Calendario</a>
        <a href="${p}aprende/index.html">Aprende tenis</a>
        <a href="${p}agencias.html" class="nav-quiet">Anúnciate</a>
      </nav>
    </div>
  </header>`;

  const footer = `
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <a class="logo" href="${p}index.html"><img src="${p}assets/logo.svg" alt="AceArena" width="140" height="40" loading="lazy"></a>
        <p>AceArena: tenis en español, con datos y sin ruido.</p>
      </div>
      <div class="footer-links">
        <div>
          <h2>El circuito</h2>
          <a href="${p}index.html#hoy">Hoy</a>
          <a href="${p}semana.html">Esta semana</a>
          <a href="${p}noticias/index.html">Noticias</a>
          <a href="${p}rankings.html">Rankings</a>
          <a href="${p}jugadores/index.html">Jugadores en español</a>
          <a href="${p}race.html">Race a Turín</a>
          <a href="${p}resultados.html">Resultados</a>
          <a href="${p}calendario-2027.html">Calendario</a>
          <a href="${p}aprende/index.html">Aprende tenis</a>
        </div>
        <div>
          <h2>AceArena</h2>
          <a href="${p}sobre.html">Sobre AceArena</a>
          <a href="${p}index.html#newsletter">Resumen del lunes</a>
          <a href="${p}agencias.html">Anúnciate</a>
          <a href="mailto:hola@acearena.io">Contacto</a>
          <a href="https://x.com/AceArenaes" rel="noopener noreferrer">X</a>
          <a href="https://www.instagram.com/acearenaes/" rel="noopener noreferrer">Instagram</a>
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
      <p>© 2026 AceArena · <a href="mailto:hola@acearena.io">hola@acearena.io</a> · <a href="${p}aviso-legal.html">Aviso legal</a> · <a href="${p}privacidad.html">Privacidad</a> · <a href="${p}cookies.html">Cookies</a></p>
    </div>
  </footer>
  <div class="sticky-cta" id="stickyCta">
    <p>El resumen del lunes, en 3 minutos</p>
    <a class="btn btn-primary btn-sm" href="${p}index.html#newsletter">Quiero el resumen</a>
  </div>
  <script src="${p}script.js" defer></script>`;

  return { header, footer };
}

function page({ title, description, canonical, depth, jsonLd = [], main, ogType = 'website', robots = 'index, follow', ogImage = `${SITE}/assets/og-image.png` }) {
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
  <meta name="theme-color" content="#070B16">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="icon" href="${p}favicon.svg" type="image/svg+xml">
  <link rel="icon" href="${p}assets/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="${p}assets/apple-touch-icon.png">
  <link rel="manifest" href="${p}site.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="AceArena" href="/feed.xml">
  <meta property="og:type" content="${esc(ogType)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="AceArena">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  ${CRITICAL_CSS}
  <link rel="preconnect" href="https://cloudflareinsights.com">
  <link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin>
  <link rel="stylesheet" href="${p}styles.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="${p}styles.css"></noscript>
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

function tourOf(article) {
  const tags = Array.isArray(article.tags) ? article.tags : [];
  if (tags.includes('WTA')) return 'WTA';
  if (tags.includes('ATP')) return 'ATP';
  return '';
}

function tourBadge(article) {
  const tour = tourOf(article);
  if (!tour) return '';
  return `<span class="tour-badge">${tour}</span> `;
}

function articleTopic(article) {
  const tour = tourOf(article);
  if (article.tournament && article.tournament !== tour) return esc(article.tournament);
  const tags = Array.isArray(article.tags) ? article.tags : [];
  if (tags.includes('Race a Turín')) return 'Race a Turín';
  return '';
}

function filedIso(article, field) {
  const day = String(article[field] || '').slice(0, 10);
  const late = article.slug === 'jodar-noveno-en-la-race-a-turin-tras-shanghai'
    || article.slug === 'final-de-wuhan-chwalinska-y-kartal';
  const time = late ? '19:06:17' : '16:22:52';
  return `${day}T${time}+02:00`;
}

function newsCards(articles, hrefFor, assetPrefix = '') {
  if (articles.length === 0) {
    return '<p class="rankings-note">No hay noticias de los últimos 60 días.</p>';
  }
  return articles.map((article) => `        <article class="news-card">
          <a class="news-card-media" href="${esc(hrefFor(article))}" tabindex="-1" aria-hidden="true"><img src="${assetPrefix}art/${esc(article.slug)}-800.webp" srcset="${assetPrefix}art/${esc(article.slug)}-800.webp 800w, ${assetPrefix}art/${esc(article.slug)}.webp 1200w" sizes="(max-width: 700px) 100vw, 360px" alt="" width="1200" height="630" loading="lazy" decoding="async"></a>
          <div class="news-meta">${tourBadge(article)}${BYLINE} · ${esc(formatDay(article.date))} · Fuente: ${esc(article.sources[0]?.name || article.tournament)}</div>
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

function newsletterBlock(depth) {
  const p = prefixFor(depth);
  return `  <section class="section section-alt" id="newsletter" aria-labelledby="news-form-title">
    <div class="container newsletter">
      <div>
        <p class="kicker">Cada lunes</p>
        <h2 id="news-form-title">El resumen del lunes: lo importante de la semana en el tenis, en 3 minutos</h2>
        <p class="section-intro">Resultados, rankings y la historia de la semana, en tu correo. Para darte de baja, escribe a hola@acearena.io.</p>
      </div>
      <form name="newsletter" method="POST" action="/gracias.html" data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="newsletter">
        <p class="honeypot" aria-hidden="true"><label>No rellenes este campo <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <div class="form-fields">
          <div class="form-group">
            <label for="newsletter-email">Email</label>
            <input id="newsletter-email" name="email" type="email" autocomplete="email" required>
          </div>
          <label class="consent">
            <input type="checkbox" name="privacidad" value="acepto" required>
            <span>He leído la <a href="${p}privacidad.html">política de privacidad</a> y acepto que AceArena use este email para enviarme el resumen del lunes.</span>
          </label>
          <button class="btn btn-primary" type="submit">Quiero el resumen</button>
        </div>
        <div class="form-thanks" hidden tabindex="-1" role="status">
          <h3>¡Dentro!</h3>
          <p>Te escribiremos con el resumen del lunes.</p>
          <p class="form-thanks-fallback">¿No te ha llegado nada? Escríbenos a <a href="mailto:hola@acearena.io">hola@acearena.io</a>.</p>
        </div>
      </form>
    </div>
  </section>`;
}

function articleJsonLd(article) {
  const url = `${SITE}/noticias/${article.slug}.html`;
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary,
    datePublished: filedIso(article, 'date'),
    dateModified: filedIso(article, 'updated'),
    inLanguage: 'es',
    articleBody: article.body.join('\n\n'),
    keywords: article.tags.join(', '),
    url,
    mainEntityOfPage: url,
    image: {
      '@type': 'ImageObject',
      url: `${SITE}/og/${article.slug}.png`,
      width: 1200,
      height: 630,
    },
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

function articleLinks(article) {
  const links = [];
  if (article.slug === 'jodar-noveno-en-la-race-a-turin-tras-shanghai' || article.slug === 'davidovich-fokina-gana-el-masters-de-shanghai') {
    links.push('<a href="../race.html">Race a Turín</a>');
    links.push('<a href="../jugadores/rafael-jodar.html">Rafael Jódar</a>');
    links.push('<a href="../jugadores/alejandro-davidovich-fokina.html">Alejandro Davidovich Fokina</a>');
  }
  if (article.slug === 'davidovich-fokina-gana-el-masters-de-shanghai') {
    links.push('<a href="jodar-noveno-en-la-race-a-turin-tras-shanghai.html">Jódar en la Race</a>');
  }
  if (article.slug === 'jodar-noveno-en-la-race-a-turin-tras-shanghai') {
    links.push('<a href="davidovich-fokina-gana-el-masters-de-shanghai.html">La final de Shanghái</a>');
  }
  return links.length ? ` · ${links.join(' · ')}` : '';
}

const LICENSED_PHOTOS = {
  'pista-tierra': {
    file: 'pista-tierra',
    width: 1200,
    height: 640,
    small: 800,
    alt: 'Pista de tierra vacía, vista desde el fondo.',
    author: 'KeepActive Australia',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Empty_clay_tennis_court_in_Melbourne_Australia_looking_down_the_middle.jpg',
  },
  'pista-silla': {
    file: 'pista-silla',
    width: 1100,
    height: 734,
    small: 800,
    alt: 'Pista de tenis vacía, con la silla del juez detrás de la red.',
    author: 'Shixart1985',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:An_empty_tennis_court_showcases_an_umpire_chair_positioned_behind_the_net.jpg',
  },
  raquetas: {
    file: 'raquetas',
    width: 960,
    height: 640,
    small: 640,
    alt: 'Raquetas y pelotas sobre una pista de tierra.',
    author: 'KeepActive Australia',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tennis_Racquets_and_Balls_on_a_Clay_Court.jpg',
  },
  pelota: {
    file: 'pelota',
    width: 1200,
    height: 800,
    small: 800,
    alt: 'Pelota de tenis amarilla sobre fondo neutro.',
    author: 'Christian VisualBeo Horvat',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tennisball.jpg',
  },
};

const ARTICLE_PHOTO = {
  'jodar-noveno-en-la-race-a-turin-tras-shanghai': 'pelota',
  'zverev-asegura-el-numero-uno-de-final-de-ano': 'pista-silla',
  'rybakina-encabeza-el-ranking-wta': 'raquetas',
  'sinner-cierra-la-temporada-por-lesion-de-rodilla': 'pista-tierra',
};

function photoFigure(id, prefix, { priority = false, sizes = '(max-width: 800px) 100vw, 720px', className = 'photo-figure' } = {}) {
  const photo = LICENSED_PHOTOS[id];
  const loading = priority ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"';
  return `<figure class="${className}">
          <img src="${prefix}photos/${photo.file}.webp" srcset="${prefix}photos/${photo.file}-800.webp ${photo.small}w, ${prefix}photos/${photo.file}.webp ${photo.width}w" sizes="${sizes}" alt="${esc(photo.alt)}" width="${photo.width}" height="${photo.height}"${loading}>
          <figcaption>Foto: ${esc(photo.author)}, <a href="${esc(photo.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(photo.license)}</a>, vía <a href="${esc(photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>.</figcaption>
        </figure>`;
}

function articleHero(article) {
  const photoId = !article.score ? ARTICLE_PHOTO[article.slug] : '';
  if (photoId) return photoFigure(photoId, '../', { priority: true, sizes: '(max-width: 800px) 100vw, 736px', className: 'photo-figure article-photo' });
  const alt = article.score ? `Marcador de ${article.tournament}: ${article.score}` : (article.tournament || 'AceArena');
  return `<img class="article-hero" src="../art/${esc(article.slug)}.webp" srcset="../art/${esc(article.slug)}-800.webp 800w, ../art/${esc(article.slug)}.webp 1200w" sizes="(max-width: 800px) 100vw, 736px" alt="${esc(alt)}" width="1200" height="630" fetchpriority="high">`;
}

function articlePage(article) {
  const url = `${SITE}/noticias/${article.slug}.html`;
  const paragraphs = article.body.map((paragraph) => `        <p>${esc(paragraph)}</p>`).join('\n');
  const tags = article.tags.map((tag) => `          <li>${esc(tag)}</li>`).join('\n');
  const sources = article.sources.map((source) => `          <li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a></li>`).join('\n');
  const briefItems = Array.isArray(article.brief)
    ? article.brief.map((item) => `          <li>${esc(item)}</li>`).join('\n')
    : '';
  const brief = briefItems ? `      <section class="brief">
        <h2>En 30 segundos</h2>
        <ul>
${briefItems}
        </ul>
      </section>
` : '';
  const main = `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      <p class="news-meta">${tourBadge(article)}${articleTopic(article)}</p>
      <h1>${esc(article.title)}</h1>
      ${articleHero(article)}
      <p class="article-byline">${BYLINE}</p>
      <p class="article-dates">Publicado el <time datetime="${esc(filedIso(article, 'date'))}">${esc(formatDay(article.date))}</time>. Actualizado el <time datetime="${esc(filedIso(article, 'updated'))}">${esc(formatDay(article.updated))}</time>.</p>
      <p class="article-kicker">${esc(article.players.join(' · '))}</p>
      <p class="article-summary">${esc(article.summary)}</p>
${brief}      <div class="article-body">
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
      <p class="results-more"><a href="index.html">Todas las noticias</a> · <a href="../resultados.html">Resultados</a>${articleLinks(article)}</p>
    </article>
${newsletterBlock(1)}
  </main>`;
  return page({
    title: `${article.title} | AceArena`,
    description: article.summary,
    canonical: url,
    depth: 1,
    ogType: 'article',
    ogImage: `${SITE}/og/${article.slug}.png`,
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
  const main = `  <main class="section page-section" id="contenido">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Archivo</span>
        <h1>Lo que tienes que saber</h1>
        <p>Lo más importante del circuito, con fecha, firma y fuente. La portada muestra las piezas de los últimos 60 días.</p>
      </div>
      <div class="news-grid">
${newsCards(articles, (article) => `${article.slug}.html`, '../')}
      </div>
      <p class="results-more"><a href="../resultados.html">Resultados</a> · <a href="/data/news.json">Datos JSON</a></p>
    </div>
${newsletterBlock(1)}
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
  const main = `  <main class="section page-section" id="contenido">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Resultados</span>
        <h1>Resultados recientes</h1>
        <p>Marcadores con torneo, ronda, fecha y fuente. Actualizado el ${esc(formatStamp(updated))}.</p>
      </div>
      ${empty}
      <div class="results-cards">
${matches.map((match) => `        <article class="result-card">
          <p class="news-meta"><time datetime="${esc(match.date)}">${esc(formatDay(match.date))}</time> · ${esc(match.tournament)} · ${esc(match.round)}</p>
          <p><strong>${esc(match.winner)}</strong></p>
          <p>${esc(match.loser)}</p>
          <p class="result-score">${esc(match.score)}</p>
          <p><a href="${esc(match.source)}" target="_blank" rel="noopener noreferrer">Fuente</a></p>
        </article>`).join('\n')}
      </div>
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
  const main = `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      <p class="news-meta">AceArena</p>
      <h1>${esc(title)}</h1>
      <div class="article-body">
${body}
      </div>
    </article>
  </main>`;
  const url = `${SITE}/${file}`;
  return page({
    title: `${title} | AceArena`,
    description,
    canonical: url,
    depth: 0,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url,
        inLanguage: 'es',
        isPartOf: { '@type': 'WebSite', name: 'AceArena', url: `${SITE}/` },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: title, item: url },
        ],
      },
    ],
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
      <pubDate>${xml(new Date(filedIso(article, 'date')).toUTCString())}</pubDate>
      <author>hola@acearena.io (${BYLINE})</author>
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
    <lastBuildDate>${xml(new Date(filedIso({ slug: '', date: newest, updated: newest }, 'updated')).toUTCString())}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function longDay(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS_LONG[month - 1]} de ${year}`;
}

function linkParts(parts) {
  return parts.map((part) => (
    part.href
      ? `<a href="${esc(part.href)}" target="_blank" rel="noopener noreferrer">${esc(part.text)}</a>`
      : esc(part.text)
  )).join('');
}

function sourceLinks(sources) {
  return sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>`).join(' · ');
}

const SURFACE_FILES = {
  hard: 'surface-hard.svg',
  clay: 'surface-clay.svg',
  grass: 'surface-grass.svg',
  indoor: 'surface-indoor.svg',
};

function surfaceIcon(surface, prefix) {
  const file = SURFACE_FILES[surface];
  if (!file) return '';
  return `<img class="surface-icon" src="${prefix}assets/diagrams/${file}" alt="" width="36" height="36">`;
}

function tournamentCard(event, prefix) {
  const entries = event.entries ? `\n          <p>${esc(event.entries)}</p>` : '';
  return `        <article class="card">
          <p class="kicker">${esc(event.tour)} · ${esc(event.level)}</p>
          <h3><a href="${esc(event.officialUrl)}" target="_blank" rel="noopener noreferrer">${esc(event.name)}</a></h3>
          <p class="news-meta surface-line">${surfaceIcon(event.surface, prefix)}${esc(event.dates)} · ${esc(event.place)} · ${esc(event.surfaceLabel)}</p>
          <p>${esc(event.detail)}</p>${entries}
          <p>Fuentes: ${sourceLinks(event.sources)}</p>
        </article>`;
}

function todayCard(today) {
  return `<div class="today-card">
          <p class="kicker">Hoy</p>
          <h2><a href="${esc(today.resultHref)}">${esc(today.resultTitle)}</a></h2>
          <p>${esc(today.resultText)}</p>
          <h3>${esc(today.nextTitle)}</h3>
          <p><a href="${esc(today.nextHref)}">${esc(today.nextText)}</a></p>
        </div>`;
}

function spotlightBlock(week, prefix) {
  if (!Array.isArray(week.spotlight) || week.spotlight.length === 0) return '';
  const items = week.spotlight.map((item) => `          <li><a href="${prefix}${esc(item.href)}">${esc(item.name)}</a>. ${esc(item.text)} <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.sourceName)}</a>.</li>`).join('\n');
  return `      <h2>Españoles y latinoamericanos esta semana</h2>
      <ul>
${items}
      </ul>`;
}

function weekHome(week) {
  const cards = week.tournaments.map((event) => tournamentCard(event, '')).join('\n');
  return `<p class="section-intro">${esc(week.hoursNote)}</p>
        <div class="card-grid">
${cards}
        </div>
${spotlightBlock(week, '')}
        <p class="results-more"><a href="semana.html">Toda la semana, con fuentes</a> · <a href="race.html">Race a Turín</a> · <a href="rankings.html">Rankings</a></p>`;
}

function weekPage(week) {
  const url = `${SITE}/semana.html`;
  const current = week.tournaments.map((event) => tournamentCard(event, '')).join('\n');
  const later = week.later.map((event) => tournamentCard(event, '')).join('\n');
  const events = [...week.tournaments, ...week.later];
  const main = `  <main class="section page-section" id="contenido">
    ${photoFigure('pelota', '', { priority: true, sizes: '100vw', className: 'photo-figure hero-banner' })}
    <div class="container">
      <p class="news-meta"><a href="index.html">Inicio</a> · Esta semana</p>
      <div class="section-header">
        <span class="section-tag">Calendario</span>
        <h1>Qué ver esta semana</h1>
        <p>${esc(week.hoursNote)} Actualizado el ${esc(longDay(week.updated))}.</p>
      </div>
      <div class="card-grid">
${current}
      </div>
${spotlightBlock(week, '')}
      <h2>Después</h2>
      <div class="card-grid">
${later}
      </div>
    </div>
  </main>`;
  return page({
    title: 'Qué ver esta semana | AceArena',
    description: `ATP y WTA del ${week.range}: sede, superficie y quién juega, con la ficha oficial de cada torneo.`,
    canonical: url,
    depth: 0,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Qué ver esta semana',
        url,
        inLanguage: 'es',
        dateModified: week.updated,
        isPartOf: { '@type': 'WebSite', name: 'AceArena', url: `${SITE}/` },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Torneos de la semana y la cita siguiente',
        numberOfItems: events.length,
        itemListElement: events.map((event, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: event.name,
          url: event.officialUrl,
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Qué ver esta semana', item: url },
        ],
      },
    ],
    main,
  });
}

const RACE_PAGES = {
  'Carlos Alcaraz': 'jugadores/carlos-alcaraz.html',
  'Rafael Jódar': 'jugadores/rafael-jodar.html',
};

function racePlayer(name) {
  const href = RACE_PAGES[name];
  if (!href) return esc(name);
  return `<a href="${esc(href)}">${esc(name)}</a>`;
}

function racePage(race) {
  const url = `${SITE}/race.html`;
  const rows = race.rows.map((row) => `            <tr>
              <td>${esc(row.position)}</td>
              <td>${racePlayer(row.player)}</td>
              <td>${esc(row.points)}</td>
            </tr>`).join('\n');
  const main = `  <main class="section page-section" id="contenido">
    <div class="container">
      <p class="news-meta"><a href="index.html">Inicio</a> · Race</p>
      <div class="section-header">
        <span class="section-tag">ATP</span>
        <h1>${esc(race.name)}</h1>
        <p>Top 10 consultado el ${esc(longDay(race.asOf))}. Fuente: <a href="${esc(race.source.url)}" target="_blank" rel="noopener noreferrer">${esc(race.source.name)}</a>.</p>
      </div>
      <p>${esc(race.context)}</p>
      <p><a href="noticias/jodar-noveno-en-la-race-a-turin-tras-shanghai.html">Jódar, noveno en la Race a Turín tras Shanghái</a>.</p>
      <p>Cómo se clasifica: los 8 primeros de la Race al final de la temporada juegan las Nitto ATP Finals de Turín. <a href="aprende/como-funciona-el-ranking-atp.html">Cómo funciona el ranking ATP</a>.</p>
      <div class="results-table-wrap">
        <table class="rank-table">
          <caption>${esc(race.name)} · ${esc(longDay(race.asOf))}</caption>
          <thead>
            <tr>
              <th scope="col">Puesto</th>
              <th scope="col">Jugador</th>
              <th scope="col">Puntos</th>
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="as-of">Contexto: ${sourceLinks(race.contextSources)}. El ranking de 52 semanas está en <a href="rankings.html">Rankings</a>. <a href="jugadores/index.html">Jugadores en español</a>.</p>
    </div>
  </main>`;
  return page({
    title: 'Race a Turín | AceArena',
    description: `Top 10 de la ${race.name} a ${longDay(race.asOf)}, con la fuente de la ATP.`,
    canonical: url,
    depth: 0,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: race.name,
        url,
        inLanguage: 'es',
        dateModified: race.updated,
        citation: race.source.url,
        isPartOf: { '@type': 'WebSite', name: 'AceArena', url: `${SITE}/` },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: race.name,
        numberOfItems: race.rows.length,
        itemListElement: race.rows.map((row) => ({
          '@type': 'ListItem',
          position: Number(row.position),
          name: `${row.player} · ${row.points}`,
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Race a Turín', item: url },
        ],
      },
    ],
    main,
  });
}

function aboutPage() {
  const url = `${SITE}/sobre.html`;
  const description = 'Quién hace AceArena, cómo se contrasta cada dato, cómo se corrige un error y cómo se señala el contenido patrocinado.';
  const main = `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      <p class="news-meta"><a href="index.html">Inicio</a> · Sobre AceArena</p>
      <h1>Sobre AceArena</h1>
      <p class="article-summary">Medio digital de tenis en español. Cada resultado lleva su fuente y cada ranking su fecha.</p>
      <h2>Quiénes somos</h2>
      <p>AceArena es un medio digital independiente de tenis en español, nacido en 2026. Cubrimos el circuito ATP y el WTA para quien sigue cada punto y para quien acaba de descubrir este deporte.</p>
      <h2>Quién está detrás</h2>
      <p>Lo fundó Angel Cebria Morales. El aviso legal publica el titular, el NIF y el domicilio.</p>
      <h2>Cómo trabajamos</h2>
      <p>Las noticias y las fichas salen de fuentes oficiales: <a href="https://www.atptour.com/" target="_blank" rel="noopener noreferrer">ATP</a>, <a href="https://www.wtatennis.com/" target="_blank" rel="noopener noreferrer">WTA</a> y las páginas de los torneos. Los marcadores en vivo de la portada llegan de <a href="https://sportscore.com/" target="_blank" rel="noopener noreferrer">SportScore</a>. Si una cifra no está en la fuente, no entra en la página.</p>
      <h2>Correcciones</h2>
      <p>Si ves un error, escribe a <a href="mailto:hola@acearena.io">hola@acearena.io</a>. Lo corregimos y dejamos la fecha de la corrección en la pieza.</p>
      <h2>Contenido patrocinado</h2>
      <p>El contenido de pago va señalado como tal. Los precios públicos están en <a href="agencias.html">Anúnciate</a>. No publicamos cifras de audiencia hasta cerrar el primer trimestre medido.</p>
      <p class="results-more"><a href="agencias.html">Patrocinio</a> · <a href="aviso-legal.html">Aviso legal</a> · <a href="mailto:hola@acearena.io">hola@acearena.io</a></p>
    </article>
  </main>`;
  return page({
    title: 'Sobre AceArena',
    description,
    canonical: url,
    depth: 0,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'Sobre AceArena',
        description,
        url,
        inLanguage: 'es',
        isPartOf: { '@type': 'WebSite', name: 'AceArena', url: `${SITE}/` },
        about: {
          '@type': 'Organization',
          name: 'AceArena',
          url: `${SITE}/`,
          email: 'hola@acearena.io',
          founder: { '@type': 'Person', name: 'Angel Cebria Morales' },
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Sobre AceArena', item: url },
        ],
      },
    ],
    main,
  });
}

function editionLabel(iso, today) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const long = `${WEEKDAYS[date.getUTCDay()]}, ${day} de ${MONTHS_LONG[month - 1]} de ${year}`;
  const tag = iso.slice(0, 10) === today ? 'Edición de hoy' : 'Edición del día';
  return `${long} · ${tag}`;
}

function llmsTxt(articles, resultsUpdated, playersDoc, guidesDoc, week, race, rankings) {
  const lines = articles.slice(0, LLMS_LATEST).map((article) => {
    const title = article.title.replace(/[\[\]]/g, '');
    const summary = article.summary.replace(/\s+/g, ' ').trim();
    return `- [${title}](${SITE}/noticias/${article.slug}.html): ${summary}`;
  });
  const playerLines = playersDoc.players.map((player) => `- [${player.name}](${SITE}/jugadores/${player.slug}.html): ${player.tour}, número ${player.ranking.position} actualizado a ${player.ranking.asOf}.`);
  const guideLines = guidesDoc.guides.map((guide) => `- [${guide.title}](${SITE}/aprende/${guide.slug}.html): ${guide.description}`);
  return `# AceArena

> Medio digital en español sobre tenis profesional (ATP y WTA). Cada noticia lleva fecha, autor y fuente; los rankings indican la fecha oficial. ${SITE}
> Ficha larga: ${SITE}/llms-full.txt

## Noticias

${lines.join('\n')}

## Resultados

- [Resultados recientes](${SITE}/resultados.html): marcadores con torneo, ronda, fecha y fuente. Actualizado el ${formatStamp(resultsUpdated)}.
- Datos de noticias: ${SITE}/data/news.json
- Datos de resultados: ${SITE}/data/results.json

## Esta semana

- [Qué ver esta semana](${SITE}/semana.html): ${week.range}. ${week.hoursNote}
- Datos de la semana: ${SITE}/data/week.json

## Race a Turín

- [${race.name}](${SITE}/race.html): top 10 consultado el ${race.asOf}. ${race.source.url}
- Datos de la Race: ${SITE}/data/race.json
- [${rankings.wtaRace.name}](${SITE}/rankings.html): top 10 a ${rankings.wtaRace.asOf}. ${rankings.wtaRace.source.url}

## Rankings

- [Rankings ATP y WTA](${SITE}/rankings.html): top 20 de cada circuito a ${rankings.asOf}, más la Race de la WTA.
- Datos de rankings: ${SITE}/data/rankings.json

## Jugadores

- [Jugadores en español](${SITE}/jugadores/): fichas de España y de América Latina, con ranking fechado y enlace a la ficha oficial.
${playerLines.join('\n')}

## Calendario

- [Calendario 2027](${SITE}/calendario-2027.html): Grand Slams, finales y torneos 1000 con fecha publicada. Davis Cup Final 8: Bolonia, 24–29 de noviembre de 2026. Australian Open 2027: Melbourne Park, 11–31 de enero; cuadro principal, 17–31 de enero.

## Aprende tenis

- [Guías](${SITE}/aprende/): rankings ATP y WTA, y reglas básicas del marcador.
${guideLines.join('\n')}

## El sitio

- [Portada](${SITE}/): lo último del circuito, rankings ATP y WTA con fecha y guía de Grand Slams.
- [Sobre AceArena](${SITE}/sobre.html): quiénes somos, cómo trabajamos, correcciones y contenido patrocinado.
- [Agencias](${SITE}/agencias.html): patrocinio con precios públicos. Bronze desde 4.500 €/trimestre, Silver desde 12.000 €/trimestre, Gold desde 28.000 €/trimestre, Platinum a medida.
- [Créditos de imagen](${SITE}/creditos.html): fotos con licencia y gráficos propios.
- [Sobre AceArena](${SITE}/sobre.html): quiénes somos, cómo trabajamos y cómo corregimos.
`;
}

function rankRows(rows, links) {
  return rows.map((row) => {
    const href = links[row.player];
    const name = href ? `<a href="${esc(href)}">${esc(row.player)}</a>` : esc(row.player);
    return `            <tr>
              <td>${esc(row.position)}</td>
              <td>${name}</td>
              <td>${esc(row.points)}</td>
            </tr>`;
  }).join('\n');
}

function rankTable(caption, rows, links) {
  return `      <div class="results-table-wrap">
        <table class="rank-table">
          <caption>${esc(caption)}</caption>
          <thead>
            <tr>
              <th scope="col">Puesto</th>
              <th scope="col">Jugador</th>
              <th scope="col">Puntos</th>
            </tr>
          </thead>
          <tbody>
${rankRows(rows, links)}
          </tbody>
        </table>
      </div>`;
}

function rankingsPage(rankings, playersDoc) {
  const url = `${SITE}/rankings.html`;
  const links = {};
  for (const player of playersDoc.players) links[player.name] = `jugadores/${player.slug}.html`;
  const main = `  <main class="section page-section" id="contenido">
    <div class="container">
      <p class="news-meta"><a href="index.html">Inicio</a> · Rankings</p>
      <div class="section-header">
        <span class="section-tag">Rankings</span>
        <h1>Rankings ATP y WTA</h1>
        <p>Top 20 del ranking oficial a ${esc(longDay(rankings.asOf))}. <a href="race.html">Race a Turín</a> · <a href="jugadores/index.html">Jugadores en español</a>.</p>
      </div>
      <h2>${esc(rankings.atp.name)}</h2>
      <p>Fuente: <a href="${esc(rankings.atp.source.url)}" target="_blank" rel="noopener noreferrer">${esc(rankings.atp.source.name)}</a>.</p>
${rankTable(`ATP · top 20 · ${longDay(rankings.asOf)}`, rankings.atp.rows, links)}
      <h2>${esc(rankings.wta.name)}</h2>
      <p>Fuente: <a href="${esc(rankings.wta.source.url)}" target="_blank" rel="noopener noreferrer">${esc(rankings.wta.source.name)}</a>.</p>
${rankTable(`WTA · top 20 · ${longDay(rankings.asOf)}`, rankings.wta.rows, links)}
      <h2>${esc(rankings.wtaRace.name)}</h2>
      <p>Top 10 a ${esc(longDay(rankings.wtaRace.asOf))}. Fuente: <a href="${esc(rankings.wtaRace.source.url)}" target="_blank" rel="noopener noreferrer">${esc(rankings.wtaRace.source.name)}</a>.</p>
${rankTable(`${rankings.wtaRace.name} · ${longDay(rankings.wtaRace.asOf)}`, rankings.wtaRace.rows, links)}
    </div>
  </main>`;
  return page({
    title: 'Rankings ATP y WTA | AceArena',
    description: `Top 20 ATP y WTA a ${longDay(rankings.asOf)}, y top 10 de la Race a las WTA Finals, con la fuente oficial.`,
    canonical: url,
    depth: 0,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Rankings ATP y WTA',
        url,
        inLanguage: 'es',
        dateModified: rankings.updated,
        isPartOf: { '@type': 'WebSite', name: 'AceArena', url: `${SITE}/` },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Rankings', item: url },
        ],
      },
    ],
    main,
  });
}

function creditsPage(credits) {
  const url = `${SITE}/creditos.html`;
  const items = credits.items.map((item) => {
    const file = item.src ? `<p><a href="${esc(item.src)}">${esc(item.src)}</a></p>` : '';
    const license = item.licenseUrl
      ? `<a href="${esc(item.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.license)}</a>`
      : esc(item.license);
    const source = item.sourceUrl
      ? `<a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.sourceName)}</a>`
      : esc(item.sourceName);
    return `        <article class="card">
          <h2>${esc(item.title)}</h2>
          ${file}
          <p>Autor: ${esc(item.author)}. Licencia: ${license}. Fuente: ${source}.</p>
          <p>Dónde aparece: ${esc(item.pages.join(', '))}.</p>
        </article>`;
  }).join('\n');
  const main = `  <main class="section page-section" id="contenido">
    <div class="container">
      <p class="news-meta"><a href="index.html">Inicio</a> · Créditos</p>
      <div class="section-header">
        <span class="section-tag">Imágenes</span>
        <h1>Créditos</h1>
        <p>Fotografías con licencia de uso comercial y gráficos propios de AceArena. Actualizado el ${esc(longDay(credits.updated))}.</p>
      </div>
      <figure class="photo-figure">
        <img src="photos/pelota.webp" srcset="photos/pelota-800.webp 800w, photos/pelota.webp 1200w" sizes="(max-width: 800px) 100vw, 480px" alt="Pelota de tenis amarilla sobre fondo neutro." width="1200" height="800">
        <figcaption>Foto: Christian VisualBeo Horvat, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>, vía <a href="https://commons.wikimedia.org/wiki/File:Tennisball.jpg" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>.</figcaption>
      </figure>
      <div class="card-grid">
${items}
      </div>
    </div>
  </main>`;
  return page({
    title: 'Créditos de imagen | AceArena',
    description: 'Fotografías con licencia y gráficos propios que usa AceArena, con autor, licencia y enlace.',
    canonical: url,
    depth: 0,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Créditos de imagen',
        url,
        inLanguage: 'es',
        dateModified: credits.updated,
        isPartOf: { '@type': 'WebSite', name: 'AceArena', url: `${SITE}/` },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Créditos', item: url },
        ],
      },
    ],
    main,
  });
}

function llmsFull(articles, playersDoc, guidesDoc, week, race, rankings) {
  const news = articles.slice(0, LLMS_LATEST).map((article) => `- ${article.title}: ${SITE}/noticias/${article.slug}.html (${article.date.slice(0, 10)})`).join('\n');
  const players = playersDoc.players.map((player) => `- ${player.name}: ${SITE}/jugadores/${player.slug}.html`).join('\n');
  const guides = guidesDoc.guides.map((guide) => `- ${guide.title}: ${SITE}/aprende/${guide.slug}.html`).join('\n');
  return `# AceArena

Sitio: ${SITE}
Idioma: español (es)
Datos legales: ${SITE}/aviso-legal.html
Contacto: hola@acearena.io
Patrocinio: sponsors@acearena.io

## Qué es

AceArena es un medio digital de tenis en español. Cubre el circuito ATP y el WTA: noticias, resultados con fuente, rankings con fecha y guías para seguir el deporte.

## Secciones

- Portada: ${SITE}/
- Noticias: ${SITE}/noticias/
- Resultados: ${SITE}/resultados.html
- Esta semana: ${SITE}/semana.html
- Race a Turín: ${SITE}/race.html
- Rankings ATP y WTA: ${SITE}/rankings.html
- Jugadores en español: ${SITE}/jugadores/
- Calendario 2027: ${SITE}/calendario-2027.html
- Aprende tenis: ${SITE}/aprende/
- Sobre AceArena: ${SITE}/sobre.html
- Patrocinio: ${SITE}/agencias.html
- Créditos de imagen: ${SITE}/creditos.html
- Resumen para sistemas: ${SITE}/llms.txt

## Política editorial

Cada noticia lleva fecha, firma (Redacción AceArena) y fuente. El autor en los datos estructurados es la organización AceArena. Los rankings indican la fecha de la lista oficial. Si un dato no está en la fuente, no se publica. Las correcciones se piden en hola@acearena.io. El contenido patrocinado va señalado como tal.

## Precios de patrocinio

Bronze desde 4.500 €/trimestre. Silver desde 12.000 €/trimestre. Gold desde 28.000 €/trimestre. Platinum a medida. Propuesta en menos de 48 horas laborables.

## Calendario de referencia

Davis Cup Final 8: Bolonia, 24–29 de noviembre de 2026. Australian Open 2027: Melbourne Park, 11–31 de enero; cuadro principal, 17–31 de enero.

## Esta semana

${week.range}. ${week.hoursNote}

## Rankings citados

ATP y WTA a ${rankings.asOf}. Race ATP consultada el ${race.asOf}. Race WTA a ${rankings.wtaRace.asOf}.

## Noticias

${news}

## Jugadores

${players}

## Guías

${guides}

## Cómo citar

AceArena (${SITE}). Cita un resultado solo si la página enlaza la fuente.
`;
}

function collectAssetHashes() {
  const hashes = new Map();
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const next = rel ? `${rel}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, next);
      else hashes.set(next, createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 10));
    }
  };
  walk(join(publicDir, 'assets'), '');
  return hashes;
}

function stampAssetRefs(text, hashes) {
  return text.replace(
    /(^|["'(=\s])((?:\.\.\/)*\/?)assets\/([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)(?:\?v=[A-Za-z0-9]+)?/g,
    (full, lead, prefix, file) => {
      const hash = hashes.get(file);
      if (!hash) return full;
      return `${lead}${prefix}assets/${file}?v=${hash}`;
    },
  );
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function stampPublishedAssets() {
  const hashes = collectAssetHashes();
  const targets = walkFiles(publicDir).filter((file) => {
    const name = file.slice(publicDir.length + 1);
    return name.endsWith('.html') || name === 'styles.css' || name === 'site.webmanifest';
  });
  for (const file of targets) {
    const current = readFileSync(file, 'utf8');
    const next = stampAssetRefs(current, hashes);
    if (next !== current) writeFileSync(file, next);
  }
}

function maxDay(values) {
  return values.filter(Boolean).sort().at(-1) ?? '2026-01-01';
}

async function build() {
  const news = readJson('news.json');
  const resultsDoc = readJson('results.json');
  const playersDoc = readJson('players.json');
  const calendarDoc = readJson('calendar.json');
  const guidesDoc = readJson('guides.json');
  const indexnow = readJson('indexnow.json');
  const week = readJson('week.json');
  const race = readJson('race.json');
  const rankings = readJson('rankings.json');
  const credits = readJson('image-credits.json');
  const errors = [
    ...validatePayload(news, resultsDoc),
    ...validateEvergreen({ players: playersDoc, calendar: calendarDoc, guides: guidesDoc, indexnow }),
    ...validateWeek(week),
    ...validateRace(race),
  ];
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

  mkdirSync(publicDir, { recursive: true });
  rmSync(join(publicDir, 'noticias'), { recursive: true, force: true });

  let home = readFileSync(join(publicDir, 'index.html'), 'utf8');
  home = fillRegion(home, 'EDITION', editionLabel(contentDay, today));
  home = fillRegion(home, 'WEEKLINE', linkParts(week.hero));
  home = fillRegion(home, 'TODAY', todayCard(week.today));
  home = fillRegion(home, 'WEEK', weekHome(week));
  home = fillRegion(home, 'NEWS', newsCards(homeArticles, (article) => `noticias/${article.slug}.html`));
  home = fillRegion(home, 'RESULTS', homepageResults(homeMatches));
  writeHtml('index.html', home);
  writeHtml('semana.html', weekPage(week));
  writeHtml('race.html', racePage(race));
  writeHtml('rankings.html', rankingsPage(rankings, playersDoc));
  writeHtml('creditos.html', creditsPage(credits));
  writeHtml('sobre.html', aboutPage());

  writeHtml('noticias/index.html', newsIndex(articles));
  for (const article of articles) {
    writeHtml(`noticias/${article.slug}.html`, articlePage(article));
  }
  const evergreen = evergreenEntries({ playersDoc, calendarDoc, guidesDoc }, { esc, site: SITE });
  for (const entry of evergreen) {
    writeHtml(entry.file, page(entry.page));
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
      'El formulario newsletter sirve para enviarte el resumen del lunes: lo importante de la semana en el tenis, en unos 3 minutos. La finalidad es ese envío. La base legal es tu consentimiento, que das al marcar la casilla.',
      'Puedes darte de baja en cualquier momento escribiendo a hola@acearena.io.',
      'Los formularios de newsletter y de agencias se envían con Netlify Forms. En el de agencias usamos el email y el mensaje para responder la consulta de patrocinio.',
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
    main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      <p class="news-meta">404</p>
      <h1>Bola fuera</h1>
      <p>Esta página no existe o ha cambiado de sitio. Pero el partido sigue: vuelve a la portada para ver lo último del circuito.</p>
      <p class="hero-cta">
        <a class="btn btn-primary" href="index.html">Ir a la portada</a>
        <a class="btn btn-outline" href="noticias/index.html">Últimas noticias</a>
        <a class="btn btn-outline" href="rankings.html">Rankings</a>
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
    main: `  <main class="section page-section" id="contenido">
    <article class="container article-wrap">
      <p class="news-meta">AceArena</p>
      <h1 id="thanksTitle">¡Gracias! Lo tenemos.</h1>
      <p id="thanksCopy">Si te has apuntado al resumen del lunes, te escribiremos a ese correo. Para darte de baja, escribe a hola@acearena.io. Si era una consulta de patrocinio, respondemos en menos de 48 horas laborables.</p>
      <p class="hero-cta">
        <a class="btn btn-primary" href="index.html#noticias">Ver lo último del circuito</a>
        <a class="btn btn-outline" href="index.html#newsletter">Apúntate al resumen</a>
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
  copyFileSync(join(root, 'data', 'players.json'), join(publicDir, 'data', 'players.json'));
  copyFileSync(join(root, 'data', 'calendar.json'), join(publicDir, 'data', 'calendar.json'));
  copyFileSync(join(root, 'data', 'guides.json'), join(publicDir, 'data', 'guides.json'));
  copyFileSync(join(root, 'data', 'week.json'), join(publicDir, 'data', 'week.json'));
  copyFileSync(join(root, 'data', 'race.json'), join(publicDir, 'data', 'race.json'));
  copyFileSync(join(root, 'data', 'rankings.json'), join(publicDir, 'data', 'rankings.json'));
  copyFileSync(join(root, 'data', 'image-credits.json'), join(publicDir, 'data', 'image-credits.json'));
  writeText(`${indexnow.key}.txt`, `${indexnow.key}\n`);

  const urls = [
    { loc: `${SITE}/`, lastmod: contentDay },
    { loc: `${SITE}/sobre.html`, lastmod: contentDay },
    { loc: `${SITE}/semana.html`, lastmod: week.updated },
    { loc: `${SITE}/race.html`, lastmod: race.updated },
    { loc: `${SITE}/rankings.html`, lastmod: rankings.updated },
    { loc: `${SITE}/creditos.html`, lastmod: credits.updated },
    { loc: `${SITE}/noticias/`, lastmod: contentDay },
    { loc: `${SITE}/resultados.html`, lastmod: resultsDoc.updated.slice(0, 10) },
    { loc: `${SITE}/agencias.html`, lastmod: contentDay },
    { loc: `${SITE}/aviso-legal.html`, lastmod: contentDay },
    { loc: `${SITE}/privacidad.html`, lastmod: contentDay },
    { loc: `${SITE}/cookies.html`, lastmod: contentDay },
    { loc: `${SITE}/jugadores/`, lastmod: playersDoc.updated },
    { loc: `${SITE}/calendario-2027.html`, lastmod: calendarDoc.updated },
    { loc: `${SITE}/aprende/`, lastmod: guidesDoc.updated },
    ...articles.map((article) => ({
      loc: `${SITE}/noticias/${article.slug}.html`,
      lastmod: article.updated,
    })),
    ...playersDoc.players.map((player) => ({
      loc: `${SITE}/jugadores/${player.slug}.html`,
      lastmod: playersDoc.updated,
    })),
    ...guidesDoc.guides.map((guide) => ({
      loc: `${SITE}/aprende/${guide.slug}.html`,
      lastmod: guidesDoc.updated,
    })),
  ];
  writeText('sitemap.xml', sitemap(urls));
  writeText('feed.xml', rss(articles));
  writeText('llms.txt', llmsTxt(articles, resultsDoc.updated, playersDoc, guidesDoc, week, race, rankings));
  writeText('llms-full.txt', llmsFull(articles, playersDoc, guidesDoc, week, race, rankings));
  await writeArticleHeaders(articles, { root, publicDir });
  await writeSocialCards(articles, { root, publicDir });
  stampPublishedAssets();

  console.log(`Build OK: ${articles.length} artículos (${homeArticles.length} en portada), ${matches.length} resultados (${homeMatches.length} en portada), ${playersDoc.players.length} jugadores, ${guidesDoc.guides.length} guías`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
