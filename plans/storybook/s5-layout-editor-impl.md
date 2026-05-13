# Session 5 — Layout Editor Implementation
**Status:** Not started
**Branch:** `feature/storybook`
**Depends on:** S3.1 (wizard working end-to-end), S3.5 (prompt tuning complete)

## Context

See `s4-layout-editor.md` for all design decisions from the S4 planning session.
This is the first (and likely only) implementation session for the layout editor.

## Decisions Summary (from S4 planning)
- Free-form canvas — drag + resize blocks at arbitrary positions
- Square 1:1 page, 800×800 logical units, percentage-based coordinate system
- `layout_data` JSONB column on `chapters` table (V30 migration)
- Wizard Step 5 is the UX entry point (after generation review, before Publish)
- 5 starting templates; photo tray for slot assignment; inline text editing
- Library: `react-rnd` (drag+resize, touch-friendly, CSS-based, no canvas element)
- Backward compat: old chapters without `layout_data` fall back to legacy inline-marker renderer

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

## Order of Work

### Step 1 — DB Migration (Backend)
- `Backend/db/migration/V30__chapter_layout_data.sql`
- `ALTER TABLE chapters ADD COLUMN layout_data JSONB;`
- No default, nullable — existing chapters have no layout_data

### Step 2 — Backend DTO + Service + Controller
- `ChapterResponse.java` — add `Map<String, Object> layoutData` field mapped from `layout_data`
- `StorybookService.java` — include `layout_data` in all SELECT queries; update `updateChapter()` to accept + persist it
- `StorybookController.java` — add `layoutData` to PATCH request body

### Step 3 — npm install react-rnd
- `cd Frontend && npm install react-rnd`

### Step 4 — Extract legacy renderer
- Create `Frontend/src/components/storybook/LegacyChapterRenderer.jsx`
- Move `parseBodySegments`, `lookupPhoto`, `renderPublishedBody`, `renderDraftBody`, `ChapterPhoto` out of `StorybookTab.jsx` into this file
- `StorybookTab.jsx` imports and uses `LegacyChapterRenderer` — no behavior change yet

### Step 5 — LayoutEditor component
**File:** `Frontend/src/components/storybook/LayoutEditor.jsx`

- Fixed-ratio container (`aspect-ratio: 1 / 1`, 100% width of parent)
- Scale factor: `containerPx / 800`; block CSS positions = `percentage × 800 × scale`
- `useRef` on container to measure actual rendered width; recalculate on resize (ResizeObserver)
- `react-rnd` wraps each block — `onDragStop` + `onResizeStop` convert CSS px back to percentages
- Block minimum size: 10% × 10%
- Blocks constrained to canvas bounds

**Template picker** (shown before canvas, or as a reset option):
- Horizontal scroll of 5 template cards with visual previews
- Selecting a template replaces `blocks` state with pre-set block array
- "Reset to template" button always available in toolbar

**Photo tray** (shown as a bottom sheet / side panel when assigning a photo):
- Pulls from chapter's `selectedJournalIds` + `selectedFirstTimeIds` + `photoOverrides`
- Click a photo block → open tray → click a photo to assign (updates block's `sourceKey` + `url` + `label`)
- Unassigned photo slots show a placeholder with "Tap to add photo" message

**Text block**:
- Single-click → drag mode (Rnd handles)
- Double-click → switch to edit mode: `contentEditable` or `<textarea>` overlay
- Blur / click outside → back to drag mode, save content to block state

**Block controls**:
- Toolbar button: "Add photo block" → adds a new unassigned photo block at center
- Delete handle: small × button in corner of each block (touch-friendly, 44px tap target)

**Auto-save**:
- Debounced 1 s after any block change → PATCH `/storybook/{id}` with `layoutData`
- Save indicator ("Saving…" / "Saved") in toolbar

### Step 6 — Wizard Step 5
**File:** `Frontend/src/components/storybook/StorybookWizard.jsx`

- Add step 5 after existing step 4 (generation review)
- Step 5 header: "Design Your Page"
- Renders `<LayoutEditor chapter={chapter} journalEntries={journalEntries} firsts={firsts} onSave={...} />`
- "Publish" button: save layout first, then call `onUpdate({ status: 'published' })`
- "Back" returns to step 4 without losing layout state
- "Skip & Publish" link: publish without layout (for users who don't want to design)

### Step 7 — LayoutRenderer + branch in StorybookTab
- `Frontend/src/components/storybook/LayoutRenderer.jsx` — read-only version of the editor
  - Same fixed-ratio container and percentage-to-px conversion
  - No Rnd handles, no editing — purely renders blocks from `layout_data`
- `StorybookTab.jsx`: when rendering a chapter, check `chapter.layoutData`:
  - If present → `<LayoutRenderer layout={chapter.layoutData} />`
  - If null → `<LegacyChapterRenderer ... />` (existing behavior)

## Files to Create / Modify

| File | Change |
|---|---|
| `Backend/db/migration/V30__chapter_layout_data.sql` | New |
| `Backend/.../storybook/dto/ChapterResponse.java` | Add `layoutData` |
| `Backend/.../storybook/StorybookService.java` | Read/write `layout_data` |
| `Backend/.../storybook/StorybookController.java` | Accept `layoutData` in PATCH |
| `Frontend/src/components/storybook/LegacyChapterRenderer.jsx` | New (extracted) |
| `Frontend/src/components/storybook/LayoutEditor.jsx` | New |
| `Frontend/src/components/storybook/LayoutRenderer.jsx` | New |
| `Frontend/src/components/storybook/StorybookWizard.jsx` | Add step 5 |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Branch on layoutData; use legacy fallback |

## Verification
1. Start services (`cd Backend && ./start-services.sh`)
2. Run the wizard start-to-finish → step 5 layout editor appears after generation
3. Template picker initializes blocks correctly for all 5 templates
4. Drag a photo block and a text block — positions persist after 1 s auto-save
5. Assign a photo to a slot from the photo tray — correct image renders
6. Double-click text block → edit → blur → content saved to `layout_data`
7. "Skip & Publish" publishes without layout_data
8. Published chapter with `layout_data` renders via LayoutRenderer in StorybookTab
9. Old chapters without `layout_data` still render correctly via LegacyChapterRenderer
10. Resize browser window — layout scales correctly on both editor and renderer

---

## Session Prompt (S5)
```
Session 5 of storybook — Layout Editor Implementation.
Plan: plans/storybook/s5-layout-editor-impl.md
Design decisions: plans/storybook/s4-layout-editor.md

All design decisions are in s4-layout-editor.md. This session is implementation only.

Order of work (follow the plan exactly):
1. V30 migration + backend DTO/service/controller (layout_data read/write)
2. npm install react-rnd in Frontend
3. Extract LegacyChapterRenderer.jsx from StorybookTab.jsx
4. Build LayoutEditor.jsx (template picker → free-form canvas with react-rnd)
5. Add step 5 to StorybookWizard.jsx
6. Build LayoutRenderer.jsx + branch in StorybookTab.jsx

Read s4-layout-editor.md and s5-layout-editor-impl.md before writing any code.
Read ChapterResponse.java, StorybookService.java, StorybookController.java, and
StorybookWizard.jsx before touching those files.
```
