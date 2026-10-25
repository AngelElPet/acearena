const REPLACEMENTS = [
  ['PERTH + SYDNEY', 'Perth y Sídney'],
  ['Auckland, New Zealand', 'Auckland, Nueva Zelanda'],
  ['New Zealand', 'Nueva Zelanda'],
  ['Great Britain', 'Gran Bretaña'],
  ['United States', 'Estados Unidos'],
  ['U.S.A.', 'Estados Unidos'],
  ['Tokyo, Japan', 'Tokio, Japón'],
  ['Mallorca, Spain', 'Mallorca, España'],
  ['Mallorca, ESP', 'Mallorca, España'],
  [', ESP', ', España'],
  ['MALLORCA', 'Mallorca'],
  ['Seville', 'Sevilla'],
  [', SPAIN', ', España'],
  [' SPAIN', ' España'],
  ['Spain', 'España'],
  ['Japan', 'Japón'],
  ['Germany', 'Alemania'],
  ['France', 'Francia'],
  ['Brazil', 'Brasil'],
  ['Netherlands', 'Países Bajos'],
  ['Switzerland', 'Suiza'],
  ['Sweden', 'Suecia'],
  ['Italy', 'Italia'],
  ['Croatia', 'Croacia'],
  ['Morocco', 'Marruecos'],
  ['Mexico', 'México'],
  ['Argentina', 'Argentina'],
  ['Chile', 'Chile'],
  ['Austria', 'Austria'],
];

export function placeEs(value) {
  if (value == null) return value;
  let text = String(value);
  if (text === '' || text === 'sin dato') return text;
  for (const [from, to] of REPLACEMENTS) text = text.replaceAll(from, to);
  if (/^[\p{Lu}0-9][\p{Lu}0-9 .'+-]{3,}$/u.test(text) && !/\b(?:ATP|WTA)\b/.test(text)) {
    text = text.toLocaleLowerCase('es').replace(/(^|[\s'-])(\p{L})/gu, (_match, boundary, letter) => boundary + letter.toLocaleUpperCase('es'));
  }
  return text;
}

export function surfaceEs(value) {
  const text = placeEs(value);
  if (!text || text === 'sin dato') return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
