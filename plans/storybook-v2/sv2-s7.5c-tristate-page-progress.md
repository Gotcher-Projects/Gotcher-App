# SV2-S7.5c — Tri-state page progress (Not started / In progress / Done)

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished). (implemented 2026-07-01).** Design Qs resolved with Michael 2026-07-01:
"done" requires ALL photo slots filled + all key-text slots (body-bound); a pick page needs its note too.
**Found:** s7b verification 2026-06-30. **Depends on:** sv2-s7b. Frontend only.

## Implemented
- `lib/guidedBook.js`: `isChapterDone` → tri-state `chapterStatus(chapter)` → `'empty' | 'partial' |
  'done'`. Rule (no per-template table needed): every `photo` slot needs a url; every KEY TEXT slot
  needs text (key text = a text block with `contentSource.piece==='body'`, the letter `body`, or a
  prompt `val0..N`); l-wrap needs both. Captions/titles/dates/week-tags/notes-not-body are optional.
  auto/prefill/divider → always `done`. `guidedProgress` now returns `{ done, partial, total,
  autoFilled }` — `done` counts only fully-done pages, `partial` surfaced separately.
- `GuidedBookView.jsx`: `StatusPill` — amber "In progress" for partial, emerald ✓ Done / ✓ Filled for
  done; pick pages show the pill + "Change". Header adds "· N in progress".
- Tests: `chapterStatus` (empty/partial/done across letter, gallery, pick) + `guidedProgress` partial.
  Full suite 337 green + Vite build green.

**Verify in-app:** a page with 1 of N photos reads "In progress" (not Done); a gallery is Done only at
4 photos; a spotlight needs photo + words; a picked First with no note reads "In progress" until a note
is added; the header count / progress bar move only on fully-done pages.

## Problem
Progress is binary today: `isChapterDone` = "has any content" → Done. A page with just one photo or a
bit of text reads "Done" when it's really only started. Michael wants **Not started / In progress /
Done**.

## Approach
- Replace `isChapterDone` with `chapterStatus(chapter)` → `'empty' | 'partial' | 'done'` in
  `lib/guidedBook.js`:
  - **empty** — no content.
  - **done** — all *required* slots filled.
  - **partial** — some-but-not-all.
  - auto/prefill/divider → always `done` (as today).
- Need a **"required slots" definition per template**. Candidate heuristic: every **photo** slot must
  have a url, and **key text** slots must have text (letter `body`, prompts answers), while **captions
  are optional**. Likely a small per-template spec (e.g. `requiredSlots` on the template, or a renderer
  → rule map) rather than ad-hoc.
- `guidedProgress` → report `done` (and optionally `partial`) counts.
- `GuidedBookView` row status → add an **"In progress"** badge/state between the Add button and ✓ Done;
  the shelf card bar can stay done/total.

## ✅ Resolved (2026-07-01, Michael)
- **Progress count = only fully Done.** "X of Y ready" counts a page only when it's fully **done**;
  *In progress* is shown as its own badge but does **not** count toward the number.
- **Required vs optional slots:** required = every **photo** slot has a url **and** every **key text**
  slot has text (letter `body`, prompt answers); **captions are optional**. Lock the exact per-template
  list against `storybookTemplates.js` when building, following this rule.

## Files
`lib/guidedBook.js` (`chapterStatus`, `guidedProgress`), `GuidedBookView.jsx` (badges),
possibly `storybookTemplates.js` (per-template required-slot hints). Tests for `chapterStatus` across
empty/partial/done and each kind.

## Out of scope
Freeform progress; any backend change.
