# Print pr1 — Headless-Chrome infra spike + decision

**Status:** Complete — built + proven 2026-07-16 (host **and** Docker); user verified the self-test PDF looks
right (2026-07-16). Sidecar = `pdf-sidecar/`, wired into `Backend/docker-compose.yml`. See "Build result" below.
**Est:** ~2 hours · **Depends on:** nothing (can run early) · **Blocks:** pr2, pr3
**Launch prompt:** `session-prompts.md` → pr1
**Read first:** `print-full-plan.md` → "PDF renderer"

Stand up the server-side Chrome-to-PDF mechanism and **decide how Java drives it** — then prove it renders
one real page well. Goal is a proven mechanism + a decision, not the pipeline.

---

## ✅ DECIDED 2026-07-16 — Node/Puppeteer sidecar

The mechanism is **locked to a Node/Puppeteer sidecar** (a small Node service in its own container; the Spring
API POSTs it a print-route URL and gets PDF bytes back). This session no longer *chooses* — it **builds and
proves** that shape.

**Why the sidecar over Playwright-Java-in-the-API-image:**
- **The API image is Alpine/musl** (`Backend/Dockerfile` → `eclipse-temurin:21-jre-alpine`). Playwright's
  bundled Chromium is glibc/Debian and **not supported on Alpine** — going in-process would force fighting musl
  or **converting the whole API base image to Debian slim**, welding print's infra risk onto the API container.
  The sidecar gets its own Debian-based Node/Puppeteer image and **the Alpine API image never changes**.
- **Isolation on one small VPS** — a full-book render can spike memory; in the sidecar it can't OOM-kill the
  Spring API. In-process Playwright-Java shares that memory.
- **Maturity** — Puppeteer is the reference implementation for `page.pdf()` (font embedding, print CSS, `@page`
  bleed are best-documented there).
- **Cost accepted:** one more compose service (idle Node ~30–50MB; Chrome only during renders) + an internal
  HTTP hop. Cheap for an app that renders books occasionally.

The old decision table (sidecar vs Playwright-Java) is resolved above. Chromium lives in the **sidecar** image,
not the API. Dev runs the sidecar **natively** (via `start-services.sh`, so localhost resolves for the
sidecar→frontend→API chain — Approach A, 2026-07-16); the **container** (Dockerfile in `pdf-sidecar/`) is for
**prod** and goes into `docker-compose.prod.yml` in pr10.

## Two seams to stay aware of (pr2/pr3 land on these; pr1 may stub them)
1. **How the sidecar reaches the route + auth.** It navigates to something like `/print/book/{id}?token=…`;
   the SPA is rendered by an **unauthenticated** Chrome, so the print route needs a **signed/short-lived token**.
   pr1 can prove the mechanism against one page with a stub route — just flag the token seam.
2. **The "ready" signal.** Chrome must wait for `document.fonts.ready` **plus** a render-complete flag before
   `page.pdf()`, or it captures mid-paint (`storybookPdf.js` already waits on fonts — same discipline).

## The spike

Render **one real book page** (pick a text-heavy one, e.g. `letter`, and an image one, e.g. `gallery`) to
PDF via `page.pdf()` and inspect:
- [ ] **Text is vector** (selectable in the PDF, crisp at zoom) — the whole point vs the raster path.
- [ ] **Images embed at native resolution** (not down-sampled to a page raster).
- [ ] **Fonts embedded** automatically.
- [ ] File size is sane; render time per page is acceptable.

## Done when
- [x] The sidecar-vs-Playwright-Java decision is **made and written down** (sidecar — see above, 2026-07-16).
- [x] The Node/Puppeteer sidecar image builds and Chrome launches headless inside it (Debian + distro Chromium;
      `docker compose build pdf-sidecar` ✓, container `/health` → `{ok:true,chromium:true}`).
- [x] The sidecar runs in dev via `start-services.sh` (native, port 4000). *(Originally added to
      `Backend/docker-compose.yml`; moved to a native `start_service` line 2026-07-16 — Approach A — so localhost
      resolves for the sidecar→frontend→API chain. Container reserved for prod / pr10.)*
- [x] A page renders to a PDF with **vector text + native-res images** (embedded fonts, sane size/time) — proven
      on host **and** in-container against the bundled self-test page (see Build result).

## Build result (2026-07-16)
`pdf-sidecar/` — Express + Puppeteer service; `POST /render {url|html}` → `application/pdf` (waits
`document.fonts.ready` + optional `[data-print-ready]`; `printBackground` + `preferCSSPageSize` on by default).
Proof rendering the bundled `public/self-test.html`:

| | Host (Puppeteer's Chromium) | Container (Debian `node:20-bookworm-slim` + distro `chromium`) |
|---|---|---|
| Render time / page | ~1.4s | ~1.2s |
| Vector text | ✓ 12 font objects | ✓ |
| Embedded fonts | ✓ 6 `FontFile2` | ✓ 5 `FontFile2` (Liberation) |
| Native-res image | ✓ 900×1200 Image XObject, **ICCBased/sRGB**, not downsampled | ✓ |
| `@page` trim+bleed | ✓ MediaBox 630×810pt = **8.75×11.25in** | ✓ |

Verify: `cd pdf-sidecar && npm install && npm start` then `npm run smoke` (host), or from `Backend/`:
`docker compose up -d --build pdf-sidecar` then `cd ../pdf-sidecar && npm run smoke`.

**Carry-forward for pr2/pr3:**
- **Fonts** — the container embeds whatever Chrome resolves; it ships Liberation/DejaVu/Noto-emoji. The real
  book's custom fonts should be **web-loaded by the print route** (they embed automatically) — or added to the
  image if self-hosted. Confirm when pr2 renders the real canvases.
- **Full book = one render.** The print route emits all pages in one document, so it's a single `page.pdf()`
  call, not N per-page renders; watch total render time + memory on a big book, but there's no per-page tax.
- **Prod (pr10):** the sidecar **container** isn't in `docker-compose.prod.yml` yet — that's a pr10 step (first
  prod deploy of the renderer). Dev runs the sidecar **natively** via `start-services.sh` (Approach A).

## Not this session
The full-book route (pr2) · the backend assembly service (pr3) · bleed/trim conformance (pr2/pr3) · Lulu
(pr5). Just prove the mechanism and pick the shape.

## Closing note
**Mechanism chosen: Node/Puppeteer sidecar** (`pdf-sidecar/`), built + proven on host and in Docker 2026-07-16.
Per-page render ~1.2–1.4s. pr2 (print-view route) and pr3 (Java calls `POST /render` with a signed route URL)
build directly on it.
