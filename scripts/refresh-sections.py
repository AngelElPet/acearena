#!/usr/bin/env python3
"""Regenera los datos de Jugadores por país, Tenis en España, torneos, cara a cara y horarios.

Fuentes: informes PDF enlazados desde la ATP (protennislive.com), la API pública de la WTA
y Wikimedia Commons para las fotos. Lo que no está en esas fuentes queda como "sin dato".

Uso:
  python3 scripts/refresh-sections.py

Requiere poppler-utils (pdftotext) y las dependencias de Node (sharp) para las fotos.
Los PDF y las respuestas crudas se guardan en data/.cache/ y no forman parte del sitio.
"""

from __future__ import annotations

import html
import json
import re
import subprocess
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
CACHE = DATA / '.cache'
PUBLIC = ROOT / 'public'
PHOTO_DIR = PUBLIC / 'photos' / 'jugadores'
UA = 'AceArena/1.0 (+https://acearena.io; hola@acearena.io)'
TODAY = date.today().isoformat()
RANK_AS_OF = '2026-10-19'
REPORT_AS_OF = '2026-10-18'
MISSING = 'sin dato'

ATP_NUMERICAL = 'http://www.protennislive.com/posting/ramr/singles_entry_numerical.pdf'
ATP_AGE = 'http://www.protennislive.com/posting/ramr/singles_rankings_by_age.pdf'
ATP_PRIZE = 'http://www.protennislive.com/posting/ramr/current_prize.pdf'
ATP_FINALS = 'http://www.protennislive.com/posting/ramr/finals_atp.pdf'
ATP_CHALLENGERS = 'http://www.protennislive.com/posting/ramr/finals_challengers.pdf'
ATP_CALENDAR = 'https://www.atptour.com/en/tournaments'
# Categorías comprobadas a mano en el calendario oficial de atptour.com (25 de octubre de 2026).
ATP_VERIFIED_CATEGORIES = {'Barcelona, Spain': 'ATP 500', 'Mallorca, Spain': 'ATP 250'}
ATP_MEDIA = 'https://edx.atptour.com/en/media/rankings-and-stats'
WTA_RANK_API = 'https://api.wtatennis.com/tennis/players/ranked'
WTA_PLAYER_PAGE = 'https://www.wtatennis.com/players/{id}/{slug}'
WTA_TOURNAMENTS = 'https://api.wtatennis.com/tennis/tournaments'

COUNTRIES = {
    'ESP': 'España', 'FRA': 'Francia', 'ITA': 'Italia', 'GER': 'Alemania', 'USA': 'Estados Unidos',
    'GBR': 'Reino Unido', 'AUS': 'Australia', 'CAN': 'Canadá', 'JPN': 'Japón', 'CHN': 'China',
    'KAZ': 'Kazajistán', 'SRB': 'Serbia', 'CZE': 'Chequia', 'POL': 'Polonia', 'BEL': 'Bélgica',
    'AUT': 'Austria', 'HUN': 'Hungría', 'SVK': 'Eslovaquia', 'NOR': 'Noruega', 'SWE': 'Suecia',
    'FIN': 'Finlandia', 'EST': 'Estonia', 'LTU': 'Lituania', 'UKR': 'Ucrania', 'BLR': 'Bielorrusia',
    'RUS': 'Rusia', 'IND': 'India', 'ARG': 'Argentina', 'BRA': 'Brasil', 'CHI': 'Chile',
    'PER': 'Perú', 'ECU': 'Ecuador', 'COL': 'Colombia', 'MEX': 'México', 'URU': 'Uruguay',
    'PAR': 'Paraguay', 'BOL': 'Bolivia', 'VEN': 'Venezuela', 'CRC': 'Costa Rica',
    'DOM': 'República Dominicana', 'PUR': 'Puerto Rico', 'RSA': 'Sudáfrica', 'MAR': 'Marruecos',
    'TUN': 'Túnez', 'EGY': 'Egipto', 'TUR': 'Turquía', 'GRE': 'Grecia', 'POR': 'Portugal',
    'NED': 'Países Bajos', 'SUI': 'Suiza', 'MON': 'Mónaco', 'CRO': 'Croacia', 'SLO': 'Eslovenia',
    'BIH': 'Bosnia y Herzegovina', 'ROU': 'Rumanía', 'BUL': 'Bulgaria', 'DEN': 'Dinamarca',
    'LAT': 'Letonia', 'IRL': 'Irlanda', 'NZL': 'Nueva Zelanda', 'TPE': 'China Taipéi',
    'HKG': 'Hong Kong', 'KOR': 'Corea del Sur', 'THA': 'Tailandia', 'INA': 'Indonesia',
    'MAS': 'Malasia', 'VIE': 'Vietnam', 'PHI': 'Filipinas', 'SGP': 'Singapur', 'QAT': 'Catar',
    'UAE': 'Emiratos Árabes Unidos', 'ISR': 'Israel', 'CYP': 'Chipre', 'LUX': 'Luxemburgo',
    'AND': 'Andorra', 'MNE': 'Montenegro', 'MKD': 'Macedonia del Norte', 'ALB': 'Albania',
    'GEO': 'Georgia', 'ARM': 'Armenia', 'AZE': 'Azerbaiyán', 'UZB': 'Uzbekistán',
    'KGZ': 'Kirguistán', 'MDA': 'Moldavia', 'BAN': 'Bangladés', 'SRI': 'Sri Lanka',
    'PAK': 'Pakistán', 'LIB': 'Líbano', 'JOR': 'Jordania', 'KSA': 'Arabia Saudí',
    'KUW': 'Kuwait', 'BAR': 'Barbados', 'JAM': 'Jamaica', 'TTO': 'Trinidad y Tobago',
    'BAH': 'Bahamas', 'GUA': 'Guatemala', 'HON': 'Honduras', 'ESA': 'El Salvador',
    'NCA': 'Nicaragua', 'PAN': 'Panamá', 'CUB': 'Cuba', 'HAI': 'Haití', 'ZIM': 'Zimbabue',
    'NGR': 'Nigeria', 'KEN': 'Kenia', 'ALG': 'Argelia', 'LIE': 'Liechtenstein',
    'MLT': 'Malta', 'SMR': 'San Marino', 'KOS': 'Kosovo', 'ISL': 'Islandia',
    'MGL': 'Mongolia', 'TJK': 'Tayikistán', 'IRI': 'Irán', 'IRQ': 'Irak', 'SYR': 'Siria',
    'OMA': 'Omán', 'BRN': 'Baréin', 'NEP': 'Nepal', 'CAM': 'Camboya', 'LAO': 'Laos',
    'MYA': 'Myanmar', 'BRU': 'Brunéi', 'FIJ': 'Fiyi', 'PNG': 'Papúa Nueva Guinea',
    'SAM': 'Samoa', 'TGA': 'Tonga', 'SUR': 'Surinam', 'GUY': 'Guyana', 'BER': 'Bermudas',
    'LCA': 'Santa Lucía', 'GRN': 'Granada', 'NAM': 'Namibia', 'BOT': 'Botsuana',
    'MRI': 'Mauricio', 'MAD': 'Madagascar', 'CMR': 'Camerún', 'SEN': 'Senegal',
    'GHA': 'Ghana', 'TUN': 'Túnez', 'CIV': 'Costa de Marfil', 'TOG': 'Togo',
    'BEN': 'Benín', 'GAB': 'Gabón', 'CGO': 'Congo', 'COD': 'República Democrática del Congo',
    'ZAM': 'Zambia', 'MAW': 'Malaui', 'MOZ': 'Mozambique', 'ANG': 'Angola',
    'ETH': 'Etiopía', 'UGA': 'Uganda', 'TAN': 'Tanzania', 'RWA': 'Ruanda',
    'SUD': 'Sudán', 'SSD': 'Sudán del Sur', 'CPV': 'Cabo Verde', 'SEY': 'Seychelles',
    'COM': 'Comoras', 'MTN': 'Mauritania', 'GAM': 'Gambia', 'GUI': 'Guinea',
    'GBS': 'Guinea-Bisáu', 'SLE': 'Sierra Leona', 'LBR': 'Liberia', 'MLI': 'Mali',
    'BUR': 'Burkina Faso', 'NIG': 'Níger', 'CHA': 'Chad', 'CAF': 'República Centroafricana',
    'GEQ': 'Guinea Ecuatorial', 'LES': 'Lesoto', 'SWZ': 'Esuatini', 'BDI': 'Burundi',
    'DJI': 'Yibuti', 'ERI': 'Eritrea', 'SOM': 'Somalia', 'PLE': 'Palestina',
    'YEM': 'Yemen', 'AFG': 'Afganistán', 'TKM': 'Turkmenistán', 'PRK': 'Corea del Norte',
    'MDV': 'Maldivas', 'BHU': 'Bután', 'TLS': 'Timor Oriental', 'ARU': 'Aruba',
    'CUW': 'Curazao', 'CAY': 'Islas Caimán', 'ISV': 'Islas Vírgenes de EE. UU.',
    'IVB': 'Islas Vírgenes Británicas', 'VIN': 'San Vicente y las Granadinas',
    'SKN': 'San Cristóbal y Nieves', 'DMA': 'Dominica', 'TAH': 'Polinesia Francesa',
    'PYF': 'Polinesia Francesa', 'NCL': 'Nueva Caledonia', 'COK': 'Islas Cook',
    'SOL': 'Islas Salomón', 'VAN': 'Vanuatu', 'GUM': 'Guam', 'ASA': 'Samoa Americana',
    'FSM': 'Micronesia', 'PLW': 'Palaos', 'MHL': 'Islas Marshall', 'NRU': 'Nauru',
    'TUV': 'Tuvalu', 'KIR': 'Kiribati', 'ANT': 'Antillas Neerlandesas',
    'NMI': 'Islas Marianas del Norte', 'FRO': 'Islas Feroe', 'GIB': 'Gibraltar',
    'MAC': 'Macao', 'HKG': 'Hong Kong', 'PUR': 'Puerto Rico',
}

