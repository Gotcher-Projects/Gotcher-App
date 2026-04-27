# Journal — 2-Column Masonry Layout

**Status:** Not started — held for future consideration
**Related work:** Journal UI polish session (April 2026)

## What it is
Replace the single-column journal entry list with a 2-column masonry grid on desktop.
Cards flow top-to-bottom in each column; shorter cards (text-only) fill gaps left by taller
ones (image cards). On mobile it collapses back to single column automatically.

## Why it was held
The other journal improvements (hero overlay, month grouping, date badges, no-image accent
cards) were implemented first. Masonry adds layout complexity and the single-column list
reads well with those changes in place. Worth revisiting once there's real content to judge
whether the density is beneficial.

## Implementation approach
CSS `columns: 2` with `break-inside: avoid` on each card — no JS masonry library needed.
Change on the `<div className="lg:col-span-2 ...">` wrapper in `MemoriesTab.jsx`.

```jsx
// Current
<div className="lg:col-span-2 space-y-6">

// With masonry
<div className="lg:col-span-2 lg:columns-2 lg:gap-4 space-y-4 lg:space-y-0">
  {/* each Card gets: className="... break-inside-avoid mb-4" */}
```

## Demo
`plans/journal-card-masonry-demo.html` — side-by-side before/after visual.

## Tradeoff
- Pro: much more editorial feel, especially with a mix of image and text-only cards
- Con: reading order becomes column-first (top of col 1 → bottom of col 1 → top of col 2)
  which can feel non-chronological even with month grouping headers
- Con: month group separators (the `Month Year ────` dividers) would need special handling
  to span both columns, or be dropped in masonry mode
