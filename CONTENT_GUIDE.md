# Guía de contenido de AceArena

Esta guía es la instrucción de la rutina que actualiza el sitio. La rutina edita solo ficheros de datos. No reescribe el diseño y no inventa cifras de audiencia.

El sitio publicado es `public/`. Netlify lo sirve tal cual, sin comando de build. `scripts/build.mjs` regenera las páginas de datos dentro de `public/` a partir de `data/`. No borra `public/`: conserva estilos, script, imágenes, el PDF y `robots.txt`. La portada y `agencias.html` se editan a mano; el build solo rellena las regiones `AUTO` de la portada y vuelve a colocar el beacon.

## Qué se edita

- Una noticia nueva o corregida: `data/news.json` (un array).
- Un resultado nuevo o corregido: `data/results.json`.
- La semana en curso y la cita siguiente: `data/week.json`.
- El top 10 de la Race a Turín: `data/race.json`.
- No edites a mano las páginas generadas de `public/noticias/`, `public/jugadores/`, `public/aprende/`, `public/calendario-2027.html`, `public/semana.html`, `public/race.html`, `public/sobre.html`, `public/sitemap.xml` ni `public/llms.txt`. El build las vuelve a escribir.

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

`build.mjs` es idempotente: dos ejecuciones seguidas, con los mismos datos y el mismo día UTC, dejan `public/` igual. Escapa todo el texto. Sustituye las regiones `AUTO:EDITION`, `AUTO:WEEKLINE`, `AUTO:TODAY`, `AUTO:WEEK`, `AUTO:NEWS` y `AUTO:RESULTS` de la portada. Al final añade `?v=` con un hash corto a cada referencia de `/assets/`, también en `styles.css` y `site.webmanifest`.

Para ver el sitio:

```bash
python3 -m http.server 8080 --directory public
```

## Qué genera el build

- `public/noticias/<slug>.html` — una página por artículo, con SEO, JSON-LD `NewsArticle` (con `image`) y `BreadcrumbList`, la tarjeta `/og/<slug>.png` como cabecera, fechas, fuentes enlazadas por su nombre y el formulario del resumen del lunes. `og:image` y `twitter:image` apuntan a `public/og/<slug>.png`. El autor del JSON-LD sigue siendo la Organization.
- `public/social/<slug>.png` (1080×1350) y `public/og/<slug>.png` (1200×630), una pareja por artículo. Fondo `#0A0C10`, lima `#BEE628`, texto blanco, fecha, `acearena.io` y el logotipo de `public/social/perfil.png`. Las fuentes del render son `assets/fonts/*.ttf`, instancias estáticas de las woff2 del sitio. `perfil.png` y `lanzamiento.png` no se regeneran y no entran en el sitemap.
- `public/jugadores/` — índice «Jugadores en español» y una ficha por jugador de `data/players.json`, con avatar de iniciales (no es una foto) y JSON-LD `Person`.
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
