# Print pr2 — Print-view route (full book, trim+bleed)

**Status:** Complete — built + verified end-to-end 2026-07-16 (user confirmed the rendered PDF). `PrintBookPage`
+ `/print/book/:token` branch (frontend) + throwaway dev payload endpoint (backend). See "Build result" below.
**Est:** ~2 hours · **Depends on:** pr1 · **Blocks:** pr3
**Launch prompt:** `session-prompts.md` → pr2
**Read first:** `Frontend/src/lib/storybookPdf.js` (the existing off-screen render), `LayoutRenderer.jsx`

A frontend route that renders a **whole book, all pages in order, at print dimensions**, for headless Chrome
(pr1) to load and `page.pdf()`. This is the "reproduce the canvases" work — except there's nothing to
reproduce: it renders the **real** React components.

---

## What you're building

A route (`/print/book/{token}`, a pathname branch in `App.jsx` outside the auth gate — mirrors the
`/book/{token}` public branch) that:
- Renders **every page in book order** — the 10 named templates + the `LayoutRenderer` freeform fallback.
  **Interior only — the cover is pr4** (Q2 decision above). `LayoutRenderer` already dispatches all page types
  and has no auth/edit coupling, so this is **assembly, not new canvases**. Use `storybookPdf.js`'s existing
  dispatch as the reference for *what pages exist* (it has drifted twice — read it, don't hardcode).
- Feeds the **data-driven pages** (`birth-day`, `people`, `family-tree`, `milestones`) the same **`pageData`**
  (live DB state) they already take. The route **fetches** the unfiltered print payload by token (Q3) and
  rebuilds `pageData` the way `PublicBookPage` does (`buildAchievedMilestones` etc.). In pr2 the fetch hits the
  throwaway dev endpoint; pr3 swaps in the signed-token version.
- Applies **print CSS**: `@page` with **0.125" bleed** on every side, page box sized to **trim + bleed**,
  content laid out for **300 PPI** at the chosen trim (placeholder trim OK until pr0 confirms the SKU).
- Strips all app chrome (nav, pager, edit affordances) — it's a print surface, not the editor.

## Decisions from pr2 planning (2026-07-16)
- **Q1 — Aspect mapping = FIT-WHOLE + bleed the background (Option B).** Book canvas is 600×800 (**0.750**);
  8.5×11 trim is **0.773** (bleed page 8.75×11.25 = 0.778) — a ~3% gap. Center the **entire** 3:4 canvas on the
  sheet and **paint the whole bleed page in the page's background color** so it reaches the paper edge (full-bleed
  look, no white border). Chosen over scale-to-fill because pages are composed for the 3:4 frame with decoration
  near the edges (e.g. the `♥` at ~0.25" from the canvas edge in `MomentHeroCanvas`); scale-to-fill would crop
  ~0.17"/side top+bottom and clip it. Backgrounds are flat color, so the extension is a seamless. Interior photos
  are framed (polaroid), not full-bleed, so B loses nothing.
  - **Follow-up (logged, NOT pr2):** near-edge decoration (that `♥`, etc.) still prints ~0.25" from the trimmed
    edge — inside Lulu's 0.5" safety zone, so trim variance could shave it. That's a **template-level** print-safe
    pass (nudge near-edge decor inward), separate from the mapping. Track as a small follow-up.
- **Q2 — This route is INTERIOR-ONLY; the cover moves wholly to pr4.** Reconciles the old "including the cover"
  line (below) with Lulu's separate-cover-PDF requirement. The cover is a different render entirely (one wide
  back+spine+front wrap, its own `@page`, spine width from page count) so it does **not** belong in the per-page
  interior loop. pr4 builds a **sibling** route (e.g. `/print/cover/:token`) that reuses pr2's shared
  data-loader/scaffold helper (token, unauthenticated fetch, no-chrome, ready-signal) but has its own layout.
  Keeping the cover out means pr3 captures the interior with no "skip page 1" hack.
  - **First interior page:** start directly on the book's first real page for now (no reserved blank/half-title
    leaf); revisit if the physical proof looks off. Flagged, not locked.
