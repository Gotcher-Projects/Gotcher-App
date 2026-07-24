# SV2-S6.5 — Prefilled Pages (prefill kind + Milestones renderer)

**Status: Complete — confirmed in-app 2026-06-28.** Milestones page (template + `MilestonesCanvas` + all
3 dispatch points + thumbnail), the prefill seed/refresh mechanism, the additive `achieved_at` backend
exposure, and `pageData` threading are built, tested, and user-verified working (incl. the crop-aspect
fix and the 5→7 row bump). The Work-item-C reuse spot-checks (spotlight / moment_hero) naturally fold
into **sv2-s7b** when those templates are placed in the arc — no separate work outstanding here.
**Depends on:** sv2-s6 (fill-in page types) **Complete/Needs-Verification**. The data-driven renderer
pattern (`birth_day`, `people`, `family_tree`) is the template for this work.
**Blocks:** sv2-s7 (guided book shell) — this is the **last pre-S7 build**; after it, S7 is pure wiring.
**Reference:** `sv2-s7-plan-default-book.md` (the locked arc + the auto/prefill split decided 2026-06-28);
`planning.md` §0 (the page-type implementation pattern + the "seed fields with the user's own data"
first-run note in §8).

---

## Why this session exists

The locked default-book arc (`sv2-s7-plan-default-book.md`) introduced a **third page kind, `prefill`**:
a page **seeded from structured data the user already entered, but still editable in the builder** — the
middle ground between **auto** (locked, live-read, read-only: Birth Stats, Family Tree) and **fill**
(empty designed page). Two pages in the arc are prefill: **Your People / The Wider Circle** (`people`)
and **How You Grew** (`milestones`). Of those, `people` already behaves like prefill today; `milestones`
is the **only genuinely new renderer** in the whole arc. This session builds the prefill mechanism +
the Milestones page, and verifies the three template *reuses* the arc relies on. Once done, sv2-s7 adds
**no new page types**.

---

## ✅ Decisions locked

- **`prefill` = seed-on-display + editable override.** The renderer shows the user's block text if
  present; for any empty block it **falls back to the live data value** (so a fresh page looks populated,
  not blank — the §8 "first-run wow" mitigation). Editing a block makes it a persistent user override. A
  **"Refresh from data"** builder action overwrites the blocks with current live data. This is the
  reusable prefill contract; it is **not** new infrastructure — it's the existing data-driven renderer
  pattern plus a block fallback + a refresh button.
- **People stays as-is, reclassified as prefill.** `PeopleCanvas` already live-reads `family_members`
  and is edited via the roster popup (which members + variant). That already satisfies "seeded but
  editable," so **no rebuild** — just confirm the two-page split (Your People vs The Wider Circle
  select different member sets) and document it as `prefill`. No seed-into-blocks change for People.
- **Milestones is a new renderer (`milestones` → `MilestonesCanvas`)** — a **hybrid** page: a prefilled
  milestone **list** (seed-on-display from achieved milestones) **plus 2 `photo` slots** the user drops
  into. **Layout = Panel F "Polaroid scatter" (DECIDED 2026-06-28**, mockup
  `mockups/s6.5-prefilled-pages.html`): the list runs down the left; two **tilted polaroid frames** (white
  border + rotate + shadow + an optional script caption) tuck into the right corners. Photos are optional
  (degrade to list-only). Source data = the baby's **achieved milestones**.
- **The three reuses are arc-config only, no new code:** photocap (Coming Home / Tiny & New /
  ultrasound / etc.) → existing **`spotlight`** template (photo + caption below; `hero` full-bleed is the
  alternative); birthday (Happy First Birthday) → **`moment_hero`** with a blank badge; closing (Your
  Story Continues…) → **`spotlight`** as a fill page (note reads better below the photo than overlaid).
  s6.5 **verifies** these look right at book scale.

---

## Work item A — the `prefill` mechanism (small, shared)

Implemented as part of the Milestones renderer (the only consumer this session) but written to be
reusable:

1. **Seed-on-display:** in `MilestonesCanvas`, for each row's **date** block render `blk('dateN').content`
   if non-empty, else the Nth seeded value derived from live data (see item B). Pure render-time — no
   instantiation-time copy, so it works regardless of when/how S7 creates the page. (Milestone **names**
   are always live from data, never stored — only dates are overridable.)
2. **"Refresh from data" action** (`handleRefreshMilestones`, builder toolbar): writes the current
   seeded dates into the `dateN` blocks (overwriting overrides), then autosaves via the existing
   `commitPages`/`PATCH /storybook/{id}`. `window.confirm`-gated.
3. **Backend change is additive** (see note below) — `GET /milestones` now also returns `achieved` with
   dates. No migration.

> **DEVIATION (2026-06-28, built):** the plan assumed "no backend change," but `GET /milestones` only
> returned `{ keys }` — no dates. Since the chosen design (Panel F) shows dates and the user picked
> **"names + editable dates,"** `GET /milestones` was **additively** extended to also return
> `achieved: [{ key, achievedAt }]` (`KeyedRecordService.getAchieved` + `MilestoneController`). The
> existing `keys` field is untouched, so the milestone checklist consumer is unaffected.

---

## Work item B — Milestones page ("How You Grew") — HYBRID prefill + fill

**Design DECIDED 2026-06-28: the photo version** (mockup `mockups/s6.5-prefilled-pages.html` Panel C).
The page is a **hybrid**: the milestone **list is `prefill`** (seeded from data, editable) and there are
**1–2 `photo` slots the user drops into** (`fill`). Follows the §0 page-type pattern (template + renderer
dispatched at **three points** + a `TemplateSheet` thumbnail).

### Data source (the list half)
- Backend: `GET /milestones` now returns `achieved: [{ key, achievedAt }]` (additive — see deviation
  note in item A). `achievedAt` is a `YYYY-MM-DD` string (when the milestone was marked).
- Names: resolved from **`MILESTONES`** in `Frontend/src/lib/babyData.js` (key = `${groupWeek}-${index}`)
  via `milestoneName()` in **`lib/milestonesPage.js`**.
- Thread an **`achievedMilestones`** array into **`pageData`** in `StorybookTab.jsx` —
  `buildAchievedMilestones(res.achieved)` → sorted (oldest-first) `{ key, name, achievedAt }`. Fetched in
  `loadPageData` (re-pulled when the builder closes, like birth-details/family-members).

### Template (`storybookTemplates.js`) — as built
```
{ id: 'milestones', label: 'How You Grew', description: 'Your milestones + a couple of polaroids',
  renderer: 'milestones', memoryCount: 0, minPhotos: 0, maxPhotos: 2,
  blocks: [ {id:'photo1', type:'photo', contentSource:{ photoIndex: 0 }}, {id:'cap1', type:'text'},
            {id:'photo2', type:'photo', contentSource:{ photoIndex: 1 }}, {id:'cap2', type:'text'},
            {id:'date0'..'date4', type:'text', content:''} ] }
```
- **NO title block** — the renderer hardcodes the eyebrow ("You at One") + title ("How You Grew"), like
  `PromptsCanvas`.
- **Names are data-driven** (not blocks); **dates are prefill** (`date0..date4`, editable); **photos are
  fill** (`photo1`/`photo2` + optional script captions `cap1`/`cap2`).
- **Photo slots optional** (`minPhotos: 0`): empty → tilted drop frame in the builder, **hidden in
  read/PDF** so the page degrades to list-only.
- Up to **`MAX_MILESTONE_ROWS` (7)** rows render (from `achievedMilestones`); the list sits in the left
  column, polaroids on the right.

### Renderer (`MilestonesCanvas.jsx`)
- Fixed design — **Panel F**: hardcoded eyebrow/title + left-aligned divider, the milestone list down a
  left column, and **two tilted polaroid frames** absolutely positioned in the right corners (top ~+4°,
  bottom ~−5°), each a white frame around the photo slot with its optional script caption beneath.
- **Names = data:** `achievedMilestones[i].name`. **Dates = prefill:** `blk('date'+i)` override else
  `seededMilestoneDate(achievedMilestones, i)` (year-less `formatDate`). **Photos = fill:**
  `blk('photoN')` + `blk('capN')`; empty → builder drop frame, read/PDF hidden.
