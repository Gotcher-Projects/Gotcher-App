# S6 — Scrapbooking: AI Content as Pieces, User Assembles Layout

**Status: Planning / Exploration**
**Branch:** TBD (cut from journal-updates after S5.9)
**Depends on:** S5.9 (PDF export — full layout pipeline stable)

---

## The Problem

Two related gaps in the current flow:

1. **Template switching wipes content.** When a user applies a different template in the Layout Editor, all existing blocks (including text they may have edited) are discarded and replaced with the template's defaults. There's no way to reuse content across templates.

2. **AI generates one flat blob per page.** Currently the AI produces `{ body, pullQuote }` and the frontend mechanically packs them into a fixed template. Users have no ability to remix the AI's output — they either take the generated layout as-is or manually retype everything.

---

## The Vision — "Scrapbooking"

**Physical scrapbooking analogy:** You have a pile of *content pieces* (photos, journal clippings, quotes, captions) and you arrange them on a page. The page layout is separate from the content.

In digital terms:
- The **AI generates named content pieces** for each memory: a body, a pull-quote, a short caption, a one-liner title, possibly multiple body variants.
- These pieces are **stored on the chapter** (separate from the current layout).
- The **Layout Editor exposes a content palette** — a sidebar showing the available AI-generated pieces for the page's source memory.
- **Templates know which slots they use.** When you apply a template, it fills slots from the stored pieces (body → text block, pullQuote → quote block, etc.) rather than starting empty. Previously-filled slots are preserved.
- Users can **drag pieces from the palette onto the canvas**, place them in any block, or freely type their own content — exactly as today.

This also enables a richer AI generation prompt in the future: instead of "write 90–160 words", the AI can write body + a short title + a pull quote + a one-liner caption, all independently usable.

---

## Architecture Sketch

### Content Piece Schema

```json
{
  "body": "Long-form narrative prose (90–160 words)",
  "pullQuote": "Short lyrical excerpt (≤12 words)",
  "caption": "One sentence caption for a photo (≤15 words)",
  "title": "Short evocative title for the memory (≤6 words)"
}
```

Stored as `generated_content JSONB` on the `chapters` table (new column, nullable). Populated when AI generation runs; survives template changes.

### Per-Page Content (for paged chapters)

Each page in `layout_data.pages[]` already has a `sourceKey`. The per-page AI content could be stored:

- **Option A:** Inline in `layout_data.pages[i].generatedContent { body, pullQuote, caption, title }` — keeps everything self-contained per page.
- **Option B:** Top-level on the chapter as `generated_content: { [sourceKey]: { body, pullQuote, ... } }` — easier to query independently.

Option B is likely better for the "content palette" UX (source of truth separate from the layout).

### Template Slot Mapping

Each template definition gains a `slots` map:

```js
{
  id: 'photo-hero',
  label: 'Hero Photo + Caption',
  slots: { photo: 'hero', text: 'caption' },  // or 'body', 'pullQuote', 'title'
}
```

When a template is applied, its slots are filled from the page's stored content. Text slots already edited by the user are preserved (not overwritten from AI content).

### Content Palette in Layout Editor

A collapsible panel in `LayoutEditor` (right side or drawer on mobile) showing the AI-generated pieces for the focused page. Each piece has a "drop into selected block" action or is draggable onto the canvas. This is purely additive to the existing editor — the user can still type freely.

---

## Exploration Needed Before Planning

- **Template switching mechanics in `LayoutEditor.jsx`** — exactly what happens when a template is applied today (which code path, what gets cleared). This is where content preservation would be added.
- **`layout_data` v2 page schema** — how `generatedContent` would be added per-page without breaking existing layouts.
- **How the AI call would change** — the `BATCH_PAGES_SYSTEM_PROMPT` would need to produce the richer piece set instead of just `body + pullQuote`.
- **Mobile UX for the palette** — the editor is already tight on mobile; the palette may need to be a bottom sheet or popover rather than a sidebar.

---

## Open Questions (to resolve in planning session)

1. Should content pieces be stored per-page (inside `layout_data`) or on the chapter (`generated_content` column)?
2. When a user edits a text block, should we track whether it diverged from the AI piece? (Matters for "reset to AI text" action.)
3. Do we add `title` and `caption` generation now, or start with just preserving `body + pullQuote`?
4. What does the "content palette" look like on mobile?
5. Should template switching show a preview before applying (to reduce surprise)?

---

## Recommended First Steps

1. **Exploration session** — read `LayoutEditor.jsx` template-switching code, audit `layout_data` schema, sketch content-preservation approach.
2. **Narrow scope to Phase 1:** preserve `body + pullQuote` per page across template switches (no palette UI yet). This alone fixes the content-loss problem.
3. **Phase 2:** richer AI pieces (`caption`, `title`) + content palette UI.
4. **Phase 3:** template slot mapping + template-aware filling.

---

## Session Prompt (S6 — when ready)

```
Session 6 of storybook — Scrapbooking: AI content pieces + layout assembly.
Plan: plans/storybook/s6-scrapbooking.md
Context primer: plans/storybook/storybook-context.md  (READ FIRST)
Branch: TBD (cut from journal-updates after S5.9)
Depends on: S5.9 complete and verified.

This is an exploration + design session, not a full implementation session.
Goal: design the content-piece storage schema, the template-slot mapping system,
and the content palette UX so implementation can be phased.

Read LayoutEditor.jsx template-switching code and the layout_data v2 schema
before proposing anything. Then answer the open questions in the plan.
```
