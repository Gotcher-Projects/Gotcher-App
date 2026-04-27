# PDF Export — Full-Page Portrait Spread

**Status:** Not started — held for future consideration
**Related work:** Journal UI polish session (April 2026)

## What it is
Give portrait photo entries their own full-page treatment in the PDF export. The photo fills
most of the page with white margins, title and date printed below (or overlaid with a light
scrim), and story text on the following page if present. Each portrait entry becomes a moment
to linger on rather than a card in a list.

This is the approach used by Chatbooks, Artifact Uprising, and similar photo-book services.

## Why it was held
The in-app storybook is the primary output for CradleHQ; PDF is secondary/complementary.
Full-page portrait spreads double the page count of a journal with many portrait photos,
which is only worthwhile if the PDF becomes a premium product touchpoint.

## Implementation sketch

In `pdf.js`, detect portrait entries during the layout pass and route them to a new
`renderPortraitSpread` function instead of `renderEntry`:

```js
// In generatePdf(), inside the render loop:
if (imgLayouts[i]?.portrait) {
  doc.addPage();
  renderPortraitSpread(doc, sorted[i], storyLinesArr[i], imgLayouts[i], babyName, pageNum, totalPages);
  if (storyLinesArr[i].length > 0) doc.addPage(); // story on next page
  // reset y for next entry
} else {
  // existing card layout
}
```

`renderPortraitSpread` would:
- Fill page with white background
- Center the image horizontally with ~12mm side margins and ~20mm top/bottom margins
- Print title (large, bold, centered) below the image
- Print date (small, muted, centered) below title
- Add page header/footer consistent with the rest of the document

## Tradeoff
- Pro: looks genuinely premium — portrait entries feel like a real photo book
- Pro: natural fit for milestone photos (first steps, first birthday) that deserve a full page
- Con: page count grows significantly if user has many portrait entries
- Con: adds complexity to the pagination/page-count logic (`countPages` would need to handle
  the variable page consumption per entry)
- Con: only worth building if PDF export becomes a paid or shareable feature
