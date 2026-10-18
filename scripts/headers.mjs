import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

function xml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function headerSvg({ tournament, score, width, height }) {
  const scoreSize = score && score.length > 22 ? 64 : 84;
  const scoreBlock = score
    ? `<text x="72" y="${height - 150}" fill="#ffffff" font-family="Space Grotesk" font-size="${scoreSize}" font-weight="700">${xml(score)}</text>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#07090d"/>
  <g fill="none" stroke="#c6ff00" stroke-opacity="0.28" stroke-width="3">
    <rect x="48" y="40" width="${width - 96}" height="${height - 80}" rx="18"/>
    <line x1="${width / 2}" y1="40" x2="${width / 2}" y2="${height - 40}"/>
    <line x1="48" y1="${height / 2}" x2="${width - 48}" y2="${height / 2}" stroke-opacity="0.16"/>
    <rect x="${width / 2 - 90}" y="${height / 2 - 54}" width="180" height="108"/>
  </g>
  <rect x="72" y="72" width="92" height="8" fill="#c6ff00"/>
  <text x="72" y="128" fill="#c6ff00" font-family="Space Grotesk" font-size="22" font-weight="700" letter-spacing="2">ACEARENA</text>
  <text x="72" y="188" fill="#ffffff" font-family="Space Grotesk" font-size="36" font-weight="700">${xml(tournament)}</text>
  ${scoreBlock}
  <text x="72" y="${height - 72}" fill="#c6ff00" font-family="Inter" font-size="22" font-weight="700">acearena.io</text>
</svg>`;
}

async function raster(svg, width, fonts) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  });
  return resvg.render().asPng();
}

export async function writeArticleHeaders(articles, { root, publicDir }) {
  const fonts = [
    join(root, 'assets/fonts/inter-700.ttf'),
    join(root, 'assets/fonts/space-700.ttf'),
  ];
  const dir = join(publicDir, 'art');
  mkdirSync(dir, { recursive: true });
  for (const article of articles) {
    const tournament = article.tournament || 'AceArena';
    const score = typeof article.score === 'string' ? article.score : '';
    const large = await raster(headerSvg({ tournament, score, width: 1200, height: 630 }), 1200, fonts);
    const small = await raster(headerSvg({ tournament, score, width: 800, height: 420 }), 800, fonts);
    await sharp(large).webp({ quality: 72 }).toFile(join(dir, `${article.slug}.webp`));
    await sharp(small).webp({ quality: 70 }).toFile(join(dir, `${article.slug}-800.webp`));
  }
}
