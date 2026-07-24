// Smoke test for the pr1 spike: render the built-in self-test page to a PDF and report on it.
// Requires the sidecar to be running (npm start, or the docker container).
//
//   node scripts/smoke.js
//   SIDECAR_URL=http://localhost:4000 node scripts/smoke.js
//
// Writes out/self-test.pdf and prints size + render time so you can open + inspect it.

import fs from 'fs';
import path from 'path';

const base = process.env.SIDECAR_URL || 'http://localhost:4000';

const res = await fetch(`${base}/render`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: `${base}/self-test.html`,
    waitForSelector: '[data-print-ready="true"]',
  }),
});

if (!res.ok) {
  console.error(`✗ render failed: HTTP ${res.status}`, await res.text());
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
const outDir = 'out';
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'self-test.pdf');
fs.writeFileSync(out, buf);

const isPdf = buf.subarray(0, 5).toString('ascii') === '%PDF-';
console.log(`✓ wrote ${out}`);
console.log(`  size: ${(buf.length / 1024).toFixed(1)} KB`);
console.log(`  render time: ${res.headers.get('x-render-ms') || '?'} ms`);
console.log(`  valid PDF header: ${isPdf ? 'yes (%PDF-)' : 'NO'}`);
if (!isPdf) process.exit(1);
console.log('\n  Open it and confirm: selectable vector text, embedded serif+sans fonts,');
console.log('  the pink→indigo background, and a sharp 900×1200 image at zoom.');
