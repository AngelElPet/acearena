import { isMissing } from './missing.mjs';

const DAY = 86400000;

function dayNum(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  return Date.parse(`${iso}T00:00:00Z`);
}

function blob(event) {
  return `${event.name || ''} ${event.city || ''}`.toLowerCase();
}

function combinedKey(event) {
  const text = blob(event);
  if (/wta finals|finals indian/.test(text)) return null;
  if (/american tennis open/.test(text)) return null;
  const rules = [
    ['united-cup', /united cup/],
    ['brisbane', /brisbane/],
    ['adelaide', /adelaide/],
    ['australian-open', /australian open/],
    ['roland-garros', /roland garros/],
    ['wimbledon', /wimbledon/],
    ['us-open', /us open/],
    ['indian-wells', /indian wells/],
    ['miami-1000', /masters 1000 miami|miami open presented/],
    ['madrid-1000', /masters 1000 madrid|mutua madrid open/],
    ['eastbourne', /eastbourne/],
    ['hertogenbosch', /hertogenbosch/],
    ['beijing', /beijing|china open/],
  ];
  for (const [key, pattern] of rules) {
    if (pattern.test(text)) return key;
  }
  return null;
}

function fillKnownCategory(event) {
  if (event.tour !== 'ATP' || !isMissing(event.category)) return event;
  const text = blob(event);
  if (/barcelona/.test(text)) return { ...event, category: 'ATP 500' };
  if (/mallorca/.test(text) && String(event.startDate || '').startsWith('2026-06')) {
    return { ...event, category: 'ATP 250' };
  }
  return event;
}

function nameScore(event) {
  const name = event.name || '';
  const cityOnly = name.split(',').length <= 2 && name.split(' ').length <= 4;
  return name.length + (cityOnly ? 0 : 40) + (isMissing(event.category) ? 0 : 10);
}

function mergePair(atp, wta) {
  const primary = nameScore(wta) >= nameScore(atp) ? wta : atp;
  const start = [atp.startDate, wta.startDate].filter((value) => !isMissing(value)).sort()[0] || primary.startDate;
  const ends = [atp.endDate, wta.endDate].filter((value) => !isMissing(value)).sort();
  return {
    ...primary,
    tour: 'ATP y WTA',
    startDate: start,
    endDate: ends.length ? ends[ends.length - 1] : primary.endDate,
    categoryAtp: atp.category,
    categoryWta: wta.category,
    championAtp: atp.champion,
    finalistAtp: atp.finalist,
    scoreAtp: atp.score,
    championWta: wta.champion,
    finalistWta: wta.finalist,
    scoreWta: wta.score,
    officialUrlAtp: atp.officialUrl,
    officialUrlWta: wta.officialUrl,
    sources: [...(wta.sources || []), ...(atp.sources || [])],
    combined: true,
    mergedSlugs: [atp.slug, wta.slug].filter((slug) => slug && slug !== primary.slug),
  };
}

export function prepareTournaments(doc) {
  const events = (doc?.events || []).map((event) => fillKnownCategory({ ...event }));
  const groups = new Map();
  const plain = [];
  for (const event of events) {
    const key = combinedKey(event);
    if (!key) {
      plain.push(event);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const merged = [];
  for (const group of groups.values()) {
    const atp = group.filter((event) => event.tour === 'ATP');
    const wta = group.filter((event) => event.tour === 'WTA');
    const used = new Set();
    for (const left of atp) {
      const leftDay = dayNum(left.startDate);
      const right = wta.find((event) => {
        if (used.has(event.slug)) return false;
        const rightDay = dayNum(event.startDate);
        return leftDay != null && rightDay != null && Math.abs(leftDay - rightDay) <= 10 * DAY;
      });
      if (!right) {
        merged.push(left);
        continue;
      }
      used.add(right.slug);
      merged.push(mergePair(left, right));
    }
    for (const event of wta) {
      if (!used.has(event.slug)) merged.push(event);
    }
  }
  const ordered = [...merged, ...plain].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) || a.name.localeCompare(b.name, 'es'));
  return ordered;
}

export function tournamentHasData(event) {
  const values = [
    event.category,
    event.categoryAtp,
    event.categoryWta,
    event.champion,
    event.finalist,
    event.score,
    event.championAtp,
    event.championWta,
    event.finalistAtp,
    event.finalistWta,
    event.scoreAtp,
    event.scoreWta,
  ];
  return values.some((value) => !isMissing(value));
}
