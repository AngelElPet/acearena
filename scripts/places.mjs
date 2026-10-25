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

const EXONYMS = [
  [/(?<![\p{L}])Tokyo(?![\p{L}])/giu, 'Tokio'],
  [/(?<![\p{L}])Shanghai(?![\p{L}])/giu, 'Shanghái'],
  [/(?<![\p{L}])Queretaro(?![\p{L}])/giu, 'Querétaro'],
  [/(?<![\p{L}])Sopo(?![\p{L}])/giu, 'Sopó'],
];

const COUNTRY_CODES = {
  AUS: 'Australia',
  AUT: 'Austria',
  ARG: 'Argentina',
  ANG: 'Angola',
  BEL: 'Bélgica',
  BLR: 'Bielorrusia',
  BOL: 'Bolivia',
  BRA: 'Brasil',
  CAN: 'Canadá',
  CHI: 'Chile',
  CHN: 'China',
  COL: 'Colombia',
  CRO: 'Croacia',
  CZE: 'Chequia',
  ECU: 'Ecuador',
  ESP: 'España',
  FRA: 'Francia',
  GBR: 'Reino Unido',
  GER: 'Alemania',
  GRE: 'Grecia',
  HKG: 'Hong Kong',
  IND: 'India',
  ITA: 'Italia',
  JPN: 'Japón',
  KOR: 'Corea del Sur',
  MAR: 'Marruecos',
  MEX: 'México',
  MON: 'Mónaco',
  NED: 'Países Bajos',
  NZL: 'Nueva Zelanda',
  PHI: 'Filipinas',
  POL: 'Polonia',
  POR: 'Portugal',
  QAT: 'Catar',
  ROU: 'Rumanía',
  RSA: 'Sudáfrica',
  SGP: 'Singapur',
  SUI: 'Suiza',
  SVK: 'Eslovaquia',
  SWE: 'Suecia',
  THA: 'Tailandia',
  TUN: 'Túnez',
  TUR: 'Turquía',
  UAE: 'Emiratos Árabes Unidos',
  UKR: 'Ucrania',
  URU: 'Uruguay',
  USA: 'Estados Unidos',
  UZB: 'Uzbekistán',
};

export function placeEs(value) {
  if (value == null) return value;
  let text = String(value);
  if (text === '' || text === 'sin dato') return text;
  for (const [from, to] of REPLACEMENTS) text = text.replaceAll(from, to);
  text = text.replace(/, ([A-Z]{3})\b/g, (match, code) => (COUNTRY_CODES[code] ? `, ${COUNTRY_CODES[code]}` : match));
  if (/^[\p{Lu}0-9][\p{Lu}0-9 .'+-]{3,}$/u.test(text) && !/\b(?:ATP|WTA)\b/.test(text)) {
    text = text.toLocaleLowerCase('es').replace(/(^|[\s'-])(\p{L})/gu, (_match, boundary, letter) => boundary + letter.toLocaleUpperCase('es'));
  }
  for (const [pattern, to] of EXONYMS) text = text.replace(pattern, to);
  text = text.replace(/^([^,]+),\s*\1$/iu, '$1');
  return text;
}

function foldPlace(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function cityIfNew(name, city) {
  const shown = placeEs(city);
  const title = placeEs(name);
  if (!shown || shown === 'sin dato') return '';
  const core = foldPlace(String(shown).split(',')[0].trim());
  if (core && foldPlace(title).includes(core)) return '';
  return shown;
}

export function surfaceEs(value) {
  const text = placeEs(value);
  if (!text || text === 'sin dato') return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
