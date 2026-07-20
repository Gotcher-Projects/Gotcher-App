# pdf-sidecar — headless-Chrome PDF service (print pr1)

A tiny Node/Puppeteer service that renders a print-view URL (or raw HTML) to a **print-spec PDF** — vector
text, embedded fonts, native-resolution images. The Spring API calls it over HTTP (pr3); Chromium lives in
**this** image so it never has to go into the Alpine/musl API image.

> Decision + rationale: `../plans/storybook-v2/print/pr1-headless-chrome-spike.md` (sidecar chosen over
> in-process Playwright-Java). This directory is the pr1 spike: prove the mechanism, not the full pipeline.

## Endpoints
- `GET /health` → `{ ok, chromium }`.
- `POST /render` → `application/pdf`. Body:
  ```json
  { "url": "https://…/print/book/123?token=…",
    "html": "<html>…</html>",
    "waitForSelector": "[data-print-ready=\"true\"]",
    "emulateMedia": "print",
    "timeoutMs": 60000,
    "pdf": { "preferCSSPageSize": true, "printBackground": true } }
  ```
  Provide exactly one of `url` / `html`. Defaults already set `printBackground` + `preferCSSPageSize`.
- Static: the bundled `public/self-test.html` + generated `public/sample.png`.

## Run it (Docker — the real path)
From `Backend/`:
```sh
docker compose up -d --build pdf-sidecar
cd ../pdf-sidecar && npm run smoke      # writes out/self-test.pdf
```

## Run it (local, no Docker — quick host proof)
Puppeteer downloads its own Chromium on `npm install` (Windows/macOS/Linux), so you can prove the mechanism
without building the image:
```sh
npm install
npm run gen-sample        # creates public/sample.png
npm start                 # listens on :4000
# in another shell:
npm run smoke             # writes out/self-test.pdf
```

## What the self-test proves
Open `out/self-test.pdf` and confirm: **selectable vector text**, **embedded serif + sans fonts**, the
**pink→indigo background** (printBackground), and a **sharp 900×1200 image** when zoomed (native-res embed).

## Seams for pr2/pr3 (flagged, not built here)
- **Auth** — the print route is loaded by an *unauthenticated* Chrome, so it needs a **signed/short-lived
  token** in the URL. The sidecar just forwards whatever URL it's given.
- **Reaching the app in dev** — the container gets `host.docker.internal` (see compose `extra_hosts`), so it
  can hit the host frontend/API when the pr2 route exists.
- **Ready signal** — `/render` waits on `document.fonts.ready` and (optionally) a `waitForSelector` marker;
  the print route should set `[data-print-ready]` once its data + images have settled.
