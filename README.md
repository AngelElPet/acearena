# AceArena

Sitio editorial de tenis en español. El dominio público es [https://acearena.io](https://acearena.io).

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

## Documentos internos

- `DESPLIEGUE.md` — GitHub y Netlify
- `API-INTEGRATION.md` — fuente de marcadores
- `launch/` — plan y mensajes internos
- `outreach/` — plantillas de email