- **Q3 — Data reaches the route by FETCH-BY-SIGNED-TOKEN (mirrors `PublicBookPage`); pr2 renders against a
  throwaway dev endpoint (Option A).** The frontend is a static SPA (Caddy/Vite, no server-side templating), so
  the route fetches its own payload the way `PublicBookPage` does, then flips `[data-print-ready]`. The sidecar
  only needs the URL. Two locked specifics:
  - **UNFILTERED payload — do NOT reuse `GET /book/public/{token}`.** The public endpoint is content-filtered
    (s13e-2 hides unfinished/unpublished pages); the owner printing their own book must get **every page**. Print
    needs its own payload that skips that filter.
  - **pr2 placeholder = dev-only endpoint** `GET /print/payload/dev/:bookId` (unauthenticated, dev-profile only,
    unfiltered) so pr2 renders **real live books through the real fetch path**. **pr3 hardens it** into the
    signed-token + owner-scoped version and adds the Java driver that mints the token + drives the sidecar. The
    dev endpoint is explicitly throwaway.
  - Supersedes the old "pr3 wires the data; pr2 accepts the prop" framing below — pr2 fetches.

## ⚠️ Notes
- **Placeholder trim is fine.** The mechanism is independent of exact dimensions; pr0's real `pod_package_id`
  just sets the numbers. Parameterize trim/bleed so swapping them later is a config change.
- **Fonts must be loaded** before Chrome captures (the existing pipeline waits on `document.fonts.ready` —
  the route/print service must do the same so text isn't captured mid-swap).

## Done when
- [ ] The route renders a full real book **interior** (every page type + freeform, **no cover** — that's pr4)
      with no app chrome.
- [ ] Pages are sized to trim+bleed with `@page` bleed; trim/bleed are parameterized.
- [ ] Data-driven pages accept and render `pageData`.
- [ ] It loads cleanly in headless Chrome (pr1) — fonts settled before paint.

## Build result (2026-07-16)
- **Frontend:** `Frontend/src/components/PrintBookPage.jsx` (fetch unfiltered payload → flatten chapters→pages →
  one `.print-sheet` [8.75×11.25in] each, fit-whole `.print-fit` [8.25×11in] around a single-page
  `LayoutRenderer`, `@page` bleed size, `break-after: page`, `[data-print-ready]` after fonts+images settle, no
  chrome). `App.jsx` gains a `/print/book/:token` pathname branch outside the auth gate (mirrors `/book/:token`).
- **Backend:** `PublicBookService.getByBookIdUnfiltered(bookId)` (all v2 pages, full pageData) +
  `PrintDevController` `GET /print/payload/dev/{bookId}` (`@Profile("!prod")`, throwaway) + `/print/**` permitAll.
- **Verified:** book 5 (Lily, 30 pages, midnight theme, all template types incl. freeform-fallback
  spotlight/growth-spread/hands-feet) → **30-page PDF, MediaBox 630×810pt = 8.75×11.25in, 6 embedded fonts, 35
  embedded photos, 3.8s** via the host sidecar over `http://localhost:3000/print/book/5`. `gradlew compileJava`
  ✓, `vite build` ✓. User confirmed the PDF looks right.

**Carry-forward for pr3:** replace the dev endpoint with a **signed-token, owner-scoped** payload endpoint
(`/print/payload/{token}`) + the Java service that mints the token and drives the sidecar (`POST /render` with
`http://<frontend>/print/book/<token>`, waitForSelector `[data-print-ready="true"]`). Delete `PrintDevController`.

## Not this session
The backend service that drives Chrome + supplies `pageData` (pr3) · the cover's spine math (pr4) · Lulu
(pr5). Just the renderable route.
