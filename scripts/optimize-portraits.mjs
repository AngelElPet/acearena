import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const previous = existsSync(process.argv[3]) ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : {};
const sizes = { ...previous };
for (const job of jobs) {
  if (job.measure) {
    const saved = await sharp(job.dest).metadata();
    sizes[job.slug] = { width: saved.width || 0, height: saved.height || 0 };
    continue;
  }
  const source = sharp(job.src, { failOn: 'none' }).rotate();
  const meta = await source.metadata();
  const width = 160;
  const height = Math.max(1, Math.round(((meta.height || width) * width) / (meta.width || width)));
  await sharp(job.src, { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 68 })
    .toFile(job.dest);
  const saved = await sharp(job.dest).metadata();
  sizes[job.slug] = { width: saved.width || width, height: saved.height || height };
}
writeFileSync(process.argv[3], `${JSON.stringify(sizes)}\n`);
