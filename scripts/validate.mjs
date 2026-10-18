import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
      if (name === '.git' || name === 'node_modules') continue;
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
        }
      });
    }
  }

  scanPlaceholders(news, 'noticias', errors);
  scanPlaceholders(resultsDoc, 'results', errors);
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
    sources: [{ name: 'ATP', url: 'https://www.atptour.com/en/news/example' }],
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
      source: 'https://www.atptour.com/en/news/example',
    }],
  };
  const cases = [
    ['válido', [article], results, 0],
    ['sin fuentes', [{ ...article, sources: [] }], results, 1],
    ['url inválida', [{ ...article, sources: [{ name: 'X', url: 'nota' }] }], results, 1],
    ['fecha futura', [{ ...article, date: '2026-10-19' }], results, 1],
    ['slug duplicado', [article, { ...article }], results, 1],
    ['placeholder', [{ ...article, body: ['TODO: completar'] }], results, 1],
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
  const errors = [
    ...validatePayload(news, results),
    ...pendingPlaceholderErrors(root),
  ];
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`OK: ${news.length} artículos, ${results.results.length} resultados`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
