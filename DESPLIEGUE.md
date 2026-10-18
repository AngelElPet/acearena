# Despliegue de AceArena

El sitio público es https://acearena.io (con o sin www; www redirige al apex). Netlify también conserva la URL `*.netlify.app` del sitio: el redirect del dominio no la toca.

## Qué se publica

En `netlify.toml` la carpeta de publicación es `public/` y el comando de build está vacío. No hace falta un bundler.

Eso deja fuera del sitio, a propósito:

- `README.md`, `DESPLIEGUE.md`, `API-INTEGRATION.md`
- `launch/` y `outreach/` (precios internos y borradores)

## Conectar el repositorio

1. En Netlify: Add new site → Import an existing project → GitHub.
2. Rama: `main`.
3. Build command: vacío.
4. Publish directory: `public`.
5. Deploy site.

La primera URL será del tipo `https://algo-random.netlify.app`. Sirve para revisar. No es el dominio canónico.

## Dominio

1. En Domain management, añade `acearena.io`.
2. Añade también `www.acearena.io` si el registrador lo pide.
3. El `netlify.toml` ya redirige `https://www.acearena.io/*` a `https://acearena.io/:splat` con un 301. No redirige el subdominio de Netlify.
4. Una ruta que no exista debe responder con `public/404.html` y código 404. No hay una regla que reescriba todo a `index.html`.

## Comprobaciones

- https://acearena.io carga la portada y el logotipo.
- https://acearena.io/agencias.html abre la página de agencias.
- https://acearena.io/media-kit-acearena.pdf descarga el PDF.
- https://acearena.io/robots.txt y https://acearena.io/sitemap.xml responden con URLs de acearena.io.
- Una ruta inventada, por ejemplo https://acearena.io/no-existe, muestra la página 404.
- Los formularios de contacto, newsletter y agencias llegan a Netlify Forms. Llevan casilla de privacidad.

## IndexNow

`scripts/indexnow.mjs` avisa a `https://api.indexnow.org/indexnow` con las URLs HTML que cambian en un push a `main`. La clave vive en `data/indexnow.json` y el build la publica en `public/<clave>.txt`.

La acción de GitHub no puede ver cuándo Netlify termina el deploy. El script comprueba `https://acearena.io/<clave>.txt`. Si esa URL todavía no devuelve la clave, escribe el motivo y sale sin error. El siguiente push a `main` vuelve a intentarlo. En un pull request no se envía el ping.

## Correo

- sponsors@acearena.io — sponsorship
- hola@acearena.io — contacto general

Los dos reenvían al titular.