MONTHS = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}
SLAM_NAMES = ('australian open', 'roland garros', 'wimbledon', 'us open')
WTA_TOUR_LEVELS = {
    'Grand Slam', 'WTA 1000', 'WTA 500', 'WTA 250', 'WTA 125', 'WTA Finals',
    'WTA Championships', 'Finals', 'Premier', 'International',
}


def fetch(url: str, timeout: int = 60, accept: str | None = None, retries: int = 4, backoff: float = 1.5) -> bytes:
    headers = {'User-Agent': UA}
    if accept:
        headers['Accept'] = accept
    request = urllib.request.Request(url, headers=headers)
    last_error = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code in (429, 503) and attempt + 1 < retries:
                time.sleep(backoff * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            if attempt + 1 < retries:
                time.sleep(backoff * (attempt + 1))
                continue
            raise
    raise last_error


def fetch_json(url: str):
    return json.loads(fetch(url, accept='application/json').decode('utf-8'))


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1000:
        return
    dest.write_bytes(fetch(url, timeout=120))


def pdf_text(path: Path) -> str:
    cached = path.with_suffix('.txt')
    if cached.exists() and cached.stat().st_mtime >= path.stat().st_mtime:
        return cached.read_text(encoding='utf-8', errors='replace')
    text = subprocess.check_output(['pdftotext', '-layout', str(path), '-'], text=True, errors='replace')
    cached.write_text(text, encoding='utf-8')
    return text


def norm(value: str) -> str:
    text = unicodedata.normalize('NFKD', value or '')
    text = ''.join(char for char in text if not unicodedata.combining(char))
    text = text.lower().replace("'", '').replace('’', '').replace('-', ' ')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def slugify(value: str) -> str:
    text = norm(value).replace(' ', '-')
    text = re.sub(r'-+', '-', text).strip('-')
    return text or 'sin-nombre'


def display_name(last_first: str) -> str:
    cleaned = re.sub(r'\s+', ' ', last_first).strip(' ,')
    if ',' not in cleaned:
        return cleaned
    last, first = cleaned.split(',', 1)
    return f'{first.strip()} {last.strip()}'.strip()


def parse_us_date(value: str) -> str | None:
    match = re.search(r'([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})', value or '')
    if not match:
        return None
    month = MONTHS.get(match.group(1)[:3].lower())
    if not month:
        return None
    return f'{int(match.group(3)):04d}-{month:02d}-{int(match.group(2)):02d}'


def age_on(birth: str, on: str) -> str:
    if not birth or birth == MISSING:
        return MISSING
    by, bm, bd = (int(part) for part in birth.split('-'))
    oy, om, od = (int(part) for part in on.split('-'))
    years = oy - by - ((om, od) < (bm, bd))
    return str(years) if years >= 0 else MISSING


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))
    return default


def place_es(value):
    """Escribe 'España' en lugar de 'Spain' en nombres de lugar."""
    if not isinstance(value, str):
        return value
    return re.sub(r'\bSpain\b', 'España', value)


