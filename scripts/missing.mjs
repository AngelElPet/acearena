const MISSING_VALUE = /^(?:sin datos?|s\/d|n\/d|n\.d\.|nd|—|–|-{1,3})$/i;
const MISSING_PHRASE = /\b(?:sin datos?|n\/d|n\.d\.)\b/gi;

export function isMissing(value) {
  if (value == null) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  const text = String(value).trim();
  return text === '' || MISSING_VALUE.test(text);
}

export function sinDatoHtml() {
  return '<span class="sin-dato" aria-label="Sin dato">—</span>';
}

export function showText(value) {
  return isMissing(value) ? '—' : String(value);
}

export function showHtml(value, esc) {
  if (isMissing(value)) return sinDatoHtml();
  return esc(String(value));
}

export function proseHtml(text, esc) {
  const source = String(text ?? '');
  let html = '';
  let last = 0;
  for (const match of source.matchAll(MISSING_PHRASE)) {
    html += esc(source.slice(last, match.index));
    html += sinDatoHtml();
    last = match.index + match[0].length;
  }
  html += esc(source.slice(last));
  return html;
}

export function emptyBlock() {
  return `<p class="sin-dato-block">${sinDatoHtml()}</p>`;
}