- **Crop-aspect contract (gotcha, fixed 2026-06-28):** photos render via `SlotImage` (applies the stored
  crop). The crop modal crops to `block.slotAR ?? (width·CANVAS_W)/(height·CANVAS_H)`, so the display slot
  **must render at that same aspect** or the crop mis-fits (top/bottom clipped). `MilestonesCanvas`
  derives the slot height from `slotAspectOf(photoBlock)` (same formula), which self-heals pages saved
  before `slotAR` was added to the template. Template photo blocks carry an explicit `slotAR: 1.2`.
- ⚠️ **html2canvas (see `feedback_html2canvas_limitations`):** the polaroids use `transform: rotate` +
  `box-shadow` on **real positioned divs — no pseudo-elements, no `mask-image`**. Verify the rotated
  frames + shadows export cleanly to PDF at 600×800 (manual check).
- ⚠️ **html2canvas (see `feedback_html2canvas_limitations`):** the polaroids use `transform: rotate` +
  `box-shadow` (both render) on **real positioned divs — no pseudo-elements, no `mask-image`**. Verify the
  rotated frames + shadows export cleanly to PDF at 600×800.
- **Dispatch at all three points** (the easy-to-miss step):
  - `ScrapbookBuilder.jsx` — builder edit view (photo drop + text edit + the "Refresh from data" action, item A).
  - `LayoutRenderer.jsx` — read view (add a `page.templateId === 'milestones'` branch; pass
    `achievedMilestones={pageData?.achievedMilestones}`).
  - `storybookPdf.js` — PDF export (same render at print path).
- `TemplateSheet.jsx` — add a thumbnail.

---

## Work item C — verify the three reuses (no code)

For each, drop the existing template into a test book page and eyeball it at full canvas scale; confirm
it reads correctly with a guided prompt/label and exports cleanly to PDF. If one looks wrong, raise it
**before** S7 wires the arc (cheaper to fix the mapping now than after the config is built):
- **photocap → `spotlight`** (photo + caption *below*, on whitespace): Coming Home, Tiny & New,
  + pregnancy ultrasound / "found out". Confirm at book scale; if a full-bleed look is preferred, `hero`
  (caption *overlay*) is the alternative — pick one and apply it to all photocap pages for consistency.
- **birthday → `moment_hero`** (badge left blank): Happy First Birthday — confirm the firsts-flavored
  badge can be empty/suppressed without looking broken next to the gallery "Party" page.
- **closing → `spotlight`** as a fill page (final photo + parents' note): Your Story Continues…. Use
  `spotlight` (not `hero`) — the note is longer than a caption and reads poorly as a photo overlay;
  confirm the text block has room for a few sentences.

---

## Testing
- **Frontend (`npm run test`) — DONE, passing:** `storybookTemplates.test.js` asserts the `milestones`
  template shape (renderer id, ids `photo1`/`cap1`/`photo2`/`cap2`/`date0..date4`, `maxPhotos: 2`, no
  `title` block); `milestonesPage.test.js` covers `milestoneName`, `buildAchievedMilestones` (sort +
  name resolution + tolerant of missing key/date), and `seededMilestoneDate` (year-less, empty out of
  range). Full suite: 255 passing. Backend compiles. (Override-wins + photo-free rendering verified
  manually — they're one-liners in the canvas.)
- **Manual:** open a book with the milestones page on a profile that has achieved milestones → page
  shows them; edit a row → override persists; "Refresh from data" → re-seeds; PDF export matches the
  on-screen page. People two-page split still selects distinct member sets.

## Out of scope (explicit)
- No new page types beyond `milestones` (the arc's other pages all exist or are reuses).
- No cover/back-cover rework (deferred — see `sv2-s7-plan-default-book.md`).
- No `guidedBookArc.js` / sequence wiring / book library — that is **sv2-s7**.
- No AI surface of any kind.

## When done
Mark **Needs Verification**; only **Complete** after the user confirms the milestones page, prefill
edit/refresh, and the three reuses all look right in-app. Then sv2-s7 has everything it needs to wire.