def save_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def strip_tags(value: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', html.unescape(value or ''))
    return re.sub(r'\s+', ' ', text).strip()


def parse_rankings(text: str) -> list[dict]:
    rows = []
    pattern = re.compile(
        r'^\s*(\d+)\s+(.+?)\s+(?:\(([A-Z]{3})\))?\s+'
        r'(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$'
    )
    for raw in text.splitlines():
        line = raw.replace('\f', '').rstrip()
        match = pattern.match(line)
        if not match:
            continue
        rank = int(match.group(1))
        rows.append({
            'rank': rank,
            'name': display_name(match.group(2)),
            'rawName': re.sub(r'\s+', ' ', match.group(2)).strip(),
            'country': match.group(3) or '',
            'points': match.group(4),
            'tournaments': match.group(8),
        })
    # The report prints a running rank. Keep the first sighting of each rank.
    seen = set()
    unique = []
    for row in rows:
        if row['rank'] in seen:
            continue
        seen.add(row['rank'])
        unique.append(row)
    unique.sort(key=lambda row: row['rank'])
    return unique


def parse_ages(text: str) -> dict[str, str]:
    found = {}
    pattern = re.compile(
        r'^\s*\d+\s+yrs\s+\d+\s+mo\s+(.+?)\s+(\d+)\s+(?:\(([A-Z]{3}))?\s*'
        r'([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\s*$'
    )
    for raw in text.splitlines():
        match = pattern.match(raw.replace('\f', '').rstrip())
        if not match:
            continue
        iso = parse_us_date(match.group(4))
        if not iso:
            continue
        found[norm(display_name(match.group(1)))] = iso
    return found


def parse_prizes(text: str) -> dict[str, dict]:
    found = {}
    pattern = re.compile(
        r'^\s*\d+T?\s+(.+?)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)\s*$'
    )
    for raw in text.splitlines():
        match = pattern.match(raw.replace('\f', '').rstrip())
        if not match:
            continue
        key = norm(display_name(match.group(1)))
        if key in found:
            continue
        found[key] = {
            'season': match.group(2).replace(',', ''),
            'career': match.group(5).replace(',', ''),
            'currency': 'USD',
        }
    return found


def clean_player_side(value: str) -> str:
    text = re.sub(r'\s+', ' ', value).strip(' ,')
    text = re.sub(r'\s*\(\d+\)\s*$', '', text).strip()
    return display_name(text)


def parse_finals(text: str, kind: str) -> list[dict]:
    lines = []
    for raw in text.splitlines():
        line = raw.replace('\f', '').rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('2026 ATP') or stripped.startswith('2026 Challenger'):
            continue
        if stripped.startswith('Winner'):
            continue
        if re.search(r'Page\s+\d+\s+of\s+\d+', stripped):
            continue
        if stripped.startswith('Tournament/'):
            continue
        lines.append(stripped)

    events = []
    index = 0
    while index < len(lines):
        if 'Singles Draw:' not in lines[index]:
            index += 1
            continue
        header = lines[index]
        location = lines[index - 1] if index else ''
        if 'Singles Draw:' in location:
            location = ''
        draw = re.search(r'Singles Draw:\s*(\d+)', header)
        surface = re.search(r'Surface:\s*([A-Za-z]+)', header)
        purse = re.search(r'Total Purse\s*:\s*([^\s]+)', header)
        starting = re.search(r'Starting:\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})', header)
        block = []
        index += 1
        while index < len(lines) and 'Singles Draw:' not in lines[index]:
            if index + 1 < len(lines) and 'Singles Draw:' in lines[index + 1]:
                break
            block.append(lines[index])
            index += 1
        merged = []
        for line in block:
            extra = line.strip()
            wrapped_name = ' / ' not in extra and len(extra.split()) <= 3 and extra[:1].isalpha()
            if ' d. ' in line:
                merged.append(line)
            elif merged and wrapped_name:
                left, right = merged[-1].split(' d. ', 1)
                rank = re.search(r'\s*\(\d+\)\s*$', left)
                if rank:
                    left = f'{left[:rank.start()].rstrip()} {extra} {rank.group(0).strip()}'
                else:
                    left = f'{left.rstrip()} {extra}'
                merged[-1] = f'{left} d. {right}'
        singles = []
        for line in merged:
            if ' / ' in line.split(' d. ', 1)[0]:
                continue
            parts = line.split(' d. ', 1)
            if len(parts) != 2:
                continue
            score_match = re.search(
                r'((?:\d+-\d+(?:\(\d+\))?(?:\s+[A-Za-z.]+)?)'
                r'(?:\s*,\s*\d+-\d+(?:\(\d+\))?(?:\s+[A-Za-z.]+)?)*)\s*$',
                parts[1],
            )
            if not score_match:
                continue
            score = re.sub(r'\s+', ' ', score_match.group(1)).strip()
            opponent = parts[1][:score_match.start()]
            singles.append({
                'champion': clean_player_side(parts[0]),
                'finalist': clean_player_side(opponent),
                'score': score,
            })
        if not singles:
            continue
        place = re.sub(r'\s+', ' ', location).strip(' ,')
        category = MISSING
        low = place.lower()
        if any(name in low for name in SLAM_NAMES):
            category = 'Grand Slam'
        elif 'masters 1000' in low:
            category = 'ATP Masters 1000'
        elif kind == 'challenger':
            category = 'Challenger'
        elif kind != 'challenger' and place in ATP_VERIFIED_CATEGORIES:
            category = ATP_VERIFIED_CATEGORIES[place]
        events.append({
            'name': place,
            'category': category,
            'surface': surface.group(1) if surface else MISSING,
            'draw': draw.group(1) if draw else MISSING,
            'purse': purse.group(1) if purse else MISSING,
            'startDate': parse_us_date(starting.group(1)) if starting else MISSING,
            'champion': singles[0]['champion'],
            'finalist': singles[0]['finalist'],
            'score': singles[0]['score'],
            'kind': kind,
        })
    return events


def wta_rankings() -> list[dict]:
    cache = CACHE / 'wta-rankings.json'
    cached = load_json(cache, None)
    if isinstance(cached, list) and cached:
        return cached
    rows = []
    page = 0
    while page < 40:
        url = f'{WTA_RANK_API}?page={page}&pageSize=100&type=rankSingles&sort=asc&metric=SINGLES'
        batch = fetch_json(url)
        if not isinstance(batch, list) or not batch:
            break
        for item in batch:
            player = item.get('player') or {}
            rows.append({
                'id': player.get('id'),
                'name': player.get('fullName') or '',
                'country': player.get('countryCode') or '',
                'birthDate': (player.get('dateOfBirth') or '')[:10],
                'rank': int(item.get('ranking') or 0),
                'points': str(item.get('points') if item.get('points') is not None else ''),
                'tournaments': str(item.get('tournamentsPlayed') if item.get('tournamentsPlayed') is not None else ''),
                'rankedAt': (item.get('rankedAt') or '')[:10],
            })
        if len(batch) < 100:
            break
        page += 1
    save_json(cache, rows)
    return rows


def wta_tournaments() -> list[dict]:
    cache = CACHE / 'wta-tournaments.json'
    cached = load_json(cache, None)
    if isinstance(cached, list) and cached:
        return cached
    found = []
    seen_2026 = False
    for page in range(300, 460):
        payload = fetch_json(f'{WTA_TOURNAMENTS}?page={page}&pageSize=50')
        content = payload if isinstance(payload, list) else (payload.get('content') or [])
        if not content:
            if seen_2026:
                break
            continue
        years = [item.get('year') or 0 for item in content if isinstance(item, dict)]
        if not years or max(years) < 2026:
            continue
        if min(years) > 2026 and seen_2026:
            break
        for item in content:
            if item.get('year') != 2026:
                continue
            seen_2026 = True
            winners = item.get('winners') or []
            singles = None
            if isinstance(winners, list):
                for winner in winners:
                    player = ((winner or {}).get('singles') or {}).get('player') or {}
                    if player.get('fullName'):
                        singles = player.get('fullName')
                        break
            group = item.get('tournamentGroup') or {}
            found.append({
                'id': group.get('id'),
                'name': item.get('title') or group.get('name') or '',
                'group': group.get('name') or '',
                'level': item.get('level') or group.get('level') or '',
                'city': item.get('city') or '',
                'country': item.get('country') or '',
                'startDate': item.get('startDate') or '',
                'endDate': item.get('endDate') or '',
                'surface': item.get('surface') or '',
                'indoor': item.get('inOutdoor') or '',
                'champion': singles or '',
                'prize': item.get('prizeMoney'),
                'currency': item.get('prizeMoneyCurrency') or '',
            })
    save_json(cache, found)
    return found


def wta_slug(name: str) -> str:
    return slugify(name)


def parse_profile(page: str) -> dict:
    stats_match = re.search(r'data-player-stats="([^"]+)"', page)
    stats = {}
    if stats_match:
        try:
            stats = json.loads(html.unescape(stats_match.group(1)))
        except json.JSONDecodeError:
            stats = {}
    ytd = ((stats.get('ytd') or {}).get('singles') or {})
    career = ((stats.get('career') or {}).get('singles') or {})

    def block(title: str) -> str:
        match = re.search(
            rf'profile-bio__info-title">\s*{re.escape(title)}\s*</h2>\s*<span[^>]*>\s*([^<]+)',
            page,
        )
        return re.sub(r'\s+', ' ', match.group(1)).strip() if match else ''

    def ld_value(name: str) -> str:
        match = re.search(
            rf'"name"\s*:\s*"{re.escape(name)}"\s*,\s*"value"\s*:\s*"([^"]*)"',
            page,
        )
        return re.sub(r'\s+', ' ', html.unescape(match.group(1))).strip() if match else ''

    career_high = block('Career High') or ld_value('Career High Singles') or ld_value('Career High')
    if not re.fullmatch(r'\d+', career_high or ''):
        rank = career.get('rank')
        if career.get('highRankDate') and isinstance(rank, int):
            career_high = str(rank)
        else:
            career_high = ''
    return {
        'handRaw': block('Plays') or ld_value('Plays'),
        'careerHighRaw': career_high,
        'heightRaw': block('Height') or ld_value('Height'),
        'titlesSeason': ytd.get('titles'),
        'titlesCareer': career.get('titles'),
        'prizeSeason': ((stats.get('ytd') or {}).get('prizeMoney')),
        'prizeCareer': ((stats.get('career') or {}).get('prizeMoney')),
        'careerHighDateRaw': career.get('highRankDate') or '',
    }


def number_or_missing(value):
    if isinstance(value, bool) or value is None or value == '':
        return MISSING
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else str(value)
    if isinstance(value, str):
        cleaned = value.replace(',', '').replace('$', '').strip()
        if re.fullmatch(r'\d+(?:\.\d+)?', cleaned):
            return cleaned[:-2] if cleaned.endswith('.0') else cleaned
        return MISSING
    return MISSING


def hand_es(raw: str, tour: str) -> str:
    text = (raw or '').lower()
    if not text:
        return MISSING
    left = 'left' in text or 'zurd' in text
    right = 'right' in text or 'diest' in text
    if tour == 'WTA':
        if left and not right:
            return 'zurda'
        if right and not left:
            return 'diestra'
    else:
        if left and not right:
            return 'zurdo'
        if right and not left:
            return 'diestro'
    return MISSING


def height_from_wta(raw: str) -> str:
    match = re.search(r'\(([\d.,]+)\s*m\)', raw or '', re.I)
    if not match:
        return MISSING
    meters = match.group(1).replace(',', '.')
    return f'{meters.replace(".", ",")} m'


def parse_short_date(raw: str) -> str:
    match = re.search(r'(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})', raw or '')
    if not match:
        return MISSING
    month = MONTHS.get(match.group(2).lower())
    if not month:
        return MISSING
    year = int(match.group(3))
    year += 2000 if year < 70 else 1900
    return f'{year:04d}-{month:02d}-{int(match.group(1)):02d}'


def fetch_profiles(players: list[dict]) -> dict[str, dict]:
    cache_path = CACHE / 'wta-profiles.json'
    cache = load_json(cache_path, {})
    cache = {key: value for key, value in cache.items() if isinstance(value, dict) and not value.get('error')}
    pending = [player for player in players if player.get('id') and str(player['id']) not in cache]

    def one(player: dict):
        url = WTA_PLAYER_PAGE.format(id=player['id'], slug=wta_slug(player['name']))
        try:
            time.sleep(0.6)
            page = fetch(url, timeout=40, retries=2, backoff=4).decode('utf-8', errors='replace')
            parsed = parse_profile(page)
            parsed['profileUrl'] = url
            return str(player['id']), parsed
        except Exception as error:  # noqa: BLE001 — una ficha caída no debe vaciar el resto
            return str(player['id']), {'error': str(error), 'profileUrl': url}

    if pending:
        blocked = 0
        with ThreadPoolExecutor(max_workers=2) as pool:
            for start in range(0, len(pending), 20):
                chunk = pending[start:start + 20]
                futures = [pool.submit(one, player) for player in chunk]
                chunk_errors = 0
                for future in as_completed(futures):
                    key, value = future.result()
                    if value.get('error'):
                        chunk_errors += 1
                        if '429' in value['error']:
                            blocked += 1
                        continue
                    cache[key] = value
                save_json(cache_path, cache)
                print(f'  fichas WTA {min(start + 20, len(pending))}/{len(pending)} guardadas {len(cache)}', flush=True)
                if chunk_errors >= 12 and blocked >= 8:
                    print('  la WTA limita las fichas; el resto queda en sin dato en esta pasada', flush=True)
                    break
    return cache


def existing_players() -> dict[str, dict]:
    payload = json.loads((DATA / 'players.json').read_text(encoding='utf-8'))
    found = {}
    for player in payload['players']:
        found[norm(player['name'])] = player
    return found


def career_high_from_note(note: str) -> str:
    if not note:
        return MISSING
    match = re.search(r'mejor puesto es el (\d+)', note)
    if match:
        return match.group(1)
    match = re.search(r'(\d+)\.º en la lista del lunes 19, el mejor puesto de su carrera', note)
    if match:
        return match.group(1)
    return MISSING


def surface_es(surface: str, indoor: str = '') -> str:
    key = (surface or '').strip().lower()
    labels = {
        'hard': 'pista dura',
        'clay': 'tierra batida',
        'grass': 'hierba',
        'carpet': 'moqueta',
    }
    label = labels.get(key, MISSING if not surface else surface)
    if indoor == 'I' and label != MISSING:
        return f'{label} indoor'
    return label


def clean_credit(value: str) -> str:
    text = re.sub(r'\{\{.*?\}\}', ' ', value or '')
    text = re.sub(r'\s+', ' ', text).strip(' .')
    lowered = text.lower()
    blocked = (
        re.search(r'\btodo\b', lowered)
        or 'placeholder' in lowered
        or 'lorem ipsum' in lowered
        or 'example.com' in lowered
    )
    if not text or blocked:
        return MISSING
    return text[:240]


def license_ok(short: str, code: str) -> bool:
    text = f'{short} {code}'.lower()
    if any(token in text for token in ('noncommercial', 'non-commercial', 'no derivatives', 'fair use', 'all rights reserved')):
        return False
    if re.search(r'(?:^|[^a-z])nc(?:[^a-z]|$)', text) or re.search(r'-nc\b', text):
        return False
    if re.search(r'(?:^|[^a-z])nd(?:[^a-z]|$)', text) or re.search(r'-nd\b', text):
        return False
    if any(token in text for token in ('cc0', 'cc-zero', 'public domain', 'pdm', 'cc by', 'cc-by', 'creativecommons.org/licenses/by')):
        return True
    return 'attribution' in text


def face_photo(categories: list[str], title: str, name: str) -> bool:
    blob = ' '.join(categories + [title]).lower()
    title_text = title.lower()
    if re.search(r'\bvs\.?\b|\bsemi-?finals?\b|\bceremony\b|\bdoubles\b', title_text):
        return False
    banned = ('logo', 'signature', 'autograph', 'flag of', 'coat of arms', 'emblem', 'icon', 'map of', 'ball logo', 'crowd')
    if any(token in blob for token in banned):
        return False
    categories_text = ' '.join(categories).lower()
    if any(token in categories_text for token in ('portrait', 'headshot', 'head shot')):
        return True
    if any(token in title_text for token in ('portrait', 'headshot', 'head shot')):
        return True
    if '(cropped' not in title_text:
        return False
    parts = [part for part in norm(name).split() if len(part) > 2]
    return any(part in norm(title) for part in parts)


def commons_lookup(name: str) -> dict | None:
    time.sleep(0.45)
    search = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'wbsearchentities',
        'search': name,
        'language': 'en',
        'type': 'item',
        'limit': 5,
        'format': 'json',
    })
    try:
        results = fetch_json(search).get('search') or []
    except urllib.error.HTTPError:
        raise
    except Exception:
        return None
    target = norm(name)
    chosen = None
    for item in results:
        label = norm(item.get('label') or '')
        description = (item.get('description') or '').lower()
        if label != target:
            continue
        if any(word in description for word in ('tennis', 'tenis')):
            chosen = item['id']
            break
    if not chosen:
        return None
    entity_url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'wbgetentities',
        'ids': chosen,
        'props': 'claims',
        'format': 'json',
    })
    try:
        entity = fetch_json(entity_url)['entities'][chosen]
    except urllib.error.HTTPError:
        raise
    except Exception:
        return None
    claims = (entity.get('claims') or {}).get('P18') or []
    if not claims:
        return None
    filename = claims[0]['mainsnak'].get('datavalue', {}).get('value')
    if not filename:
        return None
    info_url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query',
        'titles': f'File:{filename}',
        'prop': 'imageinfo|categories',
        'iiprop': 'url|extmetadata|mime',
        'iiurlwidth': 320,
        'cllimit': 50,
        'format': 'json',
    })
    try:
        payload = fetch_json(info_url)
    except urllib.error.HTTPError:
        raise
    except Exception:
        return None
    pages = (payload.get('query') or {}).get('pages') or {}
    page = next(iter(pages.values()), None) if isinstance(pages, dict) else None
    if not page or page.get('missing') is not None:
        return None
    categories = [cat.get('title', '') for cat in page.get('categories') or []]
    image = (page.get('imageinfo') or [{}])[0]
    meta = image.get('extmetadata') or {}
    short = strip_tags((meta.get('LicenseShortName') or {}).get('value', ''))
    code = strip_tags((meta.get('License') or {}).get('value', ''))
    if not license_ok(short, code):
        return None
    if not face_photo(categories, filename, name):
        return None
    thumb = image.get('thumburl') or image.get('url')
    if not thumb:
        return None
    author = clean_credit(strip_tags((meta.get('Artist') or {}).get('value', '')))
    license_url = strip_tags((meta.get('LicenseUrl') or {}).get('value', ''))
    return {
        'author': author,
        'license': short or code,
        'licenseUrl': license_url,
        'sourceUrl': f'https://commons.wikimedia.org/wiki/File:{urllib.parse.quote(filename.replace(" ", "_"))}',
        'fileTitle': filename,
        'thumb': thumb,
    }


