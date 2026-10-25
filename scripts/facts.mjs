import { isMissing, sinDatoHtml } from './missing.mjs';
import { normalizeName } from './ranking.mjs';

export function formatHeight(value) {
  if (isMissing(value)) return '';
  const text = String(value).trim();
  const cm = text.match(/^(\d{2,3})\s*cm$/i);
  if (cm) {
    const digits = cm[1].padStart(3, '0');
    return `${Number(digits[0])},${digits.slice(1)} m`;
  }
  const meters = text.match(/^(\d)[.,](\d{2})\s*m$/i);
  if (meters) return `${meters[1]},${meters[2]} m`;
  return text;
}

export function heightCm(value) {
  const formatted = formatHeight(value);
  const meters = String(formatted).match(/^(\d),(\d{2}) m$/);
  if (!meters) return null;
  return Number(meters[1]) * 100 + Number(meters[2]);
}

export function factNumber(value) {
  if (isMissing(value)) return null;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function factsHtml(rows) {
  const list = rows.filter(Boolean);
  if (!list.length) return '';
  if (list.every((row) => row.missing)) {
    const label = list.length === 1 ? list[0].dt : 'Últimos cinco';
    return `<dl class="facts facts-empty"><div><dt>${label}</dt><dd>${sinDatoHtml()}</dd></div></dl>`;
  }
  const items = list.map((row) => (
    `<div><dt>${row.dt}</dt><dd>${row.missing ? sinDatoHtml() : row.dd}</dd></div>`
  )).join('\n');
  return `<dl class="facts">\n${items}\n</dl>`;
}

export function crumbNav(items) {
  const lis = items.map((item, index) => {
    const last = index === items.length - 1;
    const inner = !last && item.href ? `<a href="${item.href}">${item.label}</a>` : item.label;
    return `<li>${inner}</li>`;
  }).join('');
  return `<nav class="crumbs" aria-label="Migas de pan"><ol>${lis}</ol></nav>`;
}

export function levelPlain(prefix, category) {
  if (isMissing(category)) return '';
  const cat = String(category).trim();
  if (/^(ATP|WTA)\b/i.test(cat) || /united cup/i.test(cat)) return cat;
  if (new RegExp(`^${prefix}\\b`, 'i').test(cat)) return cat;
  return `${prefix} ${cat}`;
}

export function levelHtml(prefix, category, esc) {
  if (isMissing(category)) return `${esc(prefix)} ${sinDatoHtml()}`;
  return esc(levelPlain(prefix, category));
}

export function lastName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  const particles = new Set(['de', 'del', 'da', 'di', 'van', 'von']);
  if (parts.length >= 2 && particles.has(parts[parts.length - 2].toLowerCase())) return parts.slice(-2).join(' ');
  if (parts.length >= 3) return parts.slice(-2).join(' ');
  return parts[parts.length - 1];
}

export function roundLower(round) {
  return String(round || '').trim().toLocaleLowerCase('es');
}

export function sheetDisagreements(players, countries) {
  const errors = [];
  const sheets = new Map();
  for (const player of players?.players || []) {
    sheets.set(`${player.tour}:${normalizeName(player.name)}`, player);
  }
  for (const country of countries?.countries || []) {
    for (const row of [...(country.atp || []), ...(country.wta || [])]) {
      const sheet = sheets.get(`${row.tour}:${normalizeName(row.name)}`);
      if (!sheet) continue;
      const label = `paises/${country.slug} ${row.name}`;
      const careerSheet = sheet.facts?.careerHigh;
      if (!isMissing(row.careerHigh) && !isMissing(careerSheet) && factNumber(row.careerHigh) !== factNumber(careerSheet)) {
        errors.push(`${label}: mejor ranking ${row.careerHigh} no coincide con la ficha (${careerSheet})`);
      }
      const titlesSheet = sheet.facts?.titlesCareer;
      if (!isMissing(row.titlesCareer) && !isMissing(titlesSheet) && factNumber(row.titlesCareer) !== factNumber(titlesSheet)) {
        errors.push(`${label}: títulos ${row.titlesCareer} no coinciden con la ficha (${titlesSheet})`);
      }
      const left = heightCm(row.height);
      const right = heightCm(sheet.height);
      if (left != null && right != null && left !== right) {
        errors.push(`${label}: estatura ${row.height} no coincide con la ficha (${sheet.height})`);
      }
    }
  }
  return errors;
}
