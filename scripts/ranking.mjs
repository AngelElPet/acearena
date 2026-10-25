const DISPLAY_NAMES = {
  'felix auger aliassime': 'Félix Auger-Aliassime',
  'jakub mensik': 'Jakub Menšík',
  'jiri lehecka': 'Jiří Lehečka',
  'karolina muchova': 'Karolína Muchová',
  'linda noskova': 'Linda Nosková',
  'iga swiatek': 'Iga Świątek',
  'maja chwalinska': 'Maja Chwalińska',
  'iva jovic': 'Iva Jović',
  'sorana cirstea': 'Sorana Cîrstea',
  'daniel merida': 'Daniel Mérida',
  'martin landaluce': 'Martín Landaluce',
  'pablo carreno busta': 'Pablo Carreño Busta',
};

export function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function displayName(name) {
  const key = normalizeName(name);
  return DISPLAY_NAMES[key] || name;
}

export function pointsNumber(value) {
  if (value == null) return null;
  const digits = String(value).trim().replace(/\./g, '').replace(/\s/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

export function formatPoints(value) {
  const number = pointsNumber(value);
  if (number == null) return '';
  return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function rowName(row) {
  return row.player || row.name;
}

export function createRankingIndex(rankings) {
  const byTour = { ATP: new Map(), WTA: new Map() };
  const add = (tour, row) => {
    const key = normalizeName(rowName(row));
    if (!key) return;
    byTour[tour].set(key, {
      tour,
      name: displayName(rowName(row)),
      position: String(row.position ?? row.rank),
      points: String(pointsNumber(row.points)),
    });
  };
  for (const row of rankings.directory?.atp || []) add('ATP', row);
  for (const row of rankings.directory?.wta || []) add('WTA', row);
  for (const row of rankings.atp?.rows || []) add('ATP', row);
  for (const row of rankings.wta?.rows || []) add('WTA', row);
  return {
    asOf: rankings.asOf,
    lookup(tour, name) {
      return byTour[tour]?.get(normalizeName(name)) || null;
    },
  };
}

function sameRank(left, right) {
  return String(left.position) === String(right.position)
    && pointsNumber(left.points) === pointsNumber(right.points);
}

function checkPlayer(errors, ranking, label, tour, name, position, points) {
  const row = ranking.lookup(tour, name);
  if (!row) {
    errors.push(`${label}: ${tour} ${name} no está en data/rankings.json`);
    return;
  }
  if (!sameRank(row, { position, points })) {
    errors.push(`${label}: ${name} tiene ${position} y ${points}, y el ranking único tiene ${row.position} y ${formatPoints(row.points)}`);
  }
}

export function validateRankings({ rankings, players, countries, spain }) {
  const errors = [];
  if (!rankings || rankings.asOf !== '2026-10-19') {
    errors.push('rankings.asOf debe ser la lista oficial del 2026-10-19');
  }
  if (countries?.atpAsOf !== rankings?.asOf) errors.push('countries.atpAsOf no coincide con rankings.asOf');
  if (countries?.wtaAsOf !== rankings?.asOf) errors.push('countries.wtaAsOf no coincide con rankings.asOf');
  if (spain?.atpAsOf !== rankings?.asOf) errors.push('spain.atpAsOf no coincide con rankings.asOf');
  if (spain?.wtaAsOf !== rankings?.asOf) errors.push('spain.wtaAsOf no coincide con rankings.asOf');
  const ranking = createRankingIndex(rankings);
  for (const [tour, rows] of [['ATP', rankings.atp?.rows], ['WTA', rankings.wta?.rows]]) {
    if (!Array.isArray(rows) || rows.length < 20) {
      errors.push(`rankings.${tour.toLowerCase()}.rows necesita el top 20`);
      continue;
    }
    rows.slice(0, 20).forEach((row, index) => {
      const expected = String(index + 1);
      if (String(row.position) !== expected) errors.push(`rankings ${tour} puesto ${row.position} no sigue el orden ${expected}`);
      checkPlayer(errors, ranking, `rankings.${tour.toLowerCase()}.rows[${index}]`, tour, row.player, row.position, row.points);
    });
  }
  for (const player of players?.players || []) {
    checkPlayer(errors, ranking, `players ${player.slug}`, player.tour, player.name, player.ranking?.position, player.ranking?.points);
    if (player.ranking?.asOf !== rankings.asOf) {
      errors.push(`players ${player.slug}: ranking.asOf ${player.ranking?.asOf} no es ${rankings.asOf}`);
    }
  }
  for (const country of countries?.countries || []) {
    for (const player of [...(country.atp || []), ...(country.wta || [])]) {
      checkPlayer(errors, ranking, `countries ${country.slug}`, player.tour, player.name, player.rank, player.points);
    }
  }
  for (const player of [...(spain?.atp || []), ...(spain?.wta || [])]) {
    checkPlayer(errors, ranking, 'spain', player.tour, player.name, player.rank, player.points);
  }
  return errors;
}