def attach_photos(players: list[dict]) -> None:
    cache_path = CACHE / 'photo-index.json'
    cache = load_json(cache_path, {})
    unique = []
    seen = set()
    for player in players:
        if player['slug'] in seen:
            continue
        seen.add(player['slug'])
        unique.append(player)
    pending = [player for player in unique if player['slug'] not in cache]
    if pending:
        blocked = 0
        done = 0
        with ThreadPoolExecutor(max_workers=1) as pool:
            for start in range(0, len(pending), 24):
                chunk = pending[start:start + 24]
                futures = {pool.submit(commons_lookup, player['name']): player for player in chunk}
                for future in as_completed(futures):
                    player = futures[future]
                    try:
                        cache[player['slug']] = future.result()
                    except Exception as error:
                        if '429' in str(error) or '503' in str(error):
                            blocked += 1
                        else:
                            cache[player['slug']] = None
                    done += 1
                save_json(cache_path, cache)
                hits = sum(1 for value in cache.values() if value)
                print(f'  fotos consultadas {done}/{len(pending)} con foto {hits}', flush=True)
                if blocked >= 8:
                    print('  Wikimedia limita las consultas; se reintentan en la siguiente pasada', flush=True)
                    break
        save_json(cache_path, cache)
    jobs = []
    for player in unique:
        meta = cache.get(player['slug'])
        if not meta or not meta.get('thumb'):
            continue
        dest = PHOTO_DIR / f'{player["slug"]}.webp'
        src = CACHE / 'thumbs' / f'{player["slug"]}'
        if dest.exists():
            jobs.append({'dest': str(dest), 'slug': player['slug'], 'measure': True})
            continue
        try:
            src.parent.mkdir(parents=True, exist_ok=True)
            src.write_bytes(fetch(meta['thumb'], timeout=40))
        except Exception:
            cache[player['slug']] = None
            continue
        jobs.append({'src': str(src), 'dest': str(dest), 'slug': player['slug']})
    if jobs:
        PHOTO_DIR.mkdir(parents=True, exist_ok=True)
        manifest = CACHE / 'photo-jobs.json'
        save_json(manifest, jobs)
        subprocess.check_call(['node', str(ROOT / 'scripts' / 'optimize-portraits.mjs'), str(manifest), str(CACHE / 'photo-sizes.json')])
    sizes = load_json(CACHE / 'photo-sizes.json', {})
    by_slug = {player['slug']: player for player in unique}
    for slug, meta in cache.items():
        player = by_slug.get(slug)
        if not player or not meta:
            continue
        size = sizes.get(slug)
        dest = PHOTO_DIR / f'{slug}.webp'
        if not size or not dest.exists():
            continue
        player['photo'] = {
            'src': f'/photos/jugadores/{slug}.webp',
            'width': size['width'],
            'height': size['height'],
            'author': meta.get('author') or MISSING,
            'license': meta.get('license') or MISSING,
            'licenseUrl': meta.get('licenseUrl') or '',
            'sourceName': 'Wikimedia Commons',
            'sourceUrl': meta.get('sourceUrl') or '',
        }


