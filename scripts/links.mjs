import { displayName, normalizeName } from './ranking.mjs';

const TOURNAMENT_STOP = new Set([
  'masters', 'open', 'international', 'presented', 'tennis', 'espana', 'france',
  'china', 'australia', 'singles', 'finals', 'grand', 'slam', 'classic', 'indoor',
]);

function isBoundary(text, index) {
  if (index < 0 || index >= text.length) return true;
  return !/[\p{L}\p{N}]/u.test(text[index]);
}

export function linkProse(text, esc, entries) {
  const ranges = [];
  const lower = text.toLocaleLowerCase('es');
  const sorted = [...entries].sort((a, b) => b.label.length - a.label.length);
  for (const entry of sorted) {
    if (!entry.label || entry.label.length < 4) continue;
    const needle = entry.label.toLocaleLowerCase('es');
    let from = 0;
    while (from < text.length) {
      const at = lower.indexOf(needle, from);
      if (at === -1) break;
      const end = at + entry.label.length;
      const overlaps = ranges.some((range) => at < range.end && end > range.start);
      if (!overlaps && isBoundary(text, at - 1) && isBoundary(text, end)) {
        ranges.push({ start: at, end, href: entry.href });
      }
      from = at + Math.max(entry.label.length, 1);
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  if (!ranges.length) return esc(text);
  let html = '';
  let cursor = 0;
  for (const range of ranges) {
    html += esc(text.slice(cursor, range.start));
    html += `<a href="${esc(range.href)}">${esc(text.slice(range.start, range.end))}</a>`;
    cursor = range.end;
  }
  html += esc(text.slice(cursor));
  return html;
}

export function createLinkIndex({ players, events }) {
  const playerByName = new Map();
  const prose = [];
  for (const player of players || []) {
    const href = `jugadores/${player.slug}.html`;
    playerByName.set(normalizeName(player.name), { name: player.name, href });
    prose.push({ label: player.name, href });
    const shown = displayName(player.name);
    if (shown !== player.name) prose.push({ label: shown, href });
  }
  const tournamentByNorm = [];
  for (const event of events || []) {
    const href = `torneos/${event.slug}.html`;
    prose.push({ label: event.name, href });
    tournamentByNorm.push({ name: event.name, href, norm: normalizeName(event.name) });
    for (const alias of event.aliases || []) {
      if (!alias) continue;
      prose.push({ label: alias, href });
      tournamentByNorm.push({ name: event.name, href, norm: normalizeName(alias) });
    }
  }
  return {
    prose,
    player(name) {
      return playerByName.get(normalizeName(name)) || null;
    },
    tournament(name) {
      const norm = normalizeName(name);
      if (!norm || norm === 'atp' || norm === 'wta' || norm.length < 5) return null;
      const exact = tournamentByNorm.find((event) => event.norm === norm);
      if (exact) return exact;
      const keys = norm.split(' ').filter((token) => token.length >= 6 && !TOURNAMENT_STOP.has(token));
      if (!keys.length) return null;
      const hits = tournamentByNorm.filter((event) => keys.every((key) => event.norm.includes(key)));
      return hits.length === 1 ? hits[0] : null;
    },
  };
}

export function prefixHref(href, depth) {
  if (!href || href.startsWith('http') || href.startsWith('../') || href.startsWith('/')) return href;
  const prefix = depth === 0 ? '' : '../'.repeat(depth);
  return `${prefix}${href}`;
}

export function proseEntries(index, depth) {
  return index.prose.map((entry) => ({
    label: entry.label,
    href: prefixHref(entry.href, depth),
  }));
}
