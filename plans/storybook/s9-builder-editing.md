# S9 — Scrapbook Builder III: Inline Editing, Backgrounds, Publish

**Status: Complete**
**Branch:** same as S7
**Depends on:** S8 complete and verified
**Roadmap:** builder-rewrite roadmap; decisions in `s6.4-improvements.md`

> **Stickers removed (2026-06-03):** per product decision, stickers are no longer part of the
> memory-book system. `lib/stickers.js` was deleted and all sticker UI/rendering removed from the
> builder, `LayoutEditor`, and `bookCanvas`. The original "Stickers" scope item below is dropped.

---

## Goal

Complete the builder's editing capability: edit and format the AI text in-slot, set per-page
backgrounds, and publish. This delivers the "tweak before publish" requirement.

---

## Scope

### Inline rich-text editing on text slots
- Extract and reuse `RichTextEditor` + `FormatToolbar` from `LayoutEditor.jsx`.
- Capabilities: **font family**, **font size (S/M/L)**, **alignment**, **bold**, **italic**, and
  **editing the text content**. No other rich-text features (the `tiptapExtensions` set is already
  minimal — bold/italic/paragraph/align).
- Extract the font-family picker overlay (currently inside `TextBlock`) into a standalone control.
- Activation UX suited to fixed slots (tap/click to select+edit, rather than the old double-tap).
- Use `useFittedFontSize` so edited text stays fit to its fixed slot.

### ~~Stickers~~ (removed — see note at top)

### Per-page background color
- Reuse the existing background-swatch control from `LayoutEditor` (theme palette swatches).

### Publish
- Publish from the builder: PATCH `status:'published'`. Drafts already autosave from S8.

---

## Reuse
- `components/storybook/RichTextEditor.jsx`, `FormatToolbar.jsx`, `FontPicker.jsx` — extracted
  from `LayoutEditor.jsx` (both the builder and the legacy editor import them now)
- `lib/tiptap.js` — `tiptapExtensions`, `FONT_SIZES`, `fontSizeKey`, `toTiptapDoc`
- `lib/bookCanvas.jsx` — `FONT_MAP`, `FONT_OPTIONS`, `REVERSE_FONT_MAP`, `RenderedText`
- `lib/fitText.js` — `useFittedFontSize`

---

## Files
- `Frontend/src/components/storybook/ScrapbookBuilder.jsx` — editing, stickers, bg, publish
- (likely) extract shared editor pieces into their own modules under `components/storybook/`
  (e.g. `RichTextEditor.jsx`, `FormatToolbar.jsx`, `FontPicker.jsx`) so S10 can delete
  `LayoutEditor.jsx` cleanly

---

## Verification
1. Select a text slot → edit its content; apply bold/italic/alignment/size/font → renders correctly.
2. Edited text stays fit to the fixed slot (no overflow).
3. Set a page background color → canvas + published page reflect it.
4. Publish from the builder → published chapter renders identically via `LayoutRenderer`.
5. All edits persist across reload.