def blank_player(**overrides) -> dict:
    player = {
        'slug': '',
        'name': '',
        'tour': '',
        'rank': MISSING,
        'points': MISSING,
        'birthDate': MISSING,
        'age': MISSING,
        'ageAsOf': RANK_AS_OF,
        'careerHigh': MISSING,
        'careerHighDate': MISSING,
        'hand': MISSING,
        'height': MISSING,
        'titlesSeason': MISSING,
        'titlesSeasonNames': [],
        'titlesCareer': MISSING,
        'grandSlamBest': MISSING,
        'grandSlam2026': MISSING,
        'prizeSeason': MISSING,
        'prizeCareer': MISSING,
        'prizeCurrency': '',
        'tournamentsSeason': MISSING,
        'profileUrl': '',
        'ficha': '',
        'photo': None,
        'sources': [],
    }
    player.update(overrides)
    return player


def title_index(events: list[dict]) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    slams: dict[str, list[str]] = {}
    for event in events:
        if event.get('kind') != 'atp':
            continue
        key = norm(event['champion'])
        found.setdefault(key, [])
        if event['name'] not in found[key]:
            found[key].append(event['name'])
        low = event['name'].lower()
        if any(name in low for name in SLAM_NAMES):
            slams.setdefault(key, [])
            slams[key].append(f"Campeón de {event['name']}")
        finalist = norm(event['finalist'])
        if any(name in low for name in SLAM_NAMES):
            slams.setdefault(finalist, [])
            slams[finalist].append(f"Finalista de {event['name']}")
    return {'titles': found, 'slams': slams}


def build_atp_player(row: dict, ages, prizes, titles, known) -> dict:
    key = norm(row['name'])
    existing = known.get(key)
    name = existing['name'] if existing else row['name']
    birth = (existing or {}).get('birthDate') or ages.get(key) or MISSING
    note = ((existing or {}).get('ranking') or {}).get('note') or ''
    career = career_high_from_note(note)
    prize = prizes.get(key) or {}
    season_titles = titles['titles'].get(key, [])
    slams = titles['slams'].get(key, [])
    sources = [
        {'name': 'ATP, ranking numérico de individuales del 19 de octubre de 2026', 'url': ATP_NUMERICAL},
        {'name': 'ATP, informe de rankings enlazado en Rankings & Media Reports', 'url': ATP_MEDIA},
    ]
    if birth != MISSING and key in ages:
        sources.append({'name': 'ATP, ranking de individuales por edad del 19 de octubre de 2026', 'url': ATP_AGE})
    if prize:
        sources.append({'name': 'ATP, premios de la temporada y de carrera a 19 de octubre de 2026', 'url': ATP_PRIZE})
    if season_titles or slams:
        sources.append({'name': 'ATP, finales ATP y Grand Slam de 2026, informe a 18 de octubre', 'url': ATP_FINALS})
    if existing:
        for source in existing.get('sources') or []:
            if source not in sources:
                sources.append(source)
    player = blank_player(
        slug=existing['slug'] if existing else slugify(name),
        name=name,
        tour='ATP',
        rank=str(row['rank']),
        points=row['points'],
        birthDate=birth,
        age=age_on(birth, RANK_AS_OF),
        careerHigh=career,
        hand=(existing or {}).get('hand') or MISSING,
        height=(existing or {}).get('height') or MISSING,
        titlesSeason=str(len(season_titles)),
        titlesSeasonNames=season_titles,
        grandSlam2026='; '.join(slams) if slams else MISSING,
        prizeSeason=prize.get('season', MISSING),
        prizeCareer=prize.get('career', MISSING),
        prizeCurrency=prize.get('currency', ''),
        tournamentsSeason=row['tournaments'] or MISSING,
        profileUrl=(existing or {}).get('profileUrl') or '',
        ficha=f"jugadores/{existing['slug']}.html" if existing else '',
        sources=sources,
    )
    return player


