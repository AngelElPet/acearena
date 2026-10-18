# Guía de contenido de AceArena

Esta guía es la instrucción de la rutina que actualiza el sitio. La rutina edita solo ficheros de datos. No reescribe el diseño y no inventa cifras de audiencia.

El sitio publicado es `public/`. Netlify lo sirve tal cual, sin comando de build. `scripts/build.mjs` regenera `public/` a partir de `data/` y de las plantillas de la raíz (`index.html`, `agencias.html`, `styles.css`, `script.js`).

## Qué se edita

- Una noticia nueva o corregida: `data/news.json` (un array).
- Un resultado nuevo o corregido: `data/results.json`.
- No edites a mano `public/`. El build lo borra y lo vuelve a crear.

## Artículo

Cada elemento de `data/news.json` tiene exactamente estos campos:

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
| `sources` | Array de `{ "name", "url" }`. Mínimo una. `url` es `http` o `https` real. |

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

## Cómo comprobar y regenerar

Desde la raíz del repositorio, con Node y sin instalar dependencias:

```bash
node scripts/validate.mjs
node scripts/build.mjs
```

`validate.mjs` falla si falta una fuente, si una URL no es http(s), si hay una fecha futura, si un slug está repetido o si queda texto de relleno (`TODO`, `TBD`, `FIXME`, `lorem ipsum`, `placeholder`, `example.com`, `ejemplo.com`, `XXXXX`, `{{`, `[insert`).

`build.mjs` es idempotente: dos ejecuciones seguidas, con los mismos datos y el mismo día UTC, dejan `public/` igual. Escapa todo el texto. Sustituye solo las regiones `<!-- AUTO:NEWS -->` y `<!-- AUTO:RESULTS -->` de la portada.

Para ver el sitio:

```bash
python3 -m http.server 8080 --directory public
```

## Qué genera el build

- `public/noticias/<slug>.html` — una página por artículo, con SEO, JSON-LD `NewsArticle`, fechas y fuentes visibles.
- `public/noticias/index.html` — el archivo completo.
- `public/resultados.html` — resultados, con JSON-LD `ItemList` / `SportsEvent`.
- Portada con los bloques de noticias y resultados de los últimos 60 días.
- `public/sitemap.xml` con `lastmod`.
- `public/feed.xml` (RSS).
- `public/llms.txt` — las últimas noticias y la página de resultados.
- `public/data/news.json` y `public/data/results.json`.
- `public/aviso-legal.html`, `public/privacidad.html` y `public/cookies.html`. El NIF y el domicilio del titular solo aparecen en esas tres páginas. El pie del resto del sitio lleva el nombre y el correo, sin NIF ni calle.
- El beacon de Cloudflare Web Analytics justo antes de `</body>` en cada HTML.

No quites ese beacon ni la nota de analítica. No hace falta un banner de cookies: la medición no usa cookies ni guarda datos personales.

## Publicación

En un pull request, la acción ejecuta validate y build y falla si `public/` no está regenerado. En `main`, un push que toque `data/**` o `scripts/**` (y también `workflow_dispatch`) regenera `public/` y lo commitea como `github-actions[bot]` con `[skip ci]`.
