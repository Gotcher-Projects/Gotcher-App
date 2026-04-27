# PDF Export — Full Rewrite

**Status:** Not started — held for future consideration
**Related work:** Journal UI polish session (April 2026)

## Context
The current PDF export (`Frontend/src/lib/pdf.js`) was built as a stopgap before the
in-app storybook was conceived. It mirrors the old card layout using raw jsPDF draw calls
and is disconnected from the current theming and design system.

## Decision
Scrap and rewrite when the PDF becomes a real product touchpoint. Don't invest further in
patching the existing implementation.

## What a rewrite should consider
- Design from the storybook-first perspective — the PDF should feel like an export of the
  in-app storybook experience, not a separate product
- Consider a print CSS / browser print approach instead of jsPDF — lets the existing React
  components drive the layout, which stays in sync automatically as the UI evolves
- Or: generate the PDF server-side (Puppeteer / headless Chrome) so the output exactly
  matches what the user sees in the app
- Typography, spacing, and color should match the published chapter aesthetic from the
  storybook (serif body, relaxed leading) rather than the old helvetica/purple card style
- Portrait full-page spreads (see `pdf-portrait-full-page.md`) are much easier to implement
  in a clean rewrite than retrofitted onto the current layout engine