def build_wta_player(row: dict, profile: dict, known) -> dict:
    key = norm(row['name'])
    existing = known.get(key)
    name = existing['name'] if existing else row['name']
    birth = (existing or {}).get('birthDate') or row.get('birthDate') or MISSING
    profile = profile or {}
    career_raw = profile.get('careerHighRaw') or ''
    career = career_raw if re.fullmatch(r'\d+', career_raw or '') else MISSING
    if career == MISSING:
        career = career_high_from_note(((existing or {}).get('ranking') or {}).get('note') or '')
    titles_season = profile.get('titlesSeason')
    titles_career = profile.get('titlesCareer')
    sources = [
        {'name': 'WTA, ranking de individuales del 19 de octubre de 2026', 'url': 'https://wtafiles.wtatennis.com/pdf/rankings/Singles_Numeric.pdf'},
        {'name': 'WTA, API del ranking de individuales', 'url': WTA_RANK_API},
    ]
    if profile.get('profileUrl'):
        sources.append({'name': f'WTA, ficha de {name}', 'url': profile['profileUrl']})
    if existing:
        for source in existing.get('sources') or []:
            if source not in sources:
                sources.append(source)
    return blank_player(
        slug=existing['slug'] if existing else slugify(name),
        name=name,
        tour='WTA',
        rank=str(row['rank']),
        points=row['points'],
        birthDate=birth,
        age=age_on(birth, row.get('rankedAt') or RANK_AS_OF),
        ageAsOf=row.get('rankedAt') or RANK_AS_OF,
        careerHigh=career,
        careerHighDate=parse_short_date(profile.get('careerHighDateRaw') or ''),
        hand=(existing or {}).get('hand') or hand_es(profile.get('handRaw') or '', 'WTA'),
        height=(existing or {}).get('height') or height_from_wta(profile.get('heightRaw') or ''),
        titlesSeason=number_or_missing(titles_season),
        titlesCareer=number_or_missing(titles_career),
        prizeSeason=number_or_missing(profile.get('prizeSeason')),
        prizeCareer=number_or_missing(profile.get('prizeCareer')),
        prizeCurrency='USD' if number_or_missing(profile.get('prizeSeason')) != MISSING or number_or_missing(profile.get('prizeCareer')) != MISSING else '',
        tournamentsSeason=row.get('tournaments') or MISSING,
        profileUrl=profile.get('profileUrl') or (existing or {}).get('profileUrl') or '',
        ficha=f"jugadores/{existing['slug']}.html" if existing else '',
        sources=sources,
    )


def country_name(code: str) -> str:
    return COUNTRIES.get(code, code)


def select_countries(atp_rows, wta_rows):
    codes = set()
    for row in atp_rows:
        if row['country'] and row['rank'] <= 200:
            codes.add(row['country'])
    for row in wta_rows:
        if row['country'] and row['rank'] <= 200:
            codes.add(row['country'])
    return codes


def top_by_country(rows: list[dict], code: str, limit: int) -> list[dict]:
    chosen = [row for row in rows if row.get('country') == code]
    chosen.sort(key=lambda row: row['rank'])
    return chosen[:limit]


def spain_events(atp_events, challengers, wta_events) -> list[dict]:
    events = []
    for event in atp_events:
        if not re.search(r'\bspain\b', event['name'], re.I):
            continue
        events.append({
            'name': place_es(event['name']),
            'circuit': 'ATP',
            'category': event['category'],
            'startDate': event['startDate'],
            'endDate': MISSING,
            'city': place_es(event['name']),
            'surface': surface_es(event['surface']),
            'sources': [{'name': 'ATP, finales ATP y Grand Slam de 2026', 'url': ATP_FINALS}]
            + ([{'name': 'ATP Tour, calendario 2026 (categoría)', 'url': ATP_CALENDAR}] if event['name'] in ATP_VERIFIED_CATEGORIES else []),
        })
    for event in challengers:
        if not re.search(r'\bspain\b', event['name'], re.I):
            continue
        events.append({
            'name': place_es(event['name']),
            'circuit': 'Challenger',
            'category': 'Challenger',
            'startDate': event['startDate'],
            'endDate': MISSING,
            'city': place_es(event['name']),
            'surface': surface_es(event['surface']),
            'sources': [{'name': 'ATP, finales Challenger de 2026', 'url': ATP_CHALLENGERS}],
        })
    for event in wta_events:
        country = (event.get('country') or '').upper()
        if country not in {'SPAIN', 'ESP'} and not country.startswith('SPAIN'):
            continue
        level = event.get('level') or MISSING
        name = event.get('name') or event.get('group') or MISSING
        city = event.get('city') or event.get('group') or MISSING
        events.append({
            'name': place_es(name),
            'circuit': 'ITF' if level == 'ITF' else 'WTA',
            'category': level,
            'startDate': event.get('startDate') or MISSING,
            'endDate': event.get('endDate') or MISSING,
            'city': place_es(city) if city else MISSING,
            'surface': surface_es(event.get('surface') or '', event.get('indoor') or ''),
            'sources': [{'name': 'WTA, API de torneos (circuito femenino, incluida la ITF)', 'url': WTA_TOURNAMENTS}],
        })
    events.sort(key=lambda event: (event.get('startDate') or '9999', event.get('name') or ''))
    return events


def tournament_pages(atp_events, wta_events) -> list[dict]:
    pages = []
    used = set()
    for event in atp_events:
        slug = slugify(f"{event['name']}-{event['startDate']}")
        if slug in used:
            continue
        used.add(slug)
        pages.append({
            'slug': slug,
            'name': place_es(event['name']),
            'tour': 'ATP',
            'category': event['category'],
            'startDate': event['startDate'],
            'endDate': MISSING,
            'city': place_es(event['name']),
            'surface': surface_es(event['surface']),
            'champion': event['champion'],
            'finalist': event['finalist'],
            'score': event['score'],
            'officialUrl': ATP_FINALS,
            'sources': [
                {'name': 'ATP, finales ATP y Grand Slam de 2026, informe a 18 de octubre', 'url': ATP_FINALS},
            ] + ([{'name': 'ATP Tour, calendario 2026 (categoría)', 'url': ATP_CALENDAR}] if event['name'] in ATP_VERIFIED_CATEGORIES else []),
        })
    for event in wta_events:
        level = event.get('level') or ''
        if level not in WTA_TOUR_LEVELS and 'WTA' not in level and level != 'Grand Slam':
            continue
        slug = slugify(f"wta-{event.get('name') or event.get('group')}-{event.get('startDate')}")
        if slug in used:
            continue
        used.add(slug)
        official = ''
        if event.get('id'):
            official = f"https://www.wtatennis.com/tournaments/{event['id']}/{slugify(event.get('group') or event.get('name') or 'torneo')}/2026"
        pages.append({
            'slug': slug,
            'name': event.get('name') or event.get('group') or MISSING,
            'tour': 'WTA',
            'category': level or MISSING,
            'startDate': event.get('startDate') or MISSING,
            'endDate': event.get('endDate') or MISSING,
            'city': event.get('city') or event.get('country') or MISSING,
            'surface': surface_es(event.get('surface') or '', event.get('indoor') or ''),
            'champion': event.get('champion') or MISSING,
            'finalist': MISSING,
            'score': MISSING,
            'officialUrl': official,
            'sources': [{'name': 'WTA, API de torneos de 2026', 'url': WTA_TOURNAMENTS}],
        })
    pages.sort(key=lambda event: (event.get('startDate') or '9999', event.get('name') or ''))
    return pages


