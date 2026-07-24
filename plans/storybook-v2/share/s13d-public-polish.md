# Share s13d — Public page visual polish

**Status:** Complete (verified 2026-07-14) — `PublicBookPage.jsx`: column 520→600px, per-page 440px cap
removed (pages scale up), each page + the cover wrapped in a `rounded-xl` card with a hairline border + a
warm soft shadow (`SHEET_SHADOW`, cast on the cream desk so it reads on dark themes too), gap 24→32px.
Vite build clean. User confirmed both a light (`classic`, Noah) and dark (`midnight`, Lily) book render as
distinct carded sheets with clear breaks.
**Est:** ~1–1.5h · **Depends on:** s13b (the public renderer exists) · **Blocks:** nothing
**Scope:** FRONTEND ONLY — `Frontend/src/components/PublicBookPage.jsx`. No backend, no new endpoints,
no change to `LayoutRenderer` or any `*Canvas`. Pure layout/CSS on the outward-facing read page.

The s13b public page renders correctly but reads sparse and runs pages together. From the live book
(Noah, book 18) — screenshot `ScreenshotsForClaude/Screenshot 2026-07-14 175251.jpg`:

1. **Unused space.** Each page sits in a fixed ~440px column centered on a wide desktop viewport →
   large empty cream margins, pages feel small.
2. **Page breaks unreadable.** Pages stack with only a 24px gap; same-background pages (cream on cream)
   blend together, so you can't tell where one book page ends and the next begins.

## Decisions locked (Michael, 2026-07-14)

1. **Card each page.** Wrap every rendered page in a rounded card with a subtle border + soft drop
   shadow — the SAME treatment `CoverCard` already uses (`rounded-xl border border-[#ddd0b8] shadow-sm`,
   `overflow-hidden`). Each page reads as a distinct sheet on the cream "desk." Chosen over flat
   dividers / chapter-grouping for cohesion with the cover already on the page.
2. **Widen + paper framing.** Bigger single column (~560–600px) with the cream background acting as a
   framed desk around the pages. Chosen over a two-page spread (deferred — see "Not this session") and
   over a bare max-width bump.

## What to change (all in `PublicBookPage.jsx`)

- **Column width.** Bump the `Shell` `wide` container from `max-w-[520px]` toward `~600px`; drop the
  inner `max-w-[440px]` per-page cap so each page fills the wider column (LayoutRenderer scales to its
  container width, so a wider container = a larger page for free).
- **Per-page card.** Wrap each `<LayoutRenderer>` in a card: `rounded-xl overflow-hidden` + a hairline
  border + a soft shadow, matching `CoverCard`. `overflow-hidden` clips the 3:4 page to the rounded
  corners. Each page is a single-page layout (`pages:[page]`), so no pager chrome appears.
- **Separation / rhythm.** Increase the inter-card gap (e.g. `space-y-6` → `space-y-8`/`-10`) so breaks
  breathe. The cover card stays as-is (already carded) for consistency.
- **⚠️ Border/shadow must read on BOTH light and dark page backgrounds.** Some book themes have a dark
  page `bg` (e.g. `midnight`), so a light hairline border alone can vanish or clash. Lean on the soft
  shadow for separation (works on any bg) and keep the border low-opacity/neutral. Verify against a
  dark-theme book, not just Noah's `classic`.
- Keep the outward light/cream page surface, CradleHQ header/footer, and the 404 / empty states as-is.

## Done when

- [ ] Each page renders as a distinct, rounded, shadowed card — page breaks are obvious at a glance.
- [ ] Pages are visibly larger; the wide-desktop empty margins are reduced (framed-desk look).
- [ ] Responsive: at mobile width cards go full-width with sensible padding (no horizontal scroll).
- [ ] Card separation reads on a **dark-theme** book too (test one, not just `classic`).
- [ ] Cover + pages feel like one cohesive set; header/footer/404/empty unchanged.

## Not this session

- **Two-page spread** (the deferred layout alternative) — revisit only if the single-column framing
  still feels empty on very wide screens.
- **Chapter-grouping headers** (the deferred separation alternative).
- Any backend / payload / renderer change — this is CSS-and-layout only.

## Test link

s13b left book 18 (Noah) unlocked with a live token for iterating against; if it's been reverted,
re-unlock + mint via s13a (`POST /books/18/share` as `demo-bumptobaby@demoapp.com` / `DemoPass1`).
