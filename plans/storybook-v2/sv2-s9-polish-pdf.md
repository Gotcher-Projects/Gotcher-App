# SV2-S9 — Polish + PDF Integration   *(was sv2-s8; renumbered 2026-06-27)*

**Status: Not started.** Note (2026-06-27 direction update): the **auto Firsts chapter is dropped** — the
book page order no longer has "hero+gallery pairs" (line 49 below is stale). The guided book is the
pre-designed fill-in arc (25 / 30 pages — see the mockups); the PDF just chains that fixed page sequence.
New page types to audit also include the growth spread, prompt pages, bump page, and family-tree page.
**Depends on:** sv2-s7 complete (all page types exist and the guided fill-in book is functional)
**Reference:** `feedback_html2canvas_limitations.md` — what doesn't render in html2canvas

---

## Goal

Make all v2 page types export correctly to PDF, ensure the guided book has a clean Download PDF flow, and address any visual polish gaps identified during sv2-s6 and sv2-s7. This is a cleanup + completion session, not a feature session.

---

## Scope

### 1. PDF export for all new page types

Audit each new page type against html2canvas limitations. Known constraints:
- No `::first-letter` / `::first-child` pseudo-elements (use span wrapping instead)
- No `mask-image` (stickers use this — not relevant here)
- No `position: fixed` (avoid in page renderers)
- CSS custom properties (`--book-accent` etc.) must be explicitly set on the off-screen wrapper
- Fonts must be fully loaded before capture

Checklist:
- [ ] `LetterPage.jsx` — script/italic font loaded? `--book-accent` set on wrapper?
- [ ] `BirthDayPage.jsx` — stats card row renders correctly at 600px?
- [ ] `PeoplePage.jsx` — photos load before capture?
- [ ] `MomentHeroPage.jsx` — already handled in S13; verify theme variables
- [ ] `GalleryPage.jsx` — 2×2 grid renders at correct proportions?
- [ ] `ChapterDividerPage.jsx` — floating decoratives (absolutely positioned spans) render?

Off-screen render pattern (already established in `bookCanvas.jsx`):
```js
// wrapper must have: width=600px, explicit CSS vars, book-rich--edit class
```

### 2. Guided book PDF export

The guided book needs its own "Download PDF" button. Options:
- **A) Extend existing `storybookPdf.js`** — pass guided book page sequence instead of chapter list
- **B) New `guidedBookPdf.js`** — parallel to existing, handles the arc-driven page sequence

Option A is preferred if the existing PDF function can accept an abstract `pages[]` array regardless of source.

The PDF page sequence for the guided book:
```
[cover] [chapter_divider] [letter] [people...] [chapter_divider] [birth_day] [chapter_divider] [hero+gallery pairs...]
```

### 3. Visual polish

Collect polish items identified during sv2-s6/s7 testing:
- Typography refinements (letter page script font weight, sizing)
- Chapter divider decorative element placement
- Hero photo frame shadow consistency across themes
- Stats card number formatting (weight in lbs/oz vs kg — unit consistency)
- Empty state placeholder page styling

### 4. Theme support

Verify all new page types respect `bookThemeKey`:
- Background color (`bg`)
- Accent color (`accent`) — used for category labels, note borders, decorative elements
- Text color
- Font class (`fontClass`)

Each new page type should apply theme variables consistently, matching how `LayoutRenderer` does it.

---

## Files to touch

| File | Change |
|---|---|
| `Frontend/src/lib/storybookPdf.js` | Extend to handle guided book page sequence |
| `Frontend/src/components/storybook/GuidedBook.jsx` | Add Download PDF button |
| All new page components | PDF capture fixes as identified during audit |
| `Frontend/src/index.css` | Any new CSS needed for new page types |

---

## Open questions (resolve at session start)

1. **Guided book PDF vs scrapbook PDF:** Two separate buttons, or one unified "Download PDF" in StorybookTab that merges both?
2. **Page order when both scrapbook and guided book exist:** If a user has both scrapbook chapters and a guided book, does the PDF include both or let the user choose?

---

## Verification

1. Download PDF from guided book produces a complete PDF with all sections.
2. All new page types render correctly at 600px (no clipping, no missing fonts, no unstyled elements).
3. Chapter divider floating decoratives appear in the PDF.
4. Stats card renders cleanly (numbers not cut off).
5. All themes produce correctly themed PDFs.