def order_of_play(wta_events) -> dict:
    attempts = []
    checks = [
        ('WTA, página de marcadores', 'https://www.wtatennis.com/scores'),
        ('ATP, Daily Media Notes', 'https://edx.atptour.com/en/media/daily-media-notes'),
    ]
    for name, url in checks:
        try:
            page = fetch(url, timeout=30).decode('utf-8', errors='replace')
        except Exception as error:  # noqa: BLE001
            attempts.append({'name': name, 'url': url, 'result': f'No se pudo leer ({error.__class__.__name__}).'})
            continue
        low = page.lower()
        if 'order of play' in low or 'order-of-play' in low or 'orden de juego' in low:
            result = 'Menciona un orden de juego, sin una lista de partidos con hora de Madrid, Buenos Aires y Ciudad de México que se pueda copiar tal cual.'
        else:
            result = 'No trae un orden de juego con horas.'
        attempts.append({'name': name, 'url': url, 'result': result})
    day = TODAY
    for event in wta_events:
        start = event.get('startDate') or ''
        end = event.get('endDate') or ''
        if not start or not end or not (start <= day <= end):
            continue
        if event.get('level') == 'ITF' or not event.get('id'):
            continue
        url = f"https://www.wtatennis.com/tournaments/{event['id']}/{slugify(event.get('group') or 'torneo')}/2026"
        name = event.get('name') or event.get('group') or 'Torneo WTA'
        try:
            page = fetch(url, timeout=30).decode('utf-8', errors='replace')
        except Exception as error:  # noqa: BLE001
            attempts.append({'name': name, 'url': url, 'result': f'No se pudo leer la ficha ({error.__class__.__name__}).'})
            continue
        low = page.lower()
        if 'order of play' in low or 'order-of-play' in low:
            result = 'La ficha menciona el orden de juego, sin horas ligadas a un partido y a las tres ciudades.'
        else:
            result = 'La ficha no incluye un orden de juego con horas.'
        attempts.append({'name': name, 'url': url, 'result': result})
    return {
        'updated': TODAY,
        'date': day,
        'matches': [],
        'note': (
            f'Consulta del {day}. No hay un orden de juego oficial con horas que se pueda publicar '
            'en Madrid, Buenos Aires y Ciudad de México. Esas horas quedan en sin dato.'
        ),
        'attempts': attempts,
        'zones': {
            'madrid': 'Europe/Madrid',
            'buenosAires': 'America/Argentina/Buenos_Aires',
            'mexicoCity': 'America/Mexico_City',
        },
    }


def head_to_head() -> dict:
    featured = json.loads((DATA / 'featured-ties.json').read_text(encoding='utf-8'))
    ties = []
    for tie in featured['ties']:
        ties.append({
            **tie,
            'h2h': MISSING,
            'h2hNote': 'El historial ATP no se pudo leer: atptour.com responde con un bloqueo desde este entorno. No se copia una cifra de otra nota.',
            'lastA': MISSING,
            'lastB': MISSING,
            'lastNote': 'Los últimos cinco resultados oficiales no están en la previa del cuadro ni en un informe ATP accesible.',
        })
    return {'updated': TODAY, 'note': featured.get('note') or '', 'ties': ties}


def assign_slugs(players: list[dict]) -> None:
    groups: dict[str, list[dict]] = {}
    for player in players:
        groups.setdefault(player['slug'], []).append(player)
    for base, group in groups.items():
        identities = {(player['tour'], player['name'], str(player['rank'])) for player in group}
        if len(identities) <= 1:
            continue
        for player in group:
            player['slug'] = f"{base}-{player['tour'].lower()}-{player['rank']}"


