# Integración de APIs de Tenis – AceArena

El sitio que ve el público está en `public/`. `public/script.js` pide los partidos a SportScore, pinta solo los que vienen como `live` o `inprogress`, y mete nombres y marcadores con `textContent`. Si no hay partidos, la sección se queda vacía. El enlace «Powered by SportScore» está en el HTML, no lo inyecta el script.

## Actual (en producción en el sitio)

**SportScore** (gratuita, sin clave)
- Endpoint: `https://sportscore.com/api/v1/matches?sport=tennis&status=live`
- Da: partidos live + finalizados, marcador por sets
- Requisito: atribución “Powered by SportScore”
- Limitación: no incluye punto a punto ni juego actual (30-40)

## Para punto a punto real (recomendado)

### Live Tennis API (livetennisapi.com)
1. Ir a https://livetennisapi.com/subscribe/free
2. Solicitar free key (100 req/día, sin tarjeta)
3. Documentación: https://docs.livetennisapi.com

Ejemplo de uso (backend recomendado):
```
GET https://api.livetennisapi.com/api/public/v1/matches?status=live
Header: X-API-Key: TU_CLAVE
```

Planes:
- Free: live scores, fixtures, players
- Basic ($9.99): + point-by-point history
- Ultra: + WebSocket live per-point

### Cómo conectar en AceArena
1. Crear un pequeño backend (Node/Python) que haga de proxy (para no exponer la clave)
2. Sustituir la función `loadLiveMatches()` en `script.js` para llamar a tu endpoint
3. Mapear los campos de puntos/juegos al HTML de `.point-feed` y `.games`

Mientras no haya clave, el sitio usa SportScore + fallback demo de alta calidad.
