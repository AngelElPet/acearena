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

function shortName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  const particles = new Set(['de', 'del', 'da', 'di', 'van', 'von']);
  if (parts.length >= 2 && particles.has(parts[parts.length - 2].toLowerCase())) return parts.slice(-2).join(' ');
  if (parts.length >= 3) return parts.slice(-2).join(' ');
  return parts[parts.length - 1];
}

function scoreNames(players) {
  if (!Array.isArray(players) || players.length < 2) return '';
  return `${shortName(players[0])} d. ${shortName(players[1])}`;
}

function headerSvg({ tournament, score, players, width, height }) {
  const names = score ? scoreNames(players) : '';
  const scoreSize = score && score.length > 22 ? 52 : 68;
  const titleSize = tournament.length > 26 ? 30 : 38;
  const titleY = Math.round(height * 0.28);
  const namesY = Math.round(height * 0.42);
  const scoreY = Math.round(height * 0.58);
  const lineTop = Math.round(height * 0.7);
  const midY = lineTop + Math.round((height - 36 - lineTop) / 2);
  const namesBlock = names
    ? `<text x="72" y="${namesY}" fill="#c6ff00" font-family="Space Grotesk" font-size="28" font-weight="700">${xml(names)}</text>`
    : '';
  const scoreBlock = score
    ? `<text x="72" y="${scoreY}" fill="#ffffff" font-family="Space Grotesk" font-size="${scoreSize}" font-weight="700">${xml(score)}</text>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#07090d"/>
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="18" fill="#121a16" stroke="#c6ff00" stroke-opacity="0.4" stroke-width="3"/>
  <g fill="none" stroke="#c6ff00" stroke-opacity="0.28" stroke-width="3">
    <line x1="${width / 2}" y1="${lineTop}" x2="${width / 2}" y2="${height - 48}"/>
    <line x1="48" y1="${midY}" x2="${width - 48}" y2="${midY}" stroke-opacity="0.18"/>
  </g>
  <rect x="72" y="64" width="72" height="8" fill="#c6ff00"/>
  <text x="72" y="${titleY}" fill="#ffffff" font-family="Space Grotesk" font-size="${titleSize}" font-weight="700">${xml(tournament)}</text>
  ${namesBlock}
  ${scoreBlock}
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
    const players = article.players;
    const large = await raster(headerSvg({ tournament, score, players, width: 1200, height: 630 }), 1200, fonts);
    await sharp(large).webp({ quality: 72 }).toFile(join(dir, `${article.slug}.webp`));
    await sharp(large).resize(800, 420).webp({ quality: 70 }).toFile(join(dir, `${article.slug}-800.webp`));
    await sharp(large).resize(400, 210).webp({ quality: 66 }).toFile(join(dir, `${article.slug}-400.webp`));
  }
}