def sync_credits(players: list[dict]) -> None:
    path = DATA / 'image-credits.json'
    credits = json.loads(path.read_text(encoding='utf-8'))
    items = [item for item in credits['items'] if not str(item.get('id', '')).startswith('jugador-')]
    if not any(item.get('id') == 'silueta-jugador' for item in items):
        items.append({
            'id': 'silueta-jugador',
            'kind': 'illustration',
            'title': 'Silueta genérica de tenista',
            'src': '/assets/silueta-jugador.svg',
            'author': 'AceArena',
            'license': 'Ilustración propia',
            'licenseUrl': '',
            'sourceName': 'AceArena',
            'sourceUrl': 'https://acearena.io/paises/',
            'pages': ['Jugadores por país', 'Tenis en España'],
        })
    seen = set()
    for player in players:
        photo = player.get('photo')
        if not photo or photo['sourceUrl'] in seen:
            continue
        seen.add(photo['sourceUrl'])
        items.append({
            'id': f"jugador-{player['slug']}"[:80],
            'kind': 'photo',
            'title': player['name'],
            'src': photo['src'],
            'author': photo['author'],
            'license': photo['license'],
            'licenseUrl': photo['licenseUrl'],
            'sourceName': 'Wikimedia Commons',
            'sourceUrl': photo['sourceUrl'],
            'pages': ['Jugadores por país'],
        })
    credits['items'] = items
    credits['updated'] = TODAY
    save_json(path, credits)


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    print('Descargando informes ATP…', flush=True)
    files = {
        'numerical': ATP_NUMERICAL,
        'age': ATP_AGE,
        'prize': ATP_PRIZE,
        'finals': ATP_FINALS,
        'challengers': ATP_CHALLENGERS,
    }
    paths = {}
    for key, url in files.items():
        dest = CACHE / f'{key}.pdf'
        download(url, dest)
        paths[key] = dest
        print(f'  {key} {dest.stat().st_size}', flush=True)
    atp_rows = parse_rankings(pdf_text(paths['numerical']))
    ages = parse_ages(pdf_text(paths['age']))
    prizes = parse_prizes(pdf_text(paths['prize']))
    atp_events = parse_finals(pdf_text(paths['finals']), 'atp')
    challengers = parse_finals(pdf_text(paths['challengers']), 'challenger')
    print(f'ATP ranking {len(atp_rows)} edades {len(ages)} premios {len(prizes)} finales {len(atp_events)} challengers {len(challengers)}', flush=True)
    print('Ranking WTA…', flush=True)
    wta_rows = wta_rankings()
    print(f'WTA ranking {len(wta_rows)}', flush=True)
    print('Torneos WTA 2026…', flush=True)
    wta_events = wta_tournaments()
    print(f'WTA torneos {len(wta_events)}', flush=True)
    codes = select_countries(atp_rows, wta_rows)
    unknown = sorted(code for code in codes if code not in COUNTRIES)
    if unknown:
        print('Códigos sin nombre:', ', '.join(unknown), flush=True)
    known = existing_players()
    titles = title_index(atp_events)
    selected_wta = []
    for code in codes:
        selected_wta.extend(top_by_country(wta_rows, code, 20))
    selected_wta.extend(top_by_country(wta_rows, 'ESP', 50))
    unique_wta = {}
    for row in selected_wta:
        unique_wta[row['id']] = row
    print(f'Fichas WTA a leer: {len(unique_wta)}', flush=True)
    profiles = fetch_profiles(list(unique_wta.values()))
    profiles_ok = sum(
        1 for value in profiles.values()
        if isinstance(value, dict) and not value.get('error') and (value.get('handRaw') or value.get('careerHighRaw') or value.get('titlesSeason') is not None)
    )
    print(f'Fichas WTA leídas: {profiles_ok}', flush=True)
    countries = []
    all_players = []
    for code in sorted(codes, key=lambda item: country_name(item)):
        atp_players = [build_atp_player(row, ages, prizes, titles, known) for row in top_by_country(atp_rows, code, 20)]
        wta_players = [build_wta_player(row, profiles.get(str(row['id'])), known) for row in top_by_country(wta_rows, code, 20)]
        all_players.extend(atp_players)
        all_players.extend(wta_players)
        countries.append({
            'slug': slugify(country_name(code)),
            'name': country_name(code),
            'code': code,
            'atp': atp_players,
            'wta': wta_players,
        })
    spain_atp = [build_atp_player(row, ages, prizes, titles, known) for row in top_by_country(atp_rows, 'ESP', 50)]
    spain_wta = [build_wta_player(row, profiles.get(str(row['id'])), known) for row in top_by_country(wta_rows, 'ESP', 50)]
    assign_slugs(all_players + spain_atp + spain_wta)
    photo_players = all_players + spain_atp + spain_wta
    print(f'Buscando fotos de {len({player["slug"] for player in photo_players})} fichas…', flush=True)
    attach_photos(photo_players)
    # attach_photos writes onto the unique slug map built from the first object.
    # Copy photo metadata onto every card that shares the slug.
    photos = {}
    for player in photo_players:
        if player.get('photo'):
            photos[player['slug']] = player['photo']
    for player in photo_players:
        if player['slug'] in photos:
            player['photo'] = photos[player['slug']]
    real = sum(1 for player in {item['slug']: item for item in photo_players}.values() if player.get('photo'))
    total = len({item['slug'] for item in photo_players})
    gaps = [
        'Mejor resultado de Grand Slam en la carrera: los informes usados no lo publican jugador a jugador. Si alguien fue campeón o finalista de un Grand Slam en 2026, esa final sí consta, sacada del informe ATP a 18 de octubre. En la WTA el campo queda en sin dato.',
        'Títulos de carrera ATP: sin dato. Los títulos de 2026 cuentan solo las finales ATP y Grand Slam del informe a 18 de octubre, no los Challenger ni lo jugado después.',
        'Mano y estatura ATP: sin dato, salvo las fichas que AceArena ya tenía con fuente en /jugadores/.',
        'Fecha de nacimiento ATP: solo cuando sale en el ranking por edad (sobre todo el top 200) o en una ficha ya publicada.',
        'Finalista y marcador de la final en los torneos WTA: la API da la campeona cuando consta, y no el marcador.',
        'ITF masculino en España: itftennis.com no entregó el calendario (bloqueo). No se ha completado con otra lista.',
        'Historial cara a cara y últimos cinco partidos: sin dato. atptour.com no dejó leer las páginas de H2H.',
        'Horas del día consultado: sin dato. Algunas fichas mencionan el orden de juego, pero no publican partidos con hora de Madrid, Buenos Aires y Ciudad de México.',
        'Seis jugadores del top 200 ATP no traen código de nacionalidad en el informe del 19 de octubre de 2026: Daniil Medvedev, Andrey Rublev, Karen Khachanov, Roman Safiullin, Ilia Simakin y Pavel Kotov. No se les asigna un país. En la lista WTA de esa fecha, el top 200 sí trae código.',
    ]
    if profiles_ok < 20:
        gaps.append(
            'Mano, estatura, mejor ranking, títulos y premios de la WTA: en esta pasada la web de la WTA no entregó las fichas. Esos campos quedan en sin dato. El puesto, los puntos, la fecha de nacimiento y los torneos de la temporada sí salen de la lista del 19 de octubre de 2026.'
        )
    countries_doc = {
        'updated': TODAY,
        'criterion': (
            'Entra un país si al menos un jugador con código de nacionalidad está en el top 200 ATP '
            f'(informe numérico del {RANK_AS_OF}) o en el top 200 WTA (lista del {RANK_AS_OF}). '
            'En cada país se publican hasta 20 jugadores ATP y 20 jugadoras WTA, los mejor clasificados '
            'en la lista completa consultada, aunque queden fuera del top 200. Si hay menos, se publican los que hay.'
        ),
        'atpAsOf': RANK_AS_OF,
        'wtaAsOf': RANK_AS_OF,
        'atpReportAsOf': REPORT_AS_OF,
        'gaps': gaps,
        'unassignedAtp': sum(1 for row in atp_rows if not row['country'] and row['rank'] <= 200),
        'unassignedWta': sum(1 for row in wta_rows if not row['country'] and row['rank'] <= 200),
        'photoCount': real,
        'silhouetteCount': total - real,
        'countries': countries,
    }
    spain_doc = {
        'updated': TODAY,
        'atpAsOf': RANK_AS_OF,
        'wtaAsOf': RANK_AS_OF,
        'gaps': [
            'El calendario ITF masculino de 2026 en España no se pudo leer en itftennis.com.',
            'Los Challenger y los ATP de España salen de los informes de finales a 18 de octubre de 2026: la fecha de fin no viene en ese informe. La categoría ATP 250 o 500 tampoco: solo se anota si la línea dice Masters 1000 o es un Grand Slam. Barcelona (ATP 500) y Mallorca (ATP 250) se han comprobado en el calendario oficial de atptour.com.',
            'La WTA y la ITF femenina salen de la API de torneos de la WTA, consultada el ' + TODAY + '.',
        ],
        'tournaments': spain_events(atp_events, challengers, wta_events),
        'atp': spain_atp,
        'wta': spain_wta,
    }
    tournaments_doc = {
        'updated': TODAY,
        'coverage': (
            'ATP y Grand Slam: finales publicadas en el informe ATP a 18 de octubre de 2026. '
            'La categoría queda en sin dato salvo que la línea del informe diga Masters 1000 o sea un Grand Slam; Barcelona (ATP 500) y Mallorca (ATP 250) se han comprobado en el calendario oficial de atptour.com. '
            'WTA: torneos de 2026 cuyo nivel en la API es de circuito (Grand Slam, WTA 1000, 500, 250, 125 o Finals). '
            'Lo jugado en la ATP después del 18 de octubre no está en ese informe.'
        ),
        'events': tournament_pages(atp_events, wta_events),
    }
    save_json(DATA / 'countries.json', countries_doc)
    save_json(DATA / 'spain-tennis.json', spain_doc)
    save_json(DATA / 'tournaments-2026.json', tournaments_doc)
    save_json(DATA / 'head-to-head.json', head_to_head())
    save_json(DATA / 'order-of-play.json', order_of_play(wta_events))
    sync_credits(photo_players)
    summary = {
        'countries': len(countries),
        'countryNames': [country['name'] for country in countries],
        'atpRanking': len(atp_rows),
        'wtaRanking': len(wta_rows),
        'photos': real,
        'silhouettes': total - real,
        'spainTournaments': len(spain_doc['tournaments']),
        'tournamentPages': len(tournaments_doc['events']),
        'unknownCodes': unknown,
    }
    save_json(CACHE / 'summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
