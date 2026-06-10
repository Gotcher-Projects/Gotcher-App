# SV2-S7 — Firsts Chapter in Guided Book

**Status: Not started**
**Depends on:** sv2-s5 (hero+gallery wiring), sv2-s6 (guided book shell)
**Reference:** `planning.md` Q3; sv2-s5 plan

---

## Goal

Wire the Firsts chapter fully into the guided book — auto-generation trigger, completion state, and the full page sequence (hero + gallery pairs for all First Times). Also handles the "new First Time added after generation" refresh flow.

This is a short integration session — most of the work was done in sv2-s5. The gap is the guided book UI layer: triggering generation, showing completion, and keeping the chapter in sync as First Times are added/edited/deleted.

---

## Scope

### 1. Firsts chapter in the arc

`GUIDED_BOOK_ARC` already includes the `firsts_chapter` section (added in sv2-s6). This session makes it live:
- When the guided book encounters `type: 'firsts_chapter'`, it fetches all First Times + their notes
- If notes are missing, shows a "Generate Firsts chapter" CTA
- Once generated, renders sequential hero+gallery pairs

### 2. Generation trigger

In the Firsts section placeholder (or a prominent button when the section is in "in progress" state):
- "Generate my Firsts chapter" — calls batch note generation endpoint (from sv2-s5)
- Shows a loading state while notes are generating
- On completion, renders the full hero+gallery sequence

### 3. Sync on data change

When a First Time is added, edited, or deleted while the guided book is open (or on next open):
- New First Time with no note → shows in the sequence with a "Note not yet generated" placeholder; user can trigger regeneration
- Deleted First Time → disappears from the sequence
- Edited First Time (label/date/photo changed) → hero page updates automatically (derived from data); note may need regeneration (offer "Regenerate note" on the hero page)

### 4. Completion indicator

Left panel shows Firsts chapter as:
- ✅ Complete — all First Times have generated notes
- 🟡 In progress — some First Times missing notes
- ⬜ Not started — no First Times exist (shows "Add some First Times first" message)

### 5. Individual note regeneration

Each hero page in the guided book should have a small "Regenerate note" affordance (visible on hover or in a context menu). Calls single-note generation endpoint from S13.

---

## Files to touch

| File | Change |
|---|---|
| `Frontend/src/components/storybook/GuidedBook.jsx` | Wire Firsts chapter section — fetch, generation trigger, sync |
| `Frontend/src/lib/api.js` | Firsts chapter generation helpers if not already added |

---

## Open questions (resolve at session start)

1. **Generation cost:** Does generating notes for all Firsts count against AI credits? If so, show a credit cost estimate before triggering.
2. **Empty state message:** What does the Firsts section show when there are no First Times yet? (A CTA to add some, with a link to the Firsts tab.)
3. **Ordering:** Hero+gallery pairs in `occurred_date` ASC order — confirmed? Or user-customizable?

---

## Verification

1. Guided book Firsts section shows all First Times as hero+gallery pairs.
2. First Times with no additional photos show only a hero page.
3. Adding a new First Time causes it to appear in the sequence (with a "generate note" prompt if note is missing).
4. Deleting a First Time removes it from the sequence immediately.
5. Completion indicator updates correctly as notes are generated.
