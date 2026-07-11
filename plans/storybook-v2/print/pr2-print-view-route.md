# Print pr2 — Print-view route (full book, trim+bleed)

**Status:** Not started
**Est:** ~2 hours · **Depends on:** pr1 · **Blocks:** pr3
**Launch prompt:** `session-prompts.md` → pr2
**Read first:** `Frontend/src/lib/storybookPdf.js` (the existing off-screen render), `LayoutRenderer.jsx`

A frontend route that renders a **whole book, all pages in order, at print dimensions**, for headless Chrome
(pr1) to load and `page.pdf()`. This is the "reproduce the canvases" work — except there's nothing to
reproduce: it renders the **real** React components.

---

## What you're building

A route (e.g. `/print/book/{id}` behind auth or a signed token) that:
- Renders **every page in book order** — the 10 named templates + the `LayoutRenderer` freeform fallback +
  the **cover**. `LayoutRenderer` already dispatches all of these and has no auth/edit coupling, so this is
  **assembly, not new canvases**. Use `storybookPdf.js`'s existing dispatch as the reference for *what pages
  exist* (it has drifted twice — read it, don't hardcode).
- Feeds the **data-driven pages** (`birth-day`, `people`, `family-tree`, `milestones`) the same **`pageData`**
  (live DB state) they already take — the server must supply it (pr3 wires the data; pr2 accepts the prop).
- Applies **print CSS**: `@page` with **0.125" bleed** on every side, page box sized to **trim + bleed**,
  content laid out for **300 PPI** at the chosen trim (placeholder trim OK until pr0 confirms the SKU).
- Strips all app chrome (nav, pager, edit affordances) — it's a print surface, not the editor.

## ⚠️ Notes
- **Placeholder trim is fine.** The mechanism is independent of exact dimensions; pr0's real `pod_package_id`
  just sets the numbers. Parameterize trim/bleed so swapping them later is a config change.
- **Fonts must be loaded** before Chrome captures (the existing pipeline waits on `document.fonts.ready` —
  the route/print service must do the same so text isn't captured mid-swap).

## Done when
- [ ] The route renders a full real book (every page type + freeform + cover) with no app chrome.
- [ ] Pages are sized to trim+bleed with `@page` bleed; trim/bleed are parameterized.
- [ ] Data-driven pages accept and render `pageData`.
- [ ] It loads cleanly in headless Chrome (pr1) — fonts settled before paint.

## Not this session
The backend service that drives Chrome + supplies `pageData` (pr3) · the cover's spine math (pr4) · Lulu
(pr5). Just the renderable route.
