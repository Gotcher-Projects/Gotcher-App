// CradleHQ PDF sidecar (print pr1)
// ---------------------------------
// A tiny Node/Puppeteer service. The Spring API POSTs it a print-view URL (pr2/pr3) and gets back a
// print-spec PDF (vector text, embedded fonts, native-res images). Chromium lives in THIS image, not the
// Alpine API image — that's the whole reason for a sidecar (see pr1-headless-chrome-spike.md).
//
// This is the pr1 spike surface: one endpoint (/render) + a bundled self-test page that proves the
// mechanism offline. The real book route and the Java client come in pr2/pr3.

import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 4000);
const EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined; // set in Docker; undefined = puppeteer's own Chromium (local dev)
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS || 60000);

// ── Transparency flatten (print pr5.5, Part B) ────────────────────────────────────────────────────
// Chrome's page.pdf() (Skia/PDF) emits unflattened transparency — /Transparency groups + /SMask soft
// masks from CSS opacity, masked images, shadows, rounded corners. Lulu's normalizer REJECTS that (a real
// 32-page submit failed on it, job 314960). Ghostscript's pdfwrite re-emits a print-safe PDF that removes
// the live transparency while KEEPING vector text + full-resolution images (downsampling disabled below),
// which rasterizing the page would destroy.
//
// GS_BIN: the prod container (Debian) ships `gs`; on Windows the Ghostscript console binary is `gswin64c`.
// Default per-platform, override with GHOSTSCRIPT_PATH (e.g. a full path if it isn't on PATH). Locally the
// sidecar runs natively (start-services.sh), so if Ghostscript isn't installed the pass DEGRADES: we log once
// and return the un-flattened bytes so /render still works for non-Lulu dev use. The response carries
// `X-Pdf-Flattened: true|false` so callers/verification can tell whether the flatten actually ran.
const GS_BIN = process.env.GHOSTSCRIPT_PATH || (process.platform === 'win32' ? 'gswin64c' : 'gs');
const FLATTEN_PDF = process.env.FLATTEN_PDF !== '0'; // on by default; set FLATTEN_PDF=0 to disable
let warnedNoGs = false;

async function flattenPdf(bytes) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pdf-flatten-'));
  const inPath = path.join(dir, 'in.pdf');
  const outPath = path.join(dir, 'out.pdf');
  try {
    await writeFile(inPath, bytes);
    await new Promise((resolve, reject) => {
      const gs = spawn(GS_BIN, [
        '-dBATCH', '-dNOPAUSE', '-dSAFER', '-q',
        '-sDEVICE=pdfwrite',
        // 1.3 (NOT 1.4): PDF 1.4 *supports* live transparency, so pdfwrite passes Chrome's /Transparency +
        // /SMask groups straight through (verified — they survived at 1.4). PDF 1.3 predates transparency, so
        // Ghostscript is forced to COMPOSITE it away — which is exactly the flatten Lulu requires.
        //
        // ⚠ This is a SAFETY NET, not the primary fix. The print routes avoid transparency at the source (CSS
        // `zoom` instead of `transform: scale()` — the structural per-page group), so gs only has to flatten
        // the FEW pages that still carry transparency (the decorative chapter dividers + milestones). Ghostscript
        // rasterizes a whole page only where transparency is present, so those pages become raster while every
        // clean page stays vector text — hence the tiny/fast output vs. flattening the whole book.
        '-dCompatibilityLevel=1.3',
        // -r300: rasterize the transparent pages at Lulu's 300 PPI target (gs defaults to 720 → huge/slow).
        '-r300',
        // Keep the (native-res) images on the VECTOR pages untouched — don't let pdfwrite downsample them.
        '-dDownsampleColorImages=false',
        '-dDownsampleGrayImages=false',
        '-dDownsampleMonoImages=false',
        '-dAutoRotatePages=/None',
        `-sOutputFile=${outPath}`,
        inPath,
      ]);
      let stderr = '';
      gs.stderr.on('data', d => { stderr += d.toString(); });
      gs.on('error', reject);
      gs.on('close', code => code === 0 ? resolve() : reject(new Error(`gs exited ${code}: ${stderr.trim()}`)));
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Browser lifecycle: launch once, reuse across requests, relaunch if it dies ────────────────────
let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      const connected = typeof b.connected === 'boolean' ? b.connected : b.isConnected();
      if (connected) return b;
    } catch {
      /* fall through to relaunch */
    }
    browserPromise = null;
  }
  browserPromise = puppeteer.launch({
    headless: true,
    executablePath: EXECUTABLE_PATH,
    // --no-sandbox: required to run Chromium as non-root in a container.
    // --disable-dev-shm-usage: /dev/shm is tiny in containers; avoids Chrome crashes on big pages.
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  return browserPromise;
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', async (_req, res) => {
  try {
    const b = await getBrowser();
    const connected = typeof b.connected === 'boolean' ? b.connected : b.isConnected();
    res.json({ ok: true, chromium: connected });
  } catch (err) {
    res.status(503).json({ ok: false, error: String(err?.message || err) });
  }
});

// POST /render
//   Body: { url? , html? , waitForSelector? , emulateMedia='print' , timeoutMs? , pdf?={} }
//   Provide exactly one of `url` / `html`. Returns application/pdf.
app.post('/render', async (req, res) => {
  const {
    url,
    html,
    waitForSelector,
    emulateMedia = 'print',
    timeoutMs,
    pdf = {},
  } = req.body || {};

  if (!url && !html) {
    return res.status(400).json({ error: 'provide "url" or "html"' });
  }
  const timeout = Number(timeoutMs || NAV_TIMEOUT);

  let page;
  const started = Date.now();
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.emulateMediaType(emulateMedia);

    if (url) {
      await page.goto(url, { waitUntil: 'networkidle0', timeout });
    } else {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout });
    }

    // Ready-signal discipline (the pr2/pr3 seam): fonts must be settled before capture, or text is
    // grabbed mid-swap. Optionally wait for an app-set marker too.
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout });
    }

    // preferCSSPageSize honours the page's @page size (trim+bleed); printBackground keeps colored fills.
    const rawBytes = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      ...pdf,
    });

    // Flatten transparency for Lulu (pr5.5 Part B). Degrades to the raw bytes if gs is unavailable.
    let outBytes = Buffer.from(rawBytes);
    let flattened = false;
    if (FLATTEN_PDF) {
      try {
        outBytes = await flattenPdf(outBytes);
        flattened = true;
      } catch (err) {
        const msg = String(err?.message || err);
        if (/ENOENT/.test(msg)) {
          if (!warnedNoGs) {
            console.warn(`[render] Ghostscript ("${GS_BIN}") not found — returning UN-flattened PDF. `
              + 'Install Ghostscript (or set GHOSTSCRIPT_PATH) so Lulu-bound PDFs get their transparency flattened.');
            warnedNoGs = true;
          }
        } else {
          console.warn('[render] transparency flatten failed, returning un-flattened PDF:', msg);
        }
      }
    }

    res.set('Content-Type', 'application/pdf');
    res.set('X-Render-Ms', String(Date.now() - started));
    res.set('X-Pdf-Flattened', String(flattened));
    res.send(outBytes);
  } catch (err) {
    console.error('[render] failed:', err);
    res.status(500).json({ error: String(err?.message || err) });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

const server = app.listen(PORT, () => {
  console.log(`pdf-sidecar listening on :${PORT} (chromium: ${EXECUTABLE_PATH || 'puppeteer-bundled'})`);
});

async function shutdown(signal) {
  console.log(`\n${signal} — shutting down`);
  server.close();
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
