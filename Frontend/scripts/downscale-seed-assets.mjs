// One-off prep for sv2-s9.1: downscale seed-assets/*.jpg to a repo-friendly size.
// Full-res originals stay in plans/storybook-v2/Pictures/; this rewrites the purpose-named copies in
// seed-assets/ to <=1600px on the long edge, EXIF-oriented, JPEG q80. Re-runnable (skips already-small).
//   Run from Frontend/:  node scripts/downscale-seed-assets.mjs
import sharp from 'sharp';
import { readdir, stat, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../seed-assets');
const MAX = 1600;

const files = (await readdir(DIR)).filter(f => /\.jpe?g$/i.test(f));
let before = 0, after = 0;

for (const f of files) {
  const src = path.join(DIR, f);
  const tmp = path.join(DIR, f + '.tmp');
  const b = (await stat(src)).size;
  before += b;
  await sharp(src)
    .rotate()                                            // bake in EXIF orientation
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(tmp);
  await unlink(src);
  await rename(tmp, src);
  const a = (await stat(src)).size;
  after += a;
  console.log(`${f.padEnd(30)} ${(b / 1024).toFixed(0).padStart(6)}K -> ${(a / 1024).toFixed(0).padStart(5)}K`);
}

console.log(`\n${files.length} files  ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB`);
