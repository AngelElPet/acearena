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

function headerTitle(article) {
  if (typeof article.score === 'string' && article.score) return article.tournament || 'AceArena';
  const tags = Array.isArray(article.tags) ? article.tags : [];
  if (tags.includes('Race a Turín')) return 'Race a Turín';
  if (tags.includes('Ranking')) return 'Ranking';
  if (tags.includes('Lesiones')) return 'Temporada';
  return article.tournament || 'AceArena';
}

function cardName(name) {
  const parts = String(name).split(/\s+/).filter(Boolean);
  if (parts.length >= 3) return parts.slice(-2).join(' ');
  return parts[parts.length - 1] || name;
}

function headerSvg({ tournament, score, names, width, height }) {
  const scoreSize = score && score.length > 18 ? 64 : 92;
  const nameLine = names.length ? names.map(cardName).join('  ·  ') : tournament;
  const scoreBlock = score
    ? `<text x="72" y="${height * 0.72}" fill="#ffffff" font-family="Space Grotesk" font-size="${scoreSize}" font-weight="700">${xml(score)}</text>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#07090d"/>
  <rect x="0" y="0" width="${width}" height="12" fill="#c6ff00"/>
  <g fill="none" stroke="#c6ff00" stroke-opacity="0.28" stroke-width="3">
    <rect x="${width - 280}" y="${height - 210}" width="200" height="130" rx="10"/>
    <line x1="${width - 180}" y1="${height - 210}" x2="${width - 180}" y2="${height - 80}"/>
    <line x1="${width - 280}" y1="${height - 145}" x2="${width - 80}" y2="${height - 145}"/>
  </g>
  <text x="72" y="92" fill="#c6ff00" font-family="Space Grotesk" font-size="24" font-weight="700" letter-spacing="2">ACEARENA</text>
  <text x="72" y="168" fill="#c6ff00" font-family="Space Grotesk" font-size="36" font-weight="700">${xml(tournament)}</text>
  <text x="72" y="${height * 0.5}" fill="#ffffff" font-family="Space Grotesk" font-size="56" font-weight="700">${xml(nameLine)}</text>
  ${scoreBlock}
  <text x="72" y="${height - 56}" fill="#c6ff00" font-family="Inter" font-size="24" font-weight="700">acearena.io</text>
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
    const tournament = headerTitle(article);
    const score = typeof article.score === 'string' ? article.score : '';
    const names = Array.isArray(article.players) ? article.players.slice(0, 2) : [];
    const large = await raster(headerSvg({ tournament, score, names, width: 1200, height: 630 }), 1200, fonts);
    const small = await raster(headerSvg({ tournament, score, names, width: 800, height: 420 }), 800, fonts);
    await sharp(large).webp({ quality: 72 }).toFile(join(dir, `${article.slug}.webp`));
    await sharp(small).webp({ quality: 70 }).toFile(join(dir, `${article.slug}-800.webp`));
  }
}
