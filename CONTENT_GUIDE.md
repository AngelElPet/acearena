# Guía de contenido de AceArena

Esta guía es la instrucción de la rutina que actualiza el sitio. La rutina edita solo ficheros de datos. No reescribe el diseño y no inventa cifras de audiencia.

El sitio publicado es `public/`. Netlify lo sirve tal cual, sin comando de build. `scripts/build.mjs` regenera las páginas de datos dentro de `public/` a partir de `data/`. Antes de reescribirlas borra `public/noticias/`, `public/jugadores/`, `public/paises/`, `public/torneos/` y `public/cara-a-cara/`. Conserva estilos, script, imágenes, el PDF y `robots.txt`. La portada y `agencias.html` se editan a mano; el build rellena las regiones `AUTO` de la portada y vuelve a colocar el beacon.

## Qué se edita

- Una noticia nueva o corregida: `data/news.json` (un array).
- Un resultado nuevo o corregido: `data/results.json`.
- La semana en curso y la cita siguiente: `data/week.json`.
- El top 10 de la Race a Turín: `data/race.json`.
- La lista vigente de puntos de 52 semanas: `data/rankings.json`. No copies el puesto ni los puntos a otra lista.
- La situación del día de una ficha: el objeto `hoy` de ese jugador en `data/players.json`, y el último resultado en `data/results.json`.
- No edites a mano las páginas generadas de `public/noticias/`, `public/jugadores/`, `public/aprende/`, `public/calendario-2027.html`, `public/semana.html`, `public/race.html`, `public/rankings.html`, `public/sobre.html`, `public/sitemap.xml`, `public/news-sitemap.xml` ni `public/llms.txt`. El build las vuelve a escribir.

## Artículo

Cada elemento de `data/news.json` tiene estos campos:

| Campo | Regla |
| --- | --- |
| `slug` | Ver reglas de slug. Único. |
| `title` | Español, factual, sin comillas inventadas. |
| `date` | Día del hecho, `YYYY-MM-DD`. No puede ser futuro. |
| `updated` | `YYYY-MM-DD`. Igual o posterior a `date`. No futuro. |
| `summary` | Una o dos frases. Es la entradilla de la portada y la meta description. |
| `body` | Array de párrafos en texto plano. Sin HTML. |
| `tags` | Array de cadenas. |
| `players` | Array con los jugadores del hecho. |
| `tournament` | Nombre del torneo, o `ATP` / `WTA` si la pieza es de ranking. |
| `sources` | Array de `{ "name", "url" }`. Mínimo una. `url` es `http` o `https` real. En la página se enlaza el nombre, no la URL en crudo. |
| `brief` | Opcional. Si está, son exactamente 3 frases sacadas de la propia pieza. Salen como «En 30 segundos». |

El cuerpo tiene entre 150 y 400 palabras.

### Slug

- Minúsculas ASCII: `a-z`, `0-9` y guiones.
- Sin tildes ni eñes: `jodar`, no `jódar`.
- No empieza ni acaba en guion. No lleva guiones seguidos.
- Corto y descriptivo, a partir del hecho: `djokovic-suma-102-titulos-en-pekin`.
- No se reutiliza. Si el hecho cambia, se actualiza el mismo slug; no se crea otro para la misma pieza.

### Tono

- Español, cercano y factual. Di el dato con su fecha y su fuente. Evita los descargos del tipo «esta nota no afirma» o «no prometemos».
- Cada cifra, marcador, ranking y baja tiene que poder rastrearse a una fuente del array `sources`.
- No inventes citas. Si reproduces una frase, tiene que figurar de forma literal en la fuente y atribuirse a esa fuente. Si no puedes citarla literal, parafrasea sin comillas.
- No inventes estadísticas, premios, rachas ni “primeras veces”.
- Si el partido no ha terminado, no nombres un ganador y no añadas la fila en `results.json`.
- No copies al texto las cifras comerciales de la portada (audiencia, ROI, suscriptores). No son datos de tenis.

### Portada

La portada muestra noticias y resultados con `date` dentro de los últimos 60 días, de más reciente a más antiguo. A igual fecha, se mantiene el orden del fichero. Lo más viejo de 60 días sigue en `/noticias/`, en el sitemap y en el RSS, pero sale de la portada.

## Resultado

`data/results.json` es un objeto:

```json
{
  "updated": "2026-10-18T00:00:00.000Z",
  "results": [
    {
      "tournament": "Rolex Shanghai Masters",
      "round": "Final",
      "date": "2026-10-18",
      "winner": "Alejandro Davidovich Fokina",
      "loser": "Rafael Jódar",
      "score": "1-6 7-6(5) 6-4",
      "source": "https://www.atptour.com/en/news/jodar-davidovich-fokina-shanghai-2026-final"
    }
  ]
}
```

