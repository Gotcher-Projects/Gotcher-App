# S11 — Builder: "Already in the Book" Indicators

**Status: Complete** (verified 2026-06-04)
**Branch:** same as S7
**Depends on:** S8 verified (placement stamps `sourceKey` on blocks)
**Roadmap:** builder-rewrite roadmap; decisions in `s6.4-improvements.md`

> **Done this session (all in `ScrapbookBuilder.jsx`, pure front-end / derived state):**
> - New `{ usedTextKeys, usedPhotoKeys }` `useMemo` over `pages` — a text piece is "used" only
>   when a placed block carries its `sourceKey` **and** has non-empty content
>   (`contentToPlainText(...).trim()`); a photo piece when its block has a `url`. Reactive to all
>   page edits/deletes.
> - `MemoryCard` accepts `usedText` / `usedPhoto`; `DraggablePiece` accepts `used`.
> - **Visual treatment (chosen): dim + "Used" tag** — used pieces render at `opacity: 0.55` with a
>   muted pill "Used". Pieces stay **fully draggable/placeable** (informational, not a lock).
>
> **Open-question resolutions (chosen by user):**
> 1. Granularity — **per-piece only**, no card-level roll-up.
> 2. Text rule — **non-empty content**.
> 3. Re-placement — **keep fully placeable** (badge is informational).
> 4. "Which page" chip — **not in v1** (simple dim + tag).
> 5. Leftover view ("X of Y placed" / "hide used") — **deferred**.

---

## Goal

In the builder's left **Memories** panel, show at a glance which memory pieces are already placed
somewhere in the chapter — so the user doesn't re-place the same text or photo, or lose track of
what's left to use. Pure front-end, derived-state visual; no backend or schema changes.

---

## Background — why this is cheap

Placement already records ownership: `placeIntoSlot` stamps `block.sourceKey` on both text and photo
blocks (`ScrapbookBuilder.jsx`). So "used" status can be **derived** from the current `pages` state
without any new data:

- A memory's **text** is used if any `type: 'text'` block across all pages has
  `block.sourceKey === memory.sourceKey`.
- A memory's **photo** is used if any `type: 'photo'` block across all pages has
  `block.sourceKey === memory.sourceKey` **and** a `url`.

Because it's derived from `pages`, it updates automatically as the user places, replaces, or removes
content — including across page deletes and template changes.

---

## Scope

### Derive used-state (single source of truth)
- Add a `useMemo` over `pages` that returns two sets keyed by `sourceKey`:
  `usedTextKeys` and `usedPhotoKeys` (plus, optionally, a `sourceKey → [pageNumber…]` map for the
  "which page" enhancement below).
- Decide the text rule (see Open Questions): count a text block by `sourceKey` presence, or only when
  its content is non-empty. Recommended: **non-empty** (a placed-then-cleared slot shouldn't read as
  used).

### Per-piece indicator in the panel
- Pass `usedText` / `usedPhoto` booleans into `MemoryCard`, and a `used` prop into each
  `DraggablePiece` (the text row and the photo thumb).
- When a piece is used, render a small badge/affordance on that piece (text row and photo thumb are
  already separate elements, so per-piece is natural).
- Keep used pieces **still draggable/placeable** (a user may intentionally place the same photo twice)
  — the indicator is informational, not a lock. Confirm in Open Questions.

### Card-level summary (light)
- Optional subtle roll-up on the card header, e.g. a check when *every* available piece of that
  memory is placed, or a muted "In book" tag. Keep it from competing with the per-piece badges.

### Empty / leftover affordance (optional)
- Optionally a panel header count like "3 of 7 placed" or a filter/toggle "Hide used" to focus on
  what's left. Treat as stretch.

---

## Design options (pick during the session)

Show 2–3 mockups and let the user choose; do **not** invent a single look unprompted
(see `feedback_dont_invent_features`). Candidate treatments per used piece:

1. **Check badge** — a small green ✓ chip in the corner of the text row / photo thumb ("placed").
2. **Dim + label** — reduce the piece's opacity and overlay a tiny "Used" tag.
3. **Page chip** — a chip showing where it landed ("p2"); most informative, needs the page-map.

Lean toward something legible on both the text row and the small photo thumb, and consistent with the
existing selected-state ring (`border-color-highlight ring-2`). Avoid clashing with the
selected-for-placement highlight.

---

## Reuse / touch points
- `Frontend/src/components/storybook/ScrapbookBuilder.jsx`
  - `memories` memo (attach `usedText` / `usedPhoto`, or compute alongside)
  - `MemoryCard` and `DraggablePiece` (render the badge; accept `used`)
  - new `usedKeys` memo derived from `pages`
- lucide-react `Check` (or similar) for the badge icon.
- No changes to autosave, layout data shape, or the backend.

---

## Out of scope
- Locking/disabling re-placement (unless the user asks).
- Any persistence of "used" state (it's derived — never stored).
- Backend, DB, or `layout_data` schema changes.

---

## Open questions (resolve at session start)
1. **Granularity:** per-piece badges (text vs photo) — confirmed intent — plus an optional card-level
   roll-up?
2. **Text rule:** mark used by `sourceKey` presence, or only when the slot's content is non-empty?
3. **Re-placement:** keep used pieces fully placeable (informational badge), or visually discourage?
4. **"Which page":** is the page chip (option 3) wanted, or is a simple ✓ enough for v1?
5. **Leftover view:** include the "X of Y placed" count / "hide used" toggle, or defer?

---

## Verification
1. Place a memory's text → its text row shows the used indicator immediately; the photo row does not.
2. Place that memory's photo → the photo thumb now also shows used.
3. Remove the block / clear the slot / delete the page → the indicator clears (derived, reactive).
4. Replace a slot's content with a different memory → old memory un-marks, new memory marks.
5. Indicators are correct across **all** pages, not just the current page.
6. Used pieces remain draggable/placeable (per the re-placement decision).
