# AceArena

Sitio editorial de tenis. El dominio público es [https://acearena.io](https://acearena.io).

Netlify publica solo la carpeta `public/` (sin comando de build). El resto del repositorio —esta guía, el plan de lanzamiento y las plantillas de outreach— no se despliega.

## Qué hay en `public/`

- `index.html` — portada
- `agencias.html` — página para agencias
- `aviso-legal.html`, `privacidad.html`, `cookies.html`
- `404.html` y `gracias.html`
- `media-kit-acearena.pdf`
- `assets/` — logotipo SVG, JPG de referencia, favicon, imagen Open Graph y fuentes
- `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`

## Contacto

- Sponsorship: sponsors@acearena.io
- General: hola@acearena.io

## Local

```bash
python3 -m http.server 8080 --directory public
```

## Refrescar países, España, torneos, cara a cara y horarios

Los datos viven en `data/countries.json`, `data/spain-tennis.json`, `data/tournaments-2026.json`, `data/head-to-head.json` y `data/order-of-play.json`. Cada archivo lleva la fecha de la fuente. Lo que la fuente no trae queda como `sin dato`: el script no estima cifras.

`Lo de hoy en 30 segundos` no tiene archivo propio. Sale de `data/news.json` al construir el sitio: las piezas con la fecha de noticia más reciente, cada una enlazada a su página.

```bash
npm ci
python3 scripts/refresh-sections.py
node scripts/build.mjs
```

Hace falta `poppler-utils` (`pdftotext`) y Node, porque las fotos se pasan a WebP con `sharp`. Los PDF y las respuestas crudas se quedan en `data/.cache/` y no se publican.

Los rankings bastan una vez por semana. Horarios, cara a cara y la lista de torneos pueden refrescarse el mismo día que las noticias. Después del script hay que volver a construir `public/` y commitearlo: el CI compara esa carpeta con el build.

## Documentos internos

- `DESPLIEGUE.md` — GitHub y Netlify
- `API-INTEGRATION.md` — fuente de marcadores
- `launch/` — plan y mensajes internos
- `outreach/` — plantillas de email
