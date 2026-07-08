# SV2-S7.5d — Growth-spread layout variety

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished). (implemented 2026-07-01).**
**Found:** s7b verification 2026-06-30. **Depends on:** sv2-s7b. **Coordinate with:** sv2-s7.5a — a
page's layout sets its slot count, which sets how many memories the routing should pull, so pick the
layouts and wire routing together. Frontend/config only.

## Implemented
- `guidedBookArc.js`: the four growth pages now use distinct layouts — `growth-spread` (0–3),
  `story-snapshot` (4–6), `staggered` (7–9), `photo-first` (10–12) — and are relabelled to the bucket
  windows 0–3 / 4–6 / 7–9 / 10–12 (labels + prompts). Entry IDs stay `months-3-6/6-9/9-12` (they key
  already-created guided-book rows) even though labels now read 4–6 / 7–9 / 10–12 — deliberately not
  renamed. `defaultBucket`s were already m4-6/m7-9/m10-12 (set in s7.5a), so unchanged.
- Docs: locked-arc tables updated in `sv2-s7-plan-default-book.md` + `sv2-s7b-guided-arc.md`.
- Tests: new `growth layout variety` assertions in `guidedBookArc.test.js` locking the four templateIds
  + labels. Full suite 337 green + Vite build green.

**Verify in-app/mockups:** the four Watch-You-Grow pages read as four different layouts and each renders
well at book scale with ~1–3 photos + a note. Swap a template if one renders poorly.

## Problem
The **Watch You Grow** section is 4× `growth-spread` (Trio + Note) back-to-back (Months 0–3 / 3–6 / 6–9 /
9–12) — visually monotonous.

## Also do here — relabel growth windows to match the memory buckets (decided w/ sv2-s7.5a, 2026-06-30)
Change the four growth pages from 0–3 / **3–6 / 6–9 / 9–12** → 0–3 / **4–6 / 7–9 / 10–12** (labels +
prompts) so each growth page maps 1:1 to a memory bucket (Pregnancy · 0–3 · 4–6 · 7–9 · 10–12 · 1yr+).
Update `guidedBookArc.js`, the locked-arc docs (`sv2-s7-plan-default-book.md`, `sv2-s7b-guided-arc.md`),
and `guidedBookArc.test.js`.

## Approach
Give each month range a distinct layout by swapping its `templateId` in `guidedBookArc.js`. Choose from
existing templates so no new renderers are needed — candidates: `story-snapshot`, `staggered`,
`timeline`, `photo-first`, `side-by-side`, `spotlight`, `photo-pair`, `photo-three`, `l-wrap`,
`growth-spread`. Keep them coherent (each should suit "a season of growth": ~1–3 photos + a note/caption)
and visually varied across the four.
- **✅ 4 layouts chosen (2026-07-01, Michael):** `growth-spread` (0–3), `story-snapshot` (4–6),
  `staggered` (7–9), `photo-first` (10–12). One per window, in that order. Confirm each exists in
  `storybookTemplates.js` and suits ~1–3 photos + a note; swap if one renders poorly at book scale.
- Verify each renders well at book scale (in-app or via the mockups) before locking.
- This changes the arc → update the templateId/structure assertions in `guidedBookArc.test.js`.

## Files
`guidedBookArc.js` (templateId per growth entry), `test/guidedBookArc.test.js` (assertions),
possibly a quick in-app/mockup check of the chosen layouts.

## Out of scope
New page templates/renderers; the chronological reorder (deferred tech debt).
