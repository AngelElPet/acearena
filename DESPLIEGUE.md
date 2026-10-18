# Guía de Despliegue AceArena → GitHub + Netlify

## Qué vas a conseguir
- Web online con HTTPS
- Cada vez que subas cambios a GitHub, Netlify actualiza la web automáticamente
- Dominio propio (acearena.com / acearena.es / el que elijas)

---

## Paso 1 – Crear repositorio en GitHub

1. Entra en https://github.com y crea cuenta (si no tienes)
2. Pulsa **New repository**
3. Nombre recomendado: `acearena`
4. Déjalo **Public**
5. **No** marques "Add a README"
6. Crea el repositorio

---

## Paso 2 – Subir el código (desde tu ordenador)

Abre la terminal en la carpeta `acearena` y ejecuta (sustituye TU-USUARIO):

```bash
git init
git add .
git commit -m "AceArena v1 - listo para producción"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/acearena.git
git push -u origin main
```

---

## Paso 3 – Conectar con Netlify

1. Entra en https://app.netlify.com y regístrate (puedes usar "Sign up with GitHub")
2. Pulsa **Add new site** → **Import an existing project**
3. Elige **GitHub** y autoriza
4. Selecciona el repositorio `acearena`
5. Configuración:
   - Branch: `main`
   - Build command: (déjalo vacío)
   - Publish directory: `.`  (o déjalo como está)
6. Pulsa **Deploy site**

En 30-60 segundos tendrás una URL tipo:
`https://algo-random.netlify.app`

---

## Paso 4 – Poner tu dominio real

1. Compra el dominio (recomendado: Cloudflare Registrar, Namecheap o Google)
2. En Netlify → tu sitio → **Domain management** → **Add a domain**
3. Escribe `acearena.com` (o el que hayas comprado)
4. Netlify te mostrará los DNS que debes configurar

### Opción más fácil de DNS:
- Ve al panel de tu registrador de dominio
- Cambia los **Nameservers** a los que te da Netlify
- O añade los registros A / CNAME que te indique Netlify

5. Espera la propagación (normalmente < 1 hora)
6. Netlify activará el certificado SSL automáticamente

---

## Paso 5 – Comprobaciones finales

- [ ] https://tudominio.com carga bien
- [ ] https://tudominio.com/agencias.html funciona
- [ ] Se descarga el Media Kit PDF
- [ ] La sección En Directo muestra partidos
- [ ] Sustituyes el ID de Google Analytics

---

## Flujo de trabajo a partir de ahora

Cada vez que quieras actualizar la web:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Netlify detecta el push y actualiza la web sola en menos de 1 minuto.

---

## Contacto sponsors (recomendado)
Cuando tengas el dominio, configura un email tipo:
`sponsors@acearena.com`
(puedes usar ImprovMX gratis + Gmail, o Google Workspace)
