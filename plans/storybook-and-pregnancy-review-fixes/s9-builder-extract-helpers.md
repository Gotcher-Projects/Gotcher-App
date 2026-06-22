# s9 — ScrapbookBuilder: Extract Testable Helpers

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** s7 (shared utilities exist)
**Source:** `branch-review.html` → Pass 3 (P3) + Pass 2/Pass 5 (builder)

---

## Goal
Lift ScrapbookBuilder's pure, logic-heavy helpers into a lib module so they're independently unit
testable — a prerequisite for the safe component split in s10. No behaviour change.

## Scope
- Extract from `ScrapbookBuilder.jsx` into a new `lib/storybookLayout.js` (name TBD during session):
  - `splitTextParts(text, n)` — paragraph→sentence→word boundary splitting.
  - `initPages(chapter)` — v1/empty → v2 page fold, including `migrateBlock`.
  - `buildLayoutData(pages)` — pages → v2 layout payload.
  - `migrateBlock(b)` — id backfill + legacy-string → Tiptap migration.
- Keep imports working in `ScrapbookBuilder` (re-import from the new module).
- Add `Frontend/src/test/storybookLayout.test.js`:
  - `splitTextParts`: 1 part returns whole; paragraph split; sentence-boundary fallback; word
    fallback; degenerate (no spaces) case.
  - `initPages` ↔ `buildLayoutData` round-trip preserves blocks/pages; v1 input folds into one page;
    `migrateBlock` backfills ids and converts legacy strings.

## Files
- `Frontend/src/lib/storybookLayout.js` (new)
- `Frontend/src/components/storybook/ScrapbookBuilder.jsx` (import from new module)
- `Frontend/src/test/storybookLayout.test.js` (new)

## Verification
1. `npm run test` — new helper tests pass.
2. Manual: builder still loads v1 and v2 chapters identically; autosave produces the same layout JSON.
