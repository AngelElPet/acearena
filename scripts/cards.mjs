import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const KEEP = new Set(['perfil.png', 'lanzamiento.png']);
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let fonts;

function loadFonts(root) {
  if (fonts) return fonts;
  const dir = join(root, 'assets', 'fonts');
  const file = (name) => readFileSync(join(dir, name));
  fonts = [
    { name: 'Inter', data: file('inter-400.ttf'), weight: 400, style: 'normal' },
    { name: 'Inter', data: file('inter-700.ttf'), weight: 700, style: 'normal' },
    { name: 'Space Grotesk', data: file('space-500.ttf'), weight: 500, style: 'normal' },
    { name: 'Space Grotesk', data: file('space-700.ttf'), weight: 700, style: 'normal' },
  ];
  return fonts;
}

function longDate(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function titleSize(title, portrait) {
  const length = title.length;
  if (portrait) {
    if (length <= 36) return 76;
    if (length <= 52) return 62;
    if (length <= 72) return 50;
    return 42;
  }
  if (length <= 36) return 54;
  if (length <= 56) return 44;
  return 36;
}

function cardTree({ title, date, logo, width, height }) {
  const portrait = height > width;
  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0C10',
        color: '#ffffff',
        padding: portrait ? 72 : 56,
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', width: portrait ? 168 : 112, height: 8, background: '#BEE628', marginBottom: portrait ? 48 : 28 },
          },
        },
        {
          type: 'img',
          props: {
            src: logo,
            width: portrait ? 220 : 148,
            height: portrait ? 220 : 148,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              marginTop: portrait ? 36 : 8,
              color: '#BEE628',
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontSize: portrait ? 28 : 22,
              letterSpacing: 2,
            },
            children: 'ACEARENA',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              marginTop: portrait ? 28 : 16,
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontSize: titleSize(title, portrait),
              lineHeight: 1.12,
              color: '#ffffff',
            },
            children: title,
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexGrow: 1 },
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', color: '#ffffff', fontSize: portrait ? 32 : 24, marginBottom: 16 },
            children: date,
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', color: '#BEE628', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: portrait ? 36 : 28 },
            children: 'acearena.io',
          },
        },
      ],
    },
  };
}

async function renderPng(tree, width, height, fontList) {
  const svg = await satori(tree, { width, height, fonts: fontList });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

export async function writeSocialCards(articles, { root, publicDir }) {
  const fontList = loadFonts(root);
  const logo = `data:image/png;base64,${readFileSync(join(publicDir, 'social', 'perfil.png')).toString('base64')}`;
  const socialDir = join(publicDir, 'social');
  const ogDir = join(publicDir, 'og');
  mkdirSync(socialDir, { recursive: true });
  mkdirSync(ogDir, { recursive: true });
  for (const name of readdirSync(socialDir)) {
    if (name.endsWith('.png') && !KEEP.has(name)) rmSync(join(socialDir, name));
  }
  for (const name of readdirSync(ogDir)) {
    if (name.endsWith('.png')) rmSync(join(ogDir, name));
  }
  for (const article of articles) {
    if (KEEP.has(`${article.slug}.png`)) {
      throw new Error(`El slug ${article.slug} pisaría una imagen fija de public/social`);
    }
    const date = longDate(article.date);
    const story = await renderPng(cardTree({ title: article.title, date, logo, width: 1080, height: 1350 }), 1080, 1350, fontList);
    const og = await renderPng(cardTree({ title: article.title, date, logo, width: 1200, height: 630 }), 1200, 630, fontList);
    writeFileSync(join(socialDir, `${article.slug}.png`), story);
    writeFileSync(join(ogDir, `${article.slug}.png`), og);
  }
}