- `updated` es una marca de tiempo ISO del momento en que los datos quedan cerrados. No puede ser futura.
- `date` es `YYYY-MM-DD` y no puede ser futura.
- `source` es la URL http(s) del marcador.
- `score` copia el marcador de esa fuente, ganador primero.
- En dobles, escribe la pareja tal como la publica la fuente (`L. Miedler / N. Oberleitner`) si no hay nombre completo en esa página.
- Solo partidos terminados.

Al cambiar resultados, pon `updated` a la hora real de la revisión.

## Semana

`data/week.json` alimenta la línea del héroe, la tarjeta «Hoy», el bloque «Qué ver esta semana» de la portada y `public/semana.html`.

- `updated` es `YYYY-MM-DD` y no puede ser futuro.
- `hero` es una lista de fragmentos `{ "text" }` o `{ "text", "href" }`. Cada `href` es la ficha oficial del torneo.
- `today` apunta a una noticia ya publicada y a `semana.html`.
- `tournaments` es la semana en curso. `later` es la cita siguiente, con fecha oficial.
- Cada torneo lleva `tour` (`ATP` o `WTA`), `surface` (`hard`, `clay`, `grass` o `indoor`), `surfaceLabel`, `officialUrl`, `detail` y `sources`.
- `entries` se deja vacío si la fuente no publica españoles o latinoamericanos. No se inventa un cuadro.
- `hoursNote` dice que no hay hora local en Madrid, Buenos Aires ni Ciudad de México cuando el orden de juego no la publica.

## Ranking único

`data/rankings.json` es la única lista vigente de puntos de 52 semanas. `asOf` es el día de esa lista oficial, el mismo para ATP y WTA. Ahora es `2026-10-19`. `atp.rows` y `wta.rows` son el top 20, con los puntos ya agrupados (`5.610`). `directory.atp` y `directory.wta` cubren al resto de jugadores que salen en fichas, países y España; ahí los puntos van como entero (`5610`). `wtaRace` es la carrera a las WTA Finals y conserva su propia fecha. No se iguala a la lista de 52 semanas.

La portada (región `AUTO:RANKINGS`), `rankings.html`, las fichas, los países y Tenis en España leen ese fichero y muestran `asOf`. `validate.mjs` falla si el puesto o los puntos de un jugador no coinciden entre `rankings.json`, `players.json`, `countries.json` y `spain-tennis.json`, o si la fecha de esas listas no es `asOf`.

Una noticia puede citar una lista anterior cuando el hecho es esa lista. La fecha va en el texto. No se reescribe el pasado para igualarlo a la lista vigente.

## Situación del día en la ficha

Cada jugador puede llevar `hoy`. La rutina diaria lo rellena al publicar la noticia del día:

| Campo | Regla |
| --- | --- |
| `hoy.asOf` | `YYYY-MM-DD` de la situación que se muestra. |
| `hoy.tournament` | Próximo torneo programado, solo si una fuente lo publica. |
| `hoy.round` | Ronda, si el cuadro la publica. |
| `hoy.opponent` | Rival, si el cuadro lo publica. |
| `hoy.startTimeMadrid` | Hora oficial de inicio en Madrid. Solo si un orden de juego la publica. Si no hay hora, se omite el campo. |

La ficha titula el bloque con el nombre del jugador y «hoy», y muestra la fecha. Si `hoy` no trae torneo, usa la frase de `week.spotlight` para ese jugador y, si tampoco está, `nextEvents`. El último resultado sale de `results.json`. La hora de inicio de sesión de un torneo no es la hora del partido: sin orden de juego, la hora queda en el guion.

`players` de cada noticia y `tournament` alimentan los enlaces internos. El nombre del jugador tiene que coincidir con el de su ficha. El del torneo, con el de `tournaments-2026.json` o con un nombre cuya coincidencia sea única.

Una ficha con `photo` muestra la imagen y el crédito. `portrait` con valor `silhouette` muestra la silueta y no lleva pie de foto. Sin foto ni silueta, el avatar son las iniciales.

## Race

`data/race.json` alimenta `public/race.html`. Son exactamente 10 filas, en orden, con `position`, `player` y `points` tal como los publica la ATP en `source`. `asOf` es el día de la consulta. `context` solo repite lo que dicen `source` y `contextSources`. Si la ATP no publica una plaza extra, la página no la afirma.

## Cómo comprobar y regenerar

Desde la raíz del repositorio, con Node. Las tarjetas sociales necesitan las dependencias del repositorio (`satori` y `@resvg/resvg-js`):

```bash
npm ci
node scripts/validate.mjs
node scripts/build.mjs
node scripts/validate.mjs --site
```

