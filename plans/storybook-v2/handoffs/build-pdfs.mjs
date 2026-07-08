// Build human-readable PDFs of the hand-off docs from their markdown sources.
//   node plans/storybook-v2/handoffs/build-pdfs.mjs
// Pipeline: markdown --(marked via npx)--> HTML fragment --> wrapped w/ print CSS --> headless
// Chrome/Edge --print-to-pdf--> plans/storybook-v2/handoffs/pdf/<name>.pdf. No repo dependencies are installed;
// `marked` is fetched on demand by npx, and Chrome/Edge is whichever is present on the machine.
import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'pdf');
mkdirSync(outDir, { recursive: true });

const DOCS = [
  'owner-setup-runbook',
  'anthropic-api-key-handoff',
  'stripe-account-handoff',
  'lulu-account-handoff',
  'developer-credentials-handoff',
];

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const browser = BROWSERS.find(existsSync);
if (!browser) { console.error('No Chrome/Edge found.'); process.exit(1); }

const CSS = `
  @page { margin: 0.9in 0.85in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11.5pt;
         line-height: 1.5; color: #1a1a1a; max-width: 100%; }
  h1 { font-size: 20pt; margin: 0 0 6pt; border-bottom: 2px solid #444; padding-bottom: 6pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; page-break-after: avoid; }
  p, li { margin: 4pt 0; }
  ul, ol { padding-left: 1.3em; }
  code { font-family: "Consolas", monospace; font-size: 10pt; background: #f2f2f2; padding: 1px 4px;
         border-radius: 3px; }
  pre { background: #f5f5f5; border: 1px solid #ddd; border-radius: 5px; padding: 10px 12px;
        font-size: 9.5pt; overflow-wrap: anywhere; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 8pt 0; padding: 6pt 12pt; border-left: 4px solid #999; background: #fafafa;
               page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10.5pt; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  tr { page-break-inside: avoid; }
  hr { border: none; border-top: 1px solid #ddd; margin: 14pt 0; }
  a { color: #1a56b8; text-decoration: none; }
`;

const profile = join(tmpdir(), 'cradlehq-pdf-profile');

for (const name of DOCS) {
  const md = join(here, `${name}.md`);
  if (!existsSync(md)) { console.warn('skip (missing):', md); continue; }
  const body = execSync(`npx --yes marked -i "${md}"`, { encoding: 'utf8' });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
  const htmlPath = join(tmpdir(), `cradlehq-${name}.html`);
  writeFileSync(htmlPath, html);
  const pdfPath = join(outDir, `${name}.pdf`);
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-pdf-header-footer',
    `--user-data-dir=${profile}`, `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
  ], { stdio: 'inherit' });
  console.log('wrote', pdfPath);
}
console.log('Done.');
