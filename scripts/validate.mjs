import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PLACEHOLDERS = [
  { re: /lorem ipsum/i, label: 'lorem ipsum' },
  { re: /\bFIXME\b/, label: 'FIXME' },
  { re: /\bTBD\b/, label: 'TBD' },
  { re: /\bTODO\b/, label: 'TODO' },
  { re: /placeholder/i, label: 'placeholder' },
  { re: /X{5,}/, label: 'XXXXX' },
  { re: /example\.com/i, label: 'example.com' },
  { re: /ejemplo\.com/i, label: 'ejemplo.com' },
  { re: /\{\{/, label: '{{' },
  { re: /\[insert\b/i, label: '[insert' },
  { re: /G-X{6,}/, label: 'G-XXXXXX' },
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PENDING_MARKER = '[' + 'PENDIENTE';
const TEXT_EXTENSIONS = new Set(['.html', '.mjs', '.js', '.css', '.md', '.json', '.xml', '.txt', '.yml', '.yaml', '.toml']);

export function hasPendingMarker(text) {
  return text.includes(PENDING_MARKER);
}

export function pendingPlaceholderErrors(rootDir) {
  const errors = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === '.git' || name === 'node_modules' || name === '.cache' || name === '__pycache__') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const dot = name.lastIndexOf('.');
      if (dot === -1 || !TEXT_EXTENSIONS.has(name.slice(dot))) continue;
      if (hasPendingMarker(readFileSync(full, 'utf8'))) {
        errors.push(`${full.slice(rootDir.length + 1)} contiene un marcador de datos legales sin resolver`);
      }
    }
  };
  walk(rootDir);
  return errors;
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || value !== value.trim() || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isPlaceholderUrl(value) {
  if (!isHttpUrl(value)) return false;
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'example.com' || host.endsWith('.example.com') ||
    host === 'ejemplo.com' || host.endsWith('.ejemplo.com') ||
    host === 'example.org' || host.endsWith('.example.org')
  ) {
    return true;
  }
  return url.pathname.toLowerCase().split('/').some((part) => (
    part === 'example' || part === 'ejemplo' || part === 'placeholder'
  ));
}

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function todayUtc(now) {
  return now.toISOString().slice(0, 10);
}

function scanPlaceholders(value, path, errors) {
  if (typeof value === 'string') {
    for (const rule of PLACEHOLDERS) {
      if (rule.re.test(value)) {
        errors.push(`${path} contiene texto de relleno (${rule.label})`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPlaceholders(item, `${path}[${index}]`, errors));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      scanPlaceholders(item, `${path}.${key}`, errors);
    }
  }
}

function requireText(value, path, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${path} es obligatorio`);
    return false;
  }
  if (/[<>]/.test(value)) {
    errors.push(`${path} debe ser texto plano, sin HTML`);
  }
  return true;
}

/**
 * @param {unknown} news
 * @param {unknown} resultsDoc
 * @param {Date} [now]
 * @returns {string[]}
 */
export function validatePayload(news, resultsDoc, now = new Date()) {
  const errors = [];
  const today = todayUtc(now);

  if (!Array.isArray(news)) {
    errors.push('data/news.json debe ser un array de artículos');
  } else {
    const slugs = new Map();
    news.forEach((article, index) => {
      const path = `noticias[${index}]`;
      if (!article || typeof article !== 'object' || Array.isArray(article)) {
        errors.push(`${path} debe ser un objeto`);
        return;
      }
      requireText(article.slug, `${path}.slug`, errors);
      if (typeof article.slug === 'string') {
        if (!SLUG_RE.test(article.slug)) {
          errors.push(`${path}.slug debe usar minúsculas, números y guiones (${article.slug})`);
        }
        if (slugs.has(article.slug)) {
          errors.push(`slug duplicado: ${article.slug} (también en noticias[${slugs.get(article.slug)}])`);
        } else {
          slugs.set(article.slug, index);
        }
      }
      requireText(article.title, `${path}.title`, errors);
      requireText(article.summary, `${path}.summary`, errors);
      requireText(article.tournament, `${path}.tournament`, errors);

      if (!parseDay(article.date)) {
        errors.push(`${path}.date debe ser una fecha ISO válida (YYYY-MM-DD)`);
      } else if (article.date > today) {
        errors.push(`${path}.date está en el futuro (${article.date})`);
      }
      if (!parseDay(article.updated)) {
        errors.push(`${path}.updated debe ser una fecha ISO válida (YYYY-MM-DD)`);
      } else if (article.updated > today) {
        errors.push(`${path}.updated está en el futuro (${article.updated})`);
      } else if (parseDay(article.date) && article.updated < article.date) {
        errors.push(`${path}.updated es anterior a date`);
      }

      if (!Array.isArray(article.body) || article.body.length === 0) {
        errors.push(`${path}.body debe ser un array de párrafos`);
      } else {
        article.body.forEach((paragraph, paragraphIndex) => {
          requireText(paragraph, `${path}.body[${paragraphIndex}]`, errors);
        });
      }

      if (article.brief != null) {
        if (!Array.isArray(article.brief) || article.brief.length !== 3) {
          errors.push(`${path}.brief debe tener 3 viñetas`);
        } else {
          article.brief.forEach((item, itemIndex) => requireText(item, `${path}.brief[${itemIndex}]`, errors));
        }
      }

      if (article.upcoming != null) {
        if (!Array.isArray(article.upcoming) || article.upcoming.length === 0) {
          errors.push(`${path}.upcoming necesita torneos`);
        } else {
          article.upcoming.forEach((event, eventIndex) => {
            const eventPath = `${path}.upcoming[${eventIndex}]`;
            for (const field of ['name', 'place', 'dates']) requireText(event?.[field], `${eventPath}.${field}`, errors);
            if (!isHttpUrl(event?.url)) errors.push(`${eventPath}.url no es una URL http(s) válida`);
            else if (isPlaceholderUrl(event.url)) errors.push(`${eventPath}.url es una URL de ejemplo`);
          });
        }
      }

      for (const field of ['tags', 'players']) {
        if (!Array.isArray(article[field])) {
          errors.push(`${path}.${field} debe ser un array`);
        } else {
          article[field].forEach((item, itemIndex) => {
            requireText(item, `${path}.${field}[${itemIndex}]`, errors);
          });
        }
      }

      if (!Array.isArray(article.sources) || article.sources.length === 0) {
        errors.push(`${path}.sources es obligatorio y necesita al menos una fuente`);
      } else {
        article.sources.forEach((source, sourceIndex) => {
          const sourcePath = `${path}.sources[${sourceIndex}]`;
          if (!source || typeof source !== 'object' || Array.isArray(source)) {
            errors.push(`${sourcePath} debe ser un objeto {name, url}`);
            return;
          }
          requireText(source.name, `${sourcePath}.name`, errors);
          if (!isHttpUrl(source.url)) {
            errors.push(`${sourcePath}.url no es una URL http(s) válida`);
          } else if (isPlaceholderUrl(source.url)) {
            errors.push(`${sourcePath}.url es una URL de ejemplo o de relleno`);
          }
        });
      }
    });
  }

  if (!resultsDoc || typeof resultsDoc !== 'object' || Array.isArray(resultsDoc)) {
    errors.push('data/results.json debe ser un objeto con updated y results');
  } else {
    const updated = Date.parse(resultsDoc.updated);
    if (typeof resultsDoc.updated !== 'string' || Number.isNaN(updated)) {
      errors.push('results.updated debe ser una marca de tiempo ISO');
    } else if (updated > now.getTime()) {
      errors.push(`results.updated está en el futuro (${resultsDoc.updated})`);
    }

    if (!Array.isArray(resultsDoc.results)) {
      errors.push('results.results debe ser un array');
    } else {
      resultsDoc.results.forEach((match, index) => {
        const path = `results[${index}]`;
        if (!match || typeof match !== 'object' || Array.isArray(match)) {
          errors.push(`${path} debe ser un objeto`);
          return;
        }
        for (const field of ['tournament', 'round', 'winner', 'loser', 'score']) {
          requireText(match[field], `${path}.${field}`, errors);
        }
        if (!parseDay(match.date)) {
          errors.push(`${path}.date debe ser una fecha ISO válida (YYYY-MM-DD)`);
        } else if (match.date > today) {
          errors.push(`${path}.date está en el futuro (${match.date})`);
        }
        if (!isHttpUrl(match.source)) {
          errors.push(`${path}.source no es una URL http(s) válida`);
        } else if (isPlaceholderUrl(match.source)) {
          errors.push(`${path}.source es una URL de ejemplo o de relleno`);
        }
      });
    }
  }

  scanPlaceholders(news, 'noticias', errors);
  scanPlaceholders(resultsDoc, 'results', errors);
  return errors;
}

function requireSources(sources, path, errors) {
  if (!Array.isArray(sources) || sources.length === 0) {
    errors.push(`${path} necesita al menos una fuente`);
    return;
  }
  sources.forEach((source, index) => {
    const sourcePath = `${path}[${index}]`;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      errors.push(`${sourcePath} debe ser un objeto {name, url}`);
      return;
    }
    requireText(source.name, `${sourcePath}.name`, errors);
    if (!isHttpUrl(source.url)) errors.push(`${sourcePath}.url no es una URL http(s) válida`);
    else if (isPlaceholderUrl(source.url)) errors.push(`${sourcePath}.url es una URL de ejemplo o de relleno`);
  });
}

export function validateEvergreen({ players, calendar, guides, indexnow }, now = new Date()) {
  const errors = [];
  const today = todayUtc(now);
  if (!indexnow || typeof indexnow.key !== 'string' || !/^[A-Za-z0-9-]{8,128}$/.test(indexnow.key)) {
    errors.push('data/indexnow.json necesita una clave de 8 a 128 caracteres [A-Za-z0-9-]');
  }
  const checkUpdated = (doc, path) => {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      errors.push(`${path} debe ser un objeto`);
      return false;
    }
    if (!parseDay(doc.updated)) errors.push(`${path}.updated debe ser YYYY-MM-DD`);
    else if (doc.updated > today) errors.push(`${path}.updated está en el futuro`);
    return true;
  };
  if (checkUpdated(players, 'players') && Array.isArray(players.players)) {
    const slugs = new Set();
    players.players.forEach((player, index) => {
      const path = `players[${index}]`;
      if (!player || typeof player !== 'object') {
        errors.push(`${path} debe ser un objeto`);
        return;
      }
      for (const field of ['slug', 'name', 'tour', 'profileUrl', 'birthDate', 'nationality']) {
        requireText(player[field], `${path}.${field}`, errors);
      }
      if (typeof player.slug === 'string' && !SLUG_RE.test(player.slug)) errors.push(`${path}.slug no es válido`);
      if (typeof player.slug === 'string' && slugs.has(player.slug)) errors.push(`slug de jugador duplicado: ${player.slug}`);
      slugs.add(player.slug);
      if (player.tour !== 'ATP' && player.tour !== 'WTA') errors.push(`${path}.tour debe ser ATP o WTA`);
      if (!isHttpUrl(player.profileUrl)) errors.push(`${path}.profileUrl no es una URL http(s) válida`);
      else if (isPlaceholderUrl(player.profileUrl)) errors.push(`${path}.profileUrl es una URL de ejemplo`);
      if (!parseDay(player.birthDate)) errors.push(`${path}.birthDate debe ser YYYY-MM-DD`);
      for (const field of ['bio', 'style', 'highlights']) {
        if (!Array.isArray(player[field]) || player[field].length === 0) errors.push(`${path}.${field} necesita texto`);
        else player[field].forEach((item, itemIndex) => requireText(item, `${path}.${field}[${itemIndex}]`, errors));
      }
      const ranking = player.ranking;
      if (!ranking || typeof ranking !== 'object') errors.push(`${path}.ranking es obligatorio`);
      else {
        requireText(ranking.position, `${path}.ranking.position`, errors);
        requireText(ranking.points, `${path}.ranking.points`, errors);
        if (!parseDay(ranking.asOf)) errors.push(`${path}.ranking.asOf debe ser YYYY-MM-DD`);
        else if (ranking.asOf > today) errors.push(`${path}.ranking.asOf está en el futuro`);
        if (ranking.note != null) requireText(ranking.note, `${path}.ranking.note`, errors);
      }
      requireSources(player.sources, `${path}.sources`, errors);
      if (player.nextEvent != null) {
        for (const field of ['name', 'place', 'dates']) requireText(player.nextEvent[field], `${path}.nextEvent.${field}`, errors);
        if (!isHttpUrl(player.nextEvent.url)) errors.push(`${path}.nextEvent.url no es una URL http(s) válida`);
      }
    });
  } else if (players && typeof players === 'object') {
    errors.push('players.players debe ser un array');
  }
  if (checkUpdated(calendar, 'calendar') && Array.isArray(calendar.sections)) {
    calendar.sections.forEach((section, index) => {
      const path = `calendar.sections[${index}]`;
      requireText(section?.title, `${path}.title`, errors);
      if (!Array.isArray(section?.events) || section.events.length === 0) {
        errors.push(`${path}.events necesita citas`);
        return;
      }
      section.events.forEach((event, eventIndex) => {
        const eventPath = `${path}.events[${eventIndex}]`;
        requireText(event?.name, `${eventPath}.name`, errors);
        requireText(event?.when, `${eventPath}.when`, errors);
        requireSources(event?.sources, `${eventPath}.sources`, errors);
      });
    });
  } else if (calendar && typeof calendar === 'object') {
    errors.push('calendar.sections debe ser un array');
  }
  if (checkUpdated(guides, 'guides') && Array.isArray(guides.guides)) {
    const slugs = new Set();
    guides.guides.forEach((guide, index) => {
      const path = `guides[${index}]`;
      for (const field of ['slug', 'title', 'description', 'intro']) requireText(guide?.[field], `${path}.${field}`, errors);
      if (typeof guide?.slug === 'string' && slugs.has(guide.slug)) errors.push(`slug de guía duplicado: ${guide.slug}`);
      if (guide?.slug) slugs.add(guide.slug);
      if (!Array.isArray(guide?.faqs) || guide.faqs.length === 0) errors.push(`${path}.faqs es obligatorio`);
      else guide.faqs.forEach((faq, faqIndex) => {
        requireText(faq?.q, `${path}.faqs[${faqIndex}].q`, errors);
        requireText(faq?.a, `${path}.faqs[${faqIndex}].a`, errors);
      });
      requireSources(guide?.sources, `${path}.sources`, errors);
    });
  } else if (guides && typeof guides === 'object') {
    errors.push('guides.guides debe ser un array');
  }
  scanPlaceholders({ players, calendar, guides, indexnow }, 'evergreen', errors);
  return errors;
}

const SURFACES = new Set(['hard', 'clay', 'grass', 'indoor', '']);

function validateTournament(event, path, errors) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    errors.push(`${path} debe ser un objeto`);
    return;
  }
  for (const field of ['name', 'level', 'dates', 'place', 'surfaceLabel', 'officialUrl', 'detail']) {
    requireText(event[field], `${path}.${field}`, errors);
  }
  if (event.tour !== 'ATP' && event.tour !== 'WTA') errors.push(`${path}.tour debe ser ATP o WTA`);
  if (!SURFACES.has(event.surface)) errors.push(`${path}.surface no es válida`);
  if (!isHttpUrl(event.officialUrl)) errors.push(`${path}.officialUrl no es una URL http(s) válida`);
  else if (isPlaceholderUrl(event.officialUrl)) errors.push(`${path}.officialUrl es una URL de ejemplo`);
  if (event.entries != null && event.entries !== '') requireText(event.entries, `${path}.entries`, errors);
  requireSources(event.sources, `${path}.sources`, errors);
}

export function validateWeek(week, now = new Date()) {
  const errors = [];
  const today = todayUtc(now);
  if (!week || typeof week !== 'object' || Array.isArray(week)) {
    errors.push('week debe ser un objeto');
    return errors;
  }
  if (!parseDay(week.updated)) errors.push('week.updated debe ser YYYY-MM-DD');
  else if (week.updated > today) errors.push('week.updated está en el futuro');
  requireText(week.range, 'week.range', errors);
  requireText(week.hoursNote, 'week.hoursNote', errors);
  if (!Array.isArray(week.hero) || week.hero.length === 0) errors.push('week.hero necesita fragmentos');
  else week.hero.forEach((part, index) => {
    requireText(part?.text, `week.hero[${index}].text`, errors);
    if (part?.href != null) {
      if (!isHttpUrl(part.href)) errors.push(`week.hero[${index}].href no es una URL http(s) válida`);
      else if (isPlaceholderUrl(part.href)) errors.push(`week.hero[${index}].href es una URL de ejemplo`);
    }
  });
  const todayCard = week.today;
  if (!todayCard || typeof todayCard !== 'object') errors.push('week.today es obligatorio');
  else {
    for (const field of ['resultTitle', 'resultText', 'resultHref', 'nextTitle', 'nextText', 'nextHref']) {
      requireText(todayCard[field], `week.today.${field}`, errors);
    }
  }
  if (!Array.isArray(week.tournaments) || week.tournaments.length === 0) errors.push('week.tournaments necesita torneos');
  else week.tournaments.forEach((event, index) => validateTournament(event, `week.tournaments[${index}]`, errors));
  if (!Array.isArray(week.later) || week.later.length === 0) errors.push('week.later necesita la cita siguiente');
  else week.later.forEach((event, index) => validateTournament(event, `week.later[${index}]`, errors));
  scanPlaceholders(week, 'week', errors);
  return errors;
}

export function validateRace(race, now = new Date()) {
  const errors = [];
  const today = todayUtc(now);
  if (!race || typeof race !== 'object' || Array.isArray(race)) {
    errors.push('race debe ser un objeto');
    return errors;
  }
  if (!parseDay(race.updated)) errors.push('race.updated debe ser YYYY-MM-DD');
  else if (race.updated > today) errors.push('race.updated está en el futuro');
  if (!parseDay(race.asOf)) errors.push('race.asOf debe ser YYYY-MM-DD');
  else if (race.asOf > today) errors.push('race.asOf está en el futuro');
  requireText(race.name, 'race.name', errors);
  requireText(race.context, 'race.context', errors);
  requireSources([race.source], 'race.source', errors);
  requireSources(race.contextSources, 'race.contextSources', errors);
  if (!Array.isArray(race.rows) || race.rows.length !== 10) errors.push('race.rows debe tener el top 10');
  else race.rows.forEach((row, index) => {
    requireText(row?.position, `race.rows[${index}].position`, errors);
    requireText(row?.player, `race.rows[${index}].player`, errors);
    requireText(row?.points, `race.rows[${index}].points`, errors);
    if (row?.position !== String(index + 1)) errors.push(`race.rows[${index}].position debe ser ${index + 1}`);
  });
  scanPlaceholders(race, 'race', errors);
  return errors;
}

function visibleHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\splaceholder\s*=\s*(?:"[^"]*"|'[^']*')/gi, ' ');
}

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function tagAttrs(tag) {
  const found = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(tag))) found[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
  return found;
}

function hasId(html, id) {
  return html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
}

function materialize(file) {
  if (existsSync(file)) {
    if (statSync(file).isDirectory()) {
      const index = join(file, 'index.html');
      return existsSync(index) ? index : null;
    }
    return file;
  }
  if (existsSync(`${file}.html`)) return `${file}.html`;
  const index = join(file, 'index.html');
  return existsSync(index) ? index : null;
}

function classifyLink(fromFile, raw, publicDir) {
  const value = String(raw || '').trim();
  if (!value || /^(mailto:|tel:|javascript:|data:)/i.test(value)) return { skip: true };
  if (isHttpUrl(value) && isPlaceholderUrl(value)) return { error: `URL de ejemplo: ${value}` };
  if (value.startsWith('#')) return { file: fromFile, hash: decodeURIComponent(value.slice(1)) };
  let path = value;
  let hash = '';
  if (/^https?:\/\//i.test(value)) {
    let url;
    try { url = new URL(value); } catch { return { error: `URL inválida: ${value}` }; }
    const host = url.hostname.toLowerCase();
    if (host !== 'acearena.io' && host !== 'www.acearena.io') return { skip: true };
    path = url.pathname;
    hash = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
  } else {
    const hashAt = path.indexOf('#');
    if (hashAt !== -1) {
      hash = decodeURIComponent(path.slice(hashAt + 1));
      path = path.slice(0, hashAt);
    }
    const queryAt = path.indexOf('?');
    if (queryAt !== -1) path = path.slice(0, queryAt);
    if (path === '') return { file: fromFile, hash };
  }
  let filePath;
  try {
    filePath = path.startsWith('/')
      ? join(publicDir, decodeURIComponent(path))
      : join(dirname(fromFile), decodeURIComponent(path));
  } catch {
    return { error: `enlace ilegible: ${value}` };
  }
  filePath = normalize(filePath);
  const rel = relative(publicDir, filePath);
  if (rel.startsWith('..') || rel.split(sep).includes('..')) return { error: `enlace fuera del sitio: ${value}` };
  return { file: filePath, hash, raw: value };
}

function cssSelectors(block) {
  const selectors = [];
  let depth = 0;
  let buffer = '';
  for (const char of block) {
    if (char === '{') {
      if (depth === 0) {
        selectors.push(buffer);
        buffer = '';
      }
      depth += 1;
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      buffer += char;
    }
  }
  return selectors.flatMap((selector) => selector.split(',')).map((part) => part.trim().replace(/\s+/g, ' ')).filter((part) => part && !part.startsWith('@') && !part.includes(':'));
}

function splitSelectors(header) {
  return header.split(',').map((part) => part.trim().replace(/\s+/g, ' ')).filter((part) => part && !part.startsWith('@') && !part.includes(':'));
}

export function cssCascadeErrors(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const errors = [];
  const media = [];
  const at = /@media[^{]*\(\s*max-width\s*:[^{]*\{/g;
  let match;
  while ((match = at.exec(clean))) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let end = open;
    for (let index = open; index < clean.length; index += 1) {
      if (clean[index] === '{') depth += 1;
      else if (clean[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    media.push({
      end,
      selectors: new Set(cssSelectors(clean.slice(open + 1, end - 1))),
    });
  }
  if (media.length === 0) return errors;
  const base = [];
  let depth = 0;
  let buffer = '';
  let ruleStart = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (char === '{') {
      if (depth === 0) {
        const header = buffer;
        if (!header.includes('@')) base.push({ at: ruleStart, selectors: splitSelectors(header) });
        buffer = '';
      }
      depth += 1;
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) ruleStart = index + 1;
    } else if (depth === 0) {
      if (!buffer.trim()) ruleStart = index;
      buffer += char;
    }
  }
  for (const block of media) {
    for (const rule of base) {
      if (rule.at < block.end) continue;
      for (const selector of rule.selectors) {
        if (block.selectors.has(selector)) {
          errors.push(`styles.css: la regla base «${selector}» aparece después de un @media (max-width) que también la define`);
        }
      }
    }
  }
  return errors;
}

export function validateSite(rootDir) {
  const errors = [];
  const publicDir = join(rootDir, 'public');
  const pages = walkHtml(publicDir);
  const htmlByFile = new Map(pages.map((file) => [file, readFileSync(file, 'utf8')]));
  for (const [file, html] of htmlByFile) {
    const label = relative(publicDir, file);
    const title = html.match(/<title>([^<]*)<\/title>/);
    if (!title || title[1].trim() === '') errors.push(`${label} no tiene title`);
    const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => tagAttrs(match[0]));
    const description = metas.find((meta) => meta.name === 'description');
    if (!description || !description.content || description.content.trim() === '') errors.push(`${label} no tiene meta description`);
    const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => tagAttrs(match[0])).find((link) => link.rel === 'canonical');
    if (!canonicalTag || !canonicalTag.href || !canonicalTag.href.startsWith('https://acearena.io')) {
      errors.push(`${label} no tiene canonical en https://acearena.io`);
    }
    if (/<link\b[^>]*\bhref=["'][^"']*styles\.css[^"']*["'][^>]*>/i.test(html)) {
      const styleLinks = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]).filter((tag) => /styles\.css/i.test(tag));
      if (styleLinks.some((tag) => /media\s*=\s*["']print["']/i.test(tag))) {
        errors.push(`${label} carga styles.css con media="print"`);
      }
    }
    const visible = visibleHtml(html);
    for (const rule of PLACEHOLDERS) {
      if (rule.re.test(visible)) errors.push(`${label} contiene texto de relleno (${rule.label})`);
    }
    const tags = [...html.matchAll(/<(?:a|link|script|img|form|source)\b[^>]*>/gi)];
    const targets = [];
    for (const match of tags) {
      const attrs = tagAttrs(match[0]);
      for (const key of ['href', 'src', 'action']) {
        if (attrs[key]) targets.push(attrs[key]);
      }
    }
    for (const meta of metas) {
      if ((meta.property === 'og:image' || meta.name === 'twitter:image') && meta.content) targets.push(meta.content);
    }
    for (const target of targets) {
      const resolved = classifyLink(file, target, publicDir);
      if (resolved.skip) continue;
      if (resolved.error) {
        errors.push(`${label}: ${resolved.error}`);
        continue;
      }
      const dest = materialize(resolved.file);
      if (!dest) {
        errors.push(`${label}: el enlace no resuelve (${target})`);
        continue;
      }
      if (resolved.hash) {
        const destHtml = htmlByFile.get(dest) || (dest.endsWith('.html') && existsSync(dest) ? readFileSync(dest, 'utf8') : '');
        if (!destHtml || !hasId(destHtml, resolved.hash)) errors.push(`${label}: no existe #${resolved.hash} en ${relative(publicDir, dest)}`);
      }
    }
  }
  const news = JSON.parse(readFileSync(join(rootDir, 'data', 'news.json'), 'utf8'));
  for (const article of news) {
    const social = join(publicDir, 'social', `${article.slug}.png`);
    const og = join(publicDir, 'og', `${article.slug}.png`);
    const socialSize = existsSync(social) ? pngSize(readFileSync(social)) : null;
    const ogSize = existsSync(og) ? pngSize(readFileSync(og)) : null;
    if (!socialSize || socialSize.width !== 1080 || socialSize.height !== 1350) errors.push(`public/social/${article.slug}.png debe medir 1080x1350`);
    if (!ogSize || ogSize.width !== 1200 || ogSize.height !== 630) errors.push(`public/og/${article.slug}.png debe medir 1200x630`);
  }
  const indexnow = JSON.parse(readFileSync(join(rootDir, 'data', 'indexnow.json'), 'utf8'));
  const keyFile = join(publicDir, `${indexnow.key}.txt`);
  if (!existsSync(keyFile) || readFileSync(keyFile, 'utf8').trim() !== indexnow.key) {
    errors.push(`public/${indexnow.key}.txt debe contener la clave IndexNow`);
  }
  const robots = readFileSync(join(publicDir, 'robots.txt'), 'utf8');
  if (!robots.includes('Sitemap: https://acearena.io/sitemap.xml')) errors.push('robots.txt no referencia el sitemap');
  const sitemap = readFileSync(join(publicDir, 'sitemap.xml'), 'utf8');
  if (!sitemap.includes('<lastmod>')) errors.push('el sitemap no tiene lastmod');
  for (const forbidden of ['/social/', '/og/', 'acearena-patrocinio.pdf', `${indexnow.key}.txt`, '18–31']) {
    if (sitemap.includes(forbidden)) errors.push(`el sitemap no debe incluir ${forbidden}`);
  }
  for (const required of ['/jugadores/', '/calendario-2027.html', '/aprende/como-funciona-el-ranking-atp.html']) {
    if (!sitemap.includes(`https://acearena.io${required}`)) errors.push(`falta en el sitemap: ${required}`);
  }
  const cssOrder = cssCascadeErrors(readFileSync(join(publicDir, 'styles.css'), 'utf8'));
  errors.push(...cssOrder);
  const llmsFull = readFileSync(join(publicDir, 'llms-full.txt'), 'utf8');
  if (llmsFull.includes('18–31')) errors.push('public/llms-full.txt sigue con el tramo antiguo del Australian Open');
  if (!llmsFull.includes('11–31 de enero') || !llmsFull.includes('17–31')) {
    errors.push('public/llms-full.txt debe decir 11–31 de enero y cuadro principal 17–31');
  }
  return errors;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer ${path}: ${error.message}`);
  }
}

function selfTest() {
  const now = new Date('2026-10-18T12:00:00.000Z');
  const article = {
    slug: 'partido-de-prueba',
    title: 'Título',
    date: '2026-10-18',
    updated: '2026-10-18',
    summary: 'Resumen',
    body: ['Párrafo'],
    tags: ['ATP'],
    players: ['Jugador'],
    tournament: 'Torneo',
    sources: [{ name: 'ATP', url: 'https://www.atptour.com/en/news/partido-de-prueba' }],
  };
  const results = {
    updated: '2026-10-18T00:00:00.000Z',
    results: [{
      tournament: 'Torneo',
      round: 'Final',
      date: '2026-10-18',
      winner: 'A',
      loser: 'B',
      score: '6-4 6-4',
      source: 'https://www.atptour.com/en/news/partido-de-prueba',
    }],
  };
  const cases = [
    ['válido', [article], results, 0],
    ['sin fuentes', [{ ...article, sources: [] }], results, 1],
    ['url inválida', [{ ...article, sources: [{ name: 'X', url: 'nota' }] }], results, 1],
    ['fecha futura', [{ ...article, date: '2026-10-19' }], results, 1],
    ['slug duplicado', [article, { ...article }], results, 1],
    ['placeholder', [{ ...article, body: ['TODO: completar'] }], results, 1],
    ['url de ejemplo', [{ ...article, sources: [{ name: 'ATP', url: 'https://www.atptour.com/en/news/example' }] }], results, 1],
    ['url placeholder', [{ ...article, sources: [{ name: 'X', url: 'https://example.com/nota' }] }], results, 1],
  ];
  const failures = [];
  for (const [name, news, resultsDoc, minimum] of cases) {
    const errors = validatePayload(news, resultsDoc, now);
    if (minimum === 0 && errors.length !== 0) failures.push(`${name}: ${errors.join('; ')}`);
    if (minimum > 0 && errors.length < minimum) failures.push(`${name}: no falló`);
  }
  if (!hasPendingMarker('[' + 'PENDIENTE: nombre/NIF/dirección')) {
    failures.push('no detecta el marcador PENDIENTE');
  }
  if (hasPendingMarker('Angel Cebria Morales')) {
    failures.push('falso positivo en el marcador PENDIENTE');
  }
  const printSample = '<link rel="stylesheet" href="styles.css" media="print" onload="this.media=\'all\'">';
  if (!/media\s*=\s*["']print["']/i.test(printSample)) failures.push('el patrón de media=print no detecta el caso');
  const blockingSample = '<link rel="stylesheet" href="../styles.css">';
  if (/<link\b[^>]*styles\.css[^>]*media\s*=\s*["']print["']/i.test(blockingSample)) {
    failures.push('falso positivo en styles.css bloqueante');
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log('self-test OK');
}

function main() {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }
  const news = readJson(join(root, 'data', 'news.json'));
  const results = readJson(join(root, 'data', 'results.json'));
  const players = readJson(join(root, 'data', 'players.json'));
  const calendar = readJson(join(root, 'data', 'calendar.json'));
  const guides = readJson(join(root, 'data', 'guides.json'));
  const indexnow = readJson(join(root, 'data', 'indexnow.json'));
  const week = readJson(join(root, 'data', 'week.json'));
  const race = readJson(join(root, 'data', 'race.json'));
  const errors = [
    ...validatePayload(news, results),
    ...validateEvergreen({ players, calendar, guides, indexnow }),
    ...validateWeek(week),
    ...validateRace(race),
    ...pendingPlaceholderErrors(root),
  ];
  if (process.argv.includes('--site')) errors.push(...validateSite(root));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  const siteNote = process.argv.includes('--site') ? ', sitio comprobado' : '';
  console.log(`OK: ${news.length} artículos, ${results.results.length} resultados${siteNote}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
