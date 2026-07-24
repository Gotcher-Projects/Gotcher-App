// One-off asset fetcher: pulls the Twemoji SVG for every distinct emoji used in the pregnancy
// size dataset and writes it to public/images/twemoji/<codepoint>.svg, so the size card renders
// a consistent, crisp icon on every device with no runtime CDN dependency.
// Run from Frontend/: node scripts/fetch-twemoji.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PREGNANCY_SIZES } from "../src/lib/pregnancySizes.js";
import { twemojiCode } from "../src/lib/twemoji.js";

const TWEMOJI_VERSION = "15.1.0"; // jdecked/twemoji (maintained fork)
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "images", "twemoji");

const codes = [...new Set(PREGNANCY_SIZES.map(s => twemojiCode(s.emoji)))];
await mkdir(outDir, { recursive: true });

let ok = 0;
for (const code of codes) {
  const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg/${code}.svg`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`✗ ${code}: HTTP ${res.status} (${url})`);
    continue;
  }
  await writeFile(join(outDir, `${code}.svg`), await res.text(), "utf8");
  ok++;
}
console.log(`Fetched ${ok}/${codes.length} Twemoji SVGs into public/images/twemoji/`);
