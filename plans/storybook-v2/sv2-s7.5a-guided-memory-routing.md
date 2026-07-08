# SV2-S7.5a — Guided memory routing (Journals/Firsts on fill pages)

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished). (implemented 2026-06-30). Unblocks s7b → Complete once verified in-app.**
_Built the full-scope version (Michael's call): all journals + all firsts (hero + V38 additional photos)
+ bump photos, grouped into collapsible time buckets. `firsts.additionalPhotos` was already in the API
payload, so only `bumpPhotos` needed threading (MemoriesTab → StorybookTab → builder). Generic pages
open all-collapsed. Frontend 331 tests + build green._

**Verify in-app:** guided fill pages show the "Your Memories" bucket panel (fill/pick only, not
auto/prefill); the page's `defaultBucket` opens expanded, generic pages open all-collapsed; drag/tap a
journal, a first (incl. its extra photos), and a bump photo onto slots; items placed on other pages dim
as "Used"; freeform builder unchanged. Then mark this + sv2-s7b **Complete**.
**Found:** s7b in-app verification 2026-06-30 (`sv2-s7b-verification-notes.md`, the 🔴 BLOCKER item).
**Depends on:** sv2-s7b (guided book). **Coordinate with:** sv2-s7.5d (layout variety — a page's layout
determines its slot count, which determines how many memories it should pull) and the deferred
chronological tech-debt (shares the same date-window logic).

## Problem
Guided **fill** pages don't surface the user's Journals/Firsts for drag-and-drop — only the Firsts
*pick* pages touch memories. Dragging your own journal text + photos into the designed pages was a
defining part of the guided book's value, and it's currently absent on every gallery/spotlight/
growth-spread/hands-feet/prompts page.

## Root cause
`ScrapbookBuilder` derives the memory panel's `memories` + `availablePhotos` from
`chapter.selectedJournalIds` / `selectedFirstTimeIds` — the curated subset the old **wizard** chose.
Guided (Model A) chapters never select anything, so the panel is empty; and s7b additionally **hides**
the panel in `locked` mode. Note the builder *already receives* the full `journalEntries` + `firsts`
props — they're just not used for guided pages. **So this is frontend-only; no backend/API change.**

## Pools to route
- **Journal entries** — text (title+story) + 1 photo, dated (`entry_date`/`week`).
- **Firsts** — label + notes + hero photo + up to 8 extra photos (V38), dated (`occurred_date`).
- **Bump photos** — photo + week (pregnancy pages; also currently have no panel).
- **Profile/cover** photos.
- Baby **birthdate** → turns any dated memory into an age (weeks/months) for windowing.

## ✅ DECIDED (2026-06-30) — curated + collapsible bucket panel
The panel shows **all** memories (nothing hidden), grouped into **collapsible time-bucket sections** so a
30-page book doesn't feel cluttered. Curation = which bucket is **auto-expanded** for the current page;
the rest are collapsed but one tap away. (Supersedes the earlier all / routed / hybrid options.)

**Buckets, in order:** Pregnancy · Months 0–3 · Months 4–6 · Months 7–9 · Months 10–12 · 1 year+.
- A memory lands in a bucket by age (`date − birthdate`); **bump photos → Pregnancy** (bucket shown only
  when pregnancy data exists). "1 year+" catches anything after 12 months.
- Each section header is **collapsible** (remember open/closed within the builder session).
- **Per-page default-open bucket = the curation** (replaces the old "Show all" toggle): a page opens with
  its relevant bucket expanded, the rest collapsed. Mapping via a per-entry hint in `guidedBookArc.js`
  (`defaultBucket`, or derived from the page's month window). Generic "any" pages (Out & About, Hands &
  Feet, The Party): default all-collapsed (or most-recent) — **CONFIRM**.

**✅ Bucket boundaries — RESOLVED (2026-06-30):** the **growth spread pages adopt the bucket windows**
0–3 / 4–6 / 7–9 / 10–12 (Michael's call), so each growth page maps 1:1 to its bucket. This **relabels**
the growth entries in `guidedBookArc.js` from "Months 3–6 / 6–9 / 9–12" → "Months 4–6 / 7–9 / 10–12"
(labels + prompts), and updates the locked-arc docs + arc tests. **Do this relabel in sv2-s7.5d** (it
already edits the growth entries) so the two land together.

**Also decided:**
- **B — book-wide "already used" dimming.** Each guided page is its own chapter (Model A), so the builder
  can't see placements on other pages. Compute a **book-wide used photo/text key set** in StorybookTab and
  pass it into the builder so the panel dims already-placed items. ✅ yes.
- **C — panel offers photos + text.** Photos = journal photo + First hero + First extra photos (V38) +
  bump; text = journal story + First notes. Both draggable to their slot types. ✅ yes.
- **D — reuse across pages** allowed (soft used-dimming only, no hard block). ✅ yes.

## Mechanism
- New pure helper in `lib/guidedBook.js`: `bucketForMemory(memory, birthdate)` → bucket id; plus a
  `groupMemoriesIntoBuckets(pools, birthdate)` that returns the ordered bucket → memories map (photos +
  text pieces), with the Pregnancy bucket only when pregnancy data exists.
- `guidedBookArc.js`: per-entry `defaultBucket` (or derive from the page's month window).
- `ScrapbookBuilder`: build `memories`/`availablePhotos` from **all pools** (fall back to selected-ids for
  freeform); **un-hide** `MemoryPanel` for guided; pass the book-wide used-set.
- `MemoryPanel`: render the collapsible bucket sections; open the page's `defaultBucket` by default; dim
  used items.

## Remaining confirms
1. ~~Generic "any" pages default: all-collapsed vs most-recent-open?~~ ✅ RESOLVED — **all-collapsed**.
2. ~~Align growth-spread windows to the buckets?~~ ✅ RESOLVED — yes, relabel to 0–3 / 4–6 / 7–9 / 10–12
   (done in sv2-s7.5d).
3. Bucketing needs each pool's date — journals `entry_date`, firsts `occurred_date`, bump by week. OK.

## Files
`lib/guidedBook.js` (`bucketForMemory` + `groupMemoriesIntoBuckets` + tests), `guidedBookArc.js`
(per-entry `defaultBucket`), `ScrapbookBuilder.jsx` (memories/availablePhotos from all pools, un-hide
panel, pass used-set), `MemoryPanel.jsx` (collapsible bucket sections, default-open bucket, used dimming),
`StorybookTab.jsx` (pass `birthdate` + book-wide used-set; journals/firsts already passed).
**Backend: none.**

## Testing
`bucketForMemory` boundaries (incl. pregnancy/1yr+) + `groupMemoriesIntoBuckets` unit tests; builder
shows all buckets with the page's default-open; used items dim; pick pages unaffected; bump photos land in
the Pregnancy bucket.

## Out of scope
Chronological reorder (deferred tech debt), dynamic insertion, any backend change.
