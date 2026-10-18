import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://acearena.io';
const HOST = 'acearena.io';
const SKIP = new Set(['public/404.html', 'public/gracias.html']);

function readKey() {
  const data = JSON.parse(readFileSync(join(root, 'data', 'indexnow.json'), 'utf8'));
  if (!data || typeof data.key !== 'string' || !/^[A-Za-z0-9-]{8,128}$/.test(data.key)) {
    throw new Error('data/indexnow.json no tiene una clave IndexNow válida');
  }
  return data.key;
}

function changedFiles() {
  const before = process.env.INDEXNOW_BEFORE || '';
  const range = before && !/^0+$/.test(before) ? `${before}..HEAD` : 'HEAD~1..HEAD';
  try {
    return execSync(`git diff --name-only ${range}`, { cwd: root, encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.log(`IndexNow: no se pudo leer el diff (${error.message}). No se envía el ping.`);
    return null;
  }
}

function toUrl(file) {
  if (!file.startsWith('public/') || SKIP.has(file)) return null;
  if (!file.endsWith('.html') && !file.endsWith('.xml')) return null;
  const rel = file.slice('public/'.length);
  if (rel === 'index.html') return `${SITE}/`;
  if (rel.endsWith('/index.html')) return `${SITE}/${rel.slice(0, -'index.html'.length)}`;
  return `${SITE}/${rel}`;
}

async function main() {
  const key = readKey();
  const keyUrl = `${SITE}/${key}.txt`;
  let live;
  try {
    live = await fetch(keyUrl, { redirect: 'manual' });
  } catch (error) {
    console.log(`IndexNow: no se pudo comprobar ${keyUrl} (${error.message}). El workflow no ve el fin del deploy de Netlify. Se reintentará en el próximo push a main.`);
    return;
  }
  if (!live.ok) {
    console.log(`IndexNow: ${keyUrl} todavía no está publicado (HTTP ${live.status}). El workflow no puede saber cuándo termina el deploy de Netlify. No se envía el ping.`);
    return;
  }
  const body = (await live.text()).trim();
  if (body !== key) {
    console.log('IndexNow: el fichero publicado no coincide con data/indexnow.json. No se envía el ping.');
    return;
  }
  const files = changedFiles();
  if (!files) return;
  const urlList = [...new Set(files.map(toUrl).filter(Boolean))];
  if (urlList.length === 0) {
    console.log('IndexNow: el diff no trae URLs nuevas. No se envía el ping.');
    return;
  }
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: keyUrl, urlList }),
    });
    const text = await response.text();
    console.log(`IndexNow: HTTP ${response.status} para ${urlList.length} URLs.`);
    if (!response.ok) console.log(text.slice(0, 500));
  } catch (error) {
    console.log(`IndexNow: el ping falló (${error.message}). El contenido ya está en el repositorio.`);
  }
}

main().catch((error) => {
  console.log(`IndexNow: ${error.message}`);
});
