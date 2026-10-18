const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function longDate(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function tiebreak(raw) {
  if (!raw) return '';
  const loser = raw.includes('-') ? raw.split('-').pop() : raw;
  return `(${loser})`;
}

function parseSet(token) {
  const match = token.trim().match(/^(\d+)-(\d+)(?:\(([^)]+)\))?(\s*ret\.)?$/i);
  if (!match) return null;
  return {
    left: match[1],
    right: match[2],
    tie: match[3] || '',
    ret: match[4] || '',
  };
}

function renderSet(set, flip) {
  const left = flip ? set.right : set.left;
  const right = flip ? set.left : set.right;
  return `${left}-${right}${tiebreak(set.tie)}${set.ret}`;
}

export function formatSets(score, flip) {
  const parts = String(score).trim().split(/\s+/).filter(Boolean).map((token) => {
    const set = parseSet(token);
    return set ? renderSet(set, flip) : token;
  });
  if (parts.length <= 1) return parts[0] || '';
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

function roundClause(round, tournament) {
  if (/^final$/i.test(round)) return `la final del ${tournament}`;
  if (/^final de /i.test(round)) return `la ${round.toLowerCase()} del ${tournament}`;
  const lower = round.charAt(0).toLowerCase() + round.slice(1);
  return `en ${lower} del ${tournament}`;
}

export function latestMatch(playerName, results) {
  const hits = results
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => match.winner === playerName || match.loser === playerName);
  hits.sort((a, b) => b.match.date.localeCompare(a.match.date) || a.index - b.index);
  return hits[0]?.match || null;
}

export function resultSentence(playerName, match) {
  const won = match.winner === playerName;
  const opponent = won ? match.loser : match.winner;
  const score = formatSets(match.score, !won);
  const verb = won ? 'Ganó' : 'Perdió';
  return `${verb} ${roundClause(match.round, match.tournament)} ante ${opponent} por ${score} (${longDate(match.date)}).`;
}

export function bioWithoutVitals(paragraphs) {
  const out = [];
  for (const para of paragraphs || []) {
    for (const sentence of String(para).split(/(?<=\.)\s+/)) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (/naci[óo]/.test(lower) && /representa a chile/.test(lower)) {
        out.push('Representa a Chile.');
        continue;
      }
      const onlyVitals = /naci[óo]|mide\b/.test(lower)
        && !/entrena|empez[óo]|compite|representa|academia/.test(lower);
      if (onlyVitals) continue;
      out.push(trimmed);
    }
  }
  return out;
}
