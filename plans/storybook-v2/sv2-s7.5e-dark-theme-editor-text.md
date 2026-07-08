# SV2-S7.5e — Dark-theme editable text contrast

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished). (implemented 2026-07-01).** **Found:** s7.5b in-app verification 2026-07-01
(Michael). **Depends on:** none (independent of the other s7.5 work). Frontend only, no backend.

## Implemented
Passed each canvas's already-computed theme ink into the editor via the existing `RichTextEditor`
`textColor` prop, for every editable zone drawn on `theme.bg`. Zones on their own light surface (cream
note card, white polaroid, pink pill) were left with the default dark ink.
- **LetterCanvas** — title, body, signature → `ink`.
- **MomentHeroCanvas** — title → `titleColor`, date → `dateColor`; badge (pill), note + attrib (cream
  card) left dark per the audit.
- **ChapterDividerCanvas** — title → `ink`; label + subtitle → `sub(theme)`.
- **PromptsCanvas** — value lines → `ink`.
- **BumpCanvas** — title + week → `ink`; note (cream card) left dark.
- **GalleryCanvas** — title → `ink`; subtitle + captions → `sub`.
- **MilestonesCanvas** — date lines → `subColor`; polaroid caption (white frame) left dark.
- **Slot.jsx** — already passed `theme?.textColor`; confirmed correct (light themes have no `textColor`
  so the editor falls back to the dark app ink on a light page). No change.
- **Toolbar contrast** — the FormatToolbar renders in the app chrome (`bg-card`, above the canvas), not
  on the book page, so the Midnight book theme doesn't affect it. No change needed.
Full suite 337 green + Vite build green.

**Verify in-app:** switch a book to **Midnight**, edit each affected zone and confirm the typing text is
legible; confirm light themes are unchanged and zones on light surfaces (polaroid / note card / badge)
stay dark.

## Problem
On the **Midnight** (dark) book theme, when you tap a text zone to edit it — the letter body/title/
signature, and likely other editable zones drawn on the theme background — the **editing** text renders
in near-black on the dark page, so you can barely see what you're typing. The **read-only** render is
fine (it flips to a light ink); only the edit mode is wrong.

## Root cause
`RichTextEditor` already accepts a `textColor` prop and applies it as an inline `color`
(`RichTextEditor.jsx:19`) — but the canvases **don't pass it**. With no inline color, the editor falls
back to the `.book-rich` CSS default: `color: hsl(var(--foreground) / 0.85)` (`index.css:120–121`). That
`--foreground` is the **app's UI theme** token (dark), which is unrelated to the **book theme** system
(`theme.bg` / `theme.textColor` / `theme.isDark`). So the read-only paths that compute a theme-aware ink
(e.g. LetterCanvas `ink`, MomentHeroCanvas `titleColor`/`dateColor`) look right, but the editor ignores
the book theme entirely → black text on a dark page.

## Approach
For each editable zone **drawn directly on `theme.bg`**, pass the same theme-aware ink the read-only view
uses into `RichTextEditor` via the existing `textColor` prop (and to any inline-edit `<div>` paths). Leave
zones that sit on their **own light surface** (a white polaroid, a cream note card, a pink pill) with the
default dark ink — those are light regardless of theme.

Compute the ink the same way the read-only branch already does: `theme?.isDark ? (theme.textColor ?? '#e8eaf6') : <lightThemeInk>`.

## Per-canvas audit (all 8 use RichTextEditor)
Confirm each zone's surface before wiring; only theme-bg zones need `textColor`.
- **LetterCanvas** — title, body, signature all on `theme.bg` → pass `ink` (already computed). ⬅ the
  reported case. Note the body has its own inline-edit `<div>` branch (not just RichTextEditor) — style
  both.
- **MomentHeroCanvas** — title + date sit on `theme.bg` → pass `titleColor` / `dateColor` (already
  computed). badge (pink pill), note + attrib (cream card) stay dark.
- **ChapterDividerCanvas** — title/subtitle/label: on `theme.bg`? → likely need ink.
- **PromptsCanvas** — prompt answers: check surface.
- **BumpCanvas** — captions/week text: check surface.
- **GalleryCanvas** — captions: on the page bg vs on the photo — check.
- **MilestonesCanvas** — row text: check surface.
- **Slot.jsx** — generic template text slots render on the page bg (`theme.bg` / page bg) → need ink.

## Files
`RichTextEditor.jsx` (already supports `textColor` — no change unless a non-RichTextEditor inline path
needs it), and the 8 canvases above (pass the theme ink where a zone is on `theme.bg`).

## Testing
Switch a book to **Midnight**, edit each affected zone, confirm the typing text is legible; confirm
light themes are unchanged; confirm zones on light surfaces (polaroid/note card) stay dark. Full frontend
suite + build.

## Toolbar contrast (2026-07-01, Michael)
**In scope if it turns out to be an issue.** While doing the Midnight edit-mode pass, check the format
toolbar's legibility on the dark theme too; if it's hard to read, fix it here rather than spinning a
separate plan.

## Out of scope
Restyling the read-only render (already theme-aware); the app (non-book) UI theme.
