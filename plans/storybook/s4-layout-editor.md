# Session 4 — Layout Editor
**Status:** Planning complete — ready for S5 implementation
**Branch:** TBD
**Depends on:** S3 complete (wizard + generation pipeline working end-to-end)
**Session structure:** S4.0 = planning session (this doc), S5+ = implementation sessions

## Concept

After the wizard generates a chapter, give the user a **layout editor** where they can
arrange photos and text on the page before publishing. The editor should:

- Let the user see the chapter page in real time as they make changes
- Allow photos to be placed in specific spots on the page
- Allow text boxes to be resized / repositioned
- Feel like a simple page designer, not a full word processor

This replaces the current approach of having Claude auto-place photo markers in the chapter
body — that approach produced inconsistent results and made it hard for the user to control
the final layout. Photos are **removed from the AI generation step entirely** (see S3.5 note).

## Decisions (from S4.0 planning session — 2026-05-10)

| Question | Decision |
|---|---|
| Layout model | **Free-form canvas** — drag + resize blocks at arbitrary x/y positions |
| Page format | **Square 1:1** (800×800 logical units, scales to container width) |
| Templates | **Template picker as starting point** — 5 templates pre-position blocks; user drags freely from there |
| Photo handling | **Photo tray** — wizard's selected photos (selectedJournalIds + selectedFirstTimeIds + photoOverrides); tap a photo slot to assign from tray |
| Text | **Single text block**, inline editable (double-click → textarea), resizable |
| Persistence | **`layout_data` JSONB column** on `chapters` table (V30 migration); NULL for old chapters |
| Rendering | **Live render from layout_data** — no snapshot image; old chapters fall back to existing inline-marker renderer |
| Mobile scaling | **Percentage-based coordinates** (0.0–1.0) — resolution-independent, scales to any screen |
| UX entry point | **Wizard Step 5** ("Design Your Page") — after generation review, before Publish; skip button available |
| MVP scope | Template picker + photo assignment + inline text editing (all in S5) |
| Library | **react-rnd** — drag+resize with touch support, bounds constraints, pure CSS/DOM |

## Layout Data Format

```json
{
  "version": 1,
  "blocks": [
    {
      "id": "text-0",
      "type": "text",
      "x": 0.05, "y": 0.05,
      "width": 0.90, "height": 0.40,
      "content": "AI-generated chapter body..."
    },
    {
      "id": "photo-0",
      "type": "photo",
      "x": 0.05, "y": 0.50,
      "width": 0.45, "height": 0.45,
      "sourceKey": "journal:123",
      "url": "https://...",
      "label": "First smile"
    }
  ]
}
```

## Starting Templates

| Name | Layout |
|---|---|
| Classic | Text top 40%, photo full-width bottom 55% |
| Side by Side | Text left 50%, photo right 50% |
| Hero | Full-page photo, text overlay strip at bottom 20% |
| Gallery | Two photos side by side top 50%, text below |
| Text Only | Full-page text block, no photo slots |

## Deferred from S3.5
- Inline photo markers in Claude output — removed from AI prompt, no longer generated
- Photo rendering in chapter view — removed until layout editor is ready
- The photo placement code in `StorybookTab.jsx` (`renderPublishedBody`, `renderDraftBody`,
  `ChapterPhoto`, `parseBodySegments`, `lookupPhoto`) should be cleaned up or stubbed out
  before S4.1 begins

## Notes
- This is a significant frontend feature — likely the most complex UI in the app so far
- Will need a planning session (S4.0) to answer the open questions above before writing code
- Expect 2–3 implementation sessions (S5, S6, possibly S7) depending on scope decisions — see renumbering note below
- Consider whether a canvas-based approach (e.g. Fabric.js, Konva.js) is warranted vs.
  a pure CSS/flexbox layout with drag-and-drop (e.g. dnd-kit)

## Session Renumbering Required

The layout editor is being inserted before the Share Link and Print sessions, and its
implementation sessions should use **flat session numbers** (S5, S6, …) rather than
sub-session notation (S4.0, S4.1, S4.2). Before starting implementation, rename all
affected files:

| Current file | Should become | Title |
|---|---|---|
| `s4-layout-editor.md` | `s4-layout-editor.md` | S4 — Layout Editor (planning) |
| *(new)* | `s5-layout-editor-impl.md` | S5 — Layout Editor Implementation 1 |
| *(new, if needed)* | `s6-layout-editor-impl.md` | S6 — Layout Editor Implementation 2 |
| `s4.1-share-link.md` | `s7-share-link.md` | S7 — Shareable Book Link |
| `s5-print.md` | `s8-print.md` | S8 — Print on Demand |

Exact numbers will depend on how many implementation sessions the layout editor needs —
adjust Share Link and Print numbers accordingly at that time.

---

## Files to Create/Modify in S5

| File | Change |
|---|---|
| `Backend/db/migration/V30__chapter_layout_data.sql` | New — add `layout_data JSONB NULL` to chapters |
| `Backend/.../storybook/dto/ChapterResponse.java` | Add `layoutData` field |
| `Backend/.../storybook/StorybookService.java` | Read/write `layout_data` column |
| `Backend/.../storybook/StorybookController.java` | Accept `layoutData` in PATCH body |
| `Frontend/src/components/storybook/LayoutEditor.jsx` | New — free-form editor component |
| `Frontend/src/components/storybook/LayoutRenderer.jsx` | New — read-only renderer from layout_data |
| `Frontend/src/components/storybook/LegacyChapterRenderer.jsx` | New — extracted inline-marker fallback |
| `Frontend/src/components/storybook/StorybookWizard.jsx` | Add step 5 |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Branch on layoutData; use LayoutRenderer or legacy |

## Cleanup to do first in S5

Extract legacy inline-marker code from `StorybookTab.jsx` into `LegacyChapterRenderer.jsx`:
- `parseBodySegments`, `lookupPhoto`, `renderPublishedBody`, `renderDraftBody`, `ChapterPhoto`

---

## Session Prompt (S5 — Implementation 1)
```
Session 5 of storybook — Layout Editor Implementation (first session).
Plan: plans/storybook/s4-layout-editor.md

Decisions from S4 planning (all in the plan file):
- Free-form canvas, square 1:1, react-rnd for drag+resize
- layout_data JSONB on chapters table (V30 migration)
- Wizard step 5 is the UX entry point
- Percentage-based coordinates (0.0–1.0)
- 5 starting templates; photo tray for slot assignment; inline text editing
- Backward compat: old chapters without layout_data fall back to legacy inline-marker renderer

Order of work:
1. V30 migration + backend DTO/service/controller (layout_data read/write)
2. npm install react-rnd in Frontend
3. Extract LegacyChapterRenderer.jsx from StorybookTab.jsx
4. Build LayoutEditor.jsx (template picker → free-form canvas)
5. Wire up wizard step 5 in StorybookWizard.jsx
6. Add LayoutRenderer.jsx + branch in StorybookTab.jsx
```