`validate.mjs` falla si falta una fuente, si una URL no es http(s), si hay una fecha futura, si un slug está repetido o si queda texto de relleno (`TODO`, `TBD`, `FIXME`, `lorem ipsum`, `placeholder`, `example.com`, `ejemplo.com`, `XXXXX`, `{{`, `[insert`).

`build.mjs` es idempotente: dos ejecuciones seguidas, con los mismos datos y el mismo día de contenido, dejan `public/` igual. Escapa todo el texto. Sustituye las regiones `AUTO:EDITION`, `AUTO:WEEKLINE`, `AUTO:TODAY`, `AUTO:WEEK`, `AUTO:NEWS`, `AUTO:RESULTS` y `AUTO:RANKINGS` de la portada. Al final añade `?v=` con un hash corto a cada referencia de `/assets/`, también en `styles.css` y `site.webmanifest`.

Para ver el sitio:

```bash
python3 -m http.server 8080 --directory public
```

## Qué genera el build

- `public/noticias/<slug>.html` — una página por artículo, con SEO, JSON-LD `NewsArticle` y `BreadcrumbList`. El `NewsArticle` lleva `image`, `datePublished`, `dateModified` y `author` con el nombre «Redacción AceArena». Si hay una foto libre en 16:9 de al menos 1200 px de ancho, `og:image` y el schema usan esa foto. Si no, siguen en la tarjeta `public/og/<slug>.png` (1200×630). El cuerpo enlaza las fichas y el torneo cuando el nombre coincide, y cierra con enlaces a la ficha, al torneo y a `semana.html`.
- `public/social/<slug>.png` (1080×1350) y `public/og/<slug>.png` (1200×630), una pareja por artículo. Fondo `#0A0C10`, lima `#BEE628`, texto blanco, fecha, `acearena.io` y el logotipo de `public/social/perfil.png`. Las fuentes del render son `assets/fonts/*.ttf`, instancias estáticas de las woff2 del sitio. `perfil.png` y `lanzamiento.png` no se regeneran y no entran en el sitemap.
- `public/jugadores/` — índice «Jugadores» y una ficha por jugador de `data/players.json`, con foto y crédito, silueta sin pie o avatar de iniciales, el bloque «hoy» y JSON-LD `Person`. La ficha enlaza sus noticias, sus cara a cara, el torneo de `hoy` si existe página, y `semana.html`.
- `public/news-sitemap.xml` — sitemap de Google News con las noticias cuya fecha es el día de contenido o el día anterior. `public/robots.txt` lo referencia junto a `sitemap.xml`.
- Cada HTML lleva `<meta name="robots" content="…, max-image-preview:large">`. El pie enlaza Instagram. No enlaza X.
- Una página de torneo sin categoría, campeón, finalista ni marcador lleva `noindex` y no entra en `sitemap.xml`. Un torneo combinado (ATP y WTA en la misma sede y la misma semana) sale en una sola página, con el nombre completo y las dos categorías y los dos resultados por separado.
- `public/calendario-2027.html` — fechas de `data/calendar.json`. Si el cierre no está publicado, el texto dice «fecha por confirmar».
- `public/aprende/` — índice y las guías de `data/guides.json`, con JSON-LD `FAQPage`.
- `public/<clave>.txt` — clave IndexNow de `data/indexnow.json`. No entra en el sitemap.
- `public/noticias/index.html` — el archivo completo.
- `public/resultados.html` — resultados, con JSON-LD `ItemList` / `SportsEvent`.
- Portada con los bloques de noticias y resultados de los últimos 60 días.
- `public/sitemap.xml` con `lastmod`.
- `public/feed.xml` (RSS).
- `public/llms.txt` — las últimas noticias, la semana, la Race, los jugadores y un enlace a `llms-full.txt`.
- `public/semana.html` y `public/race.html`.
- `public/sobre.html` — AboutPage, con JSON-LD `AboutPage` y `BreadcrumbList`.
- `public/data/news.json`, `public/data/results.json`, `public/data/players.json`, `public/data/calendar.json`, `public/data/guides.json`, `public/data/week.json` y `public/data/race.json`.
- `public/aviso-legal.html`, `public/privacidad.html` y `public/cookies.html`, con JSON-LD `WebPage` y `BreadcrumbList`. El NIF y el domicilio del titular solo aparecen en esas tres páginas. El pie del resto del sitio lleva el nombre y el correo, sin NIF ni calle.
- El beacon de Cloudflare Web Analytics justo antes de `</body>` en cada HTML.

No quites ese beacon ni la nota de analítica. No hace falta un banner de cookies: la medición no usa cookies ni guarda datos personales.

## Publicación

En un pull request, la acción ejecuta validate y build y falla si `public/` no está regenerado. En `main`, un push que toque `data/**` o `scripts/**` (y también `workflow_dispatch`) regenera `public/` y lo commitea como `github-actions[bot]` con `[skip ci]`.
