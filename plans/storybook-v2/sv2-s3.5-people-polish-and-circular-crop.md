# SV2-S3.5 — People page polish + circular crop (folds in S6.6)

**Status: Complete (implemented + verified 2026-06-27).** PeopleCanvas content vertically centred +
enlarged (two-up 156px / spotlight 220px avatars); opt-in `{ shape: 'circle' }` 1:1 circular crop added
to `imageUtils`/`PhotoPickerButton`, wired ONLY to Your People photos + the baby avatar; all other crops
left unchanged. Build + 245 FE tests green.
**Depends on:** `sv2-s3-your-people.md` (IMPLEMENTED 2026-06-26) and `sv2-profile-modal.md` (the baby
avatar). **Supersedes / folds in `deprecated/circular-avatar-crop.md`** — the circular-crop work is pulled
forward to here and done now rather than later.
**Reference:** screenshots 2026-06-26 195129 (one-person People page) + 195151 (two-up People page) —
both show content crammed into the top third with a large empty lower half.

---

## Why this plan exists
Two things surfaced verifying S3:
1. **People pages under-fill the page** — the title + a small photo + name/role/bio sit in the top
   third and the bottom ~60% is blank. The page should use its vertical space (bigger photos, more
   breathing room, content vertically balanced) so it reads as a finished keepsake page.
2. **We want a true circular crop** for round avatars. Today the People photos and the baby profile
   avatar are rectangular images masked into a circle with `object-cover`, so faces can sit
   off-centre once round-masked. We want the crop UI itself to be circular (square/1:1 crop with a
   round preview) so what you frame is what you get.

---

## Decisions locked (2026-06-26)
- **Circular crop is opt-in and narrowly scoped.** It is used **only** by:
  - **Your People** member photos (`FamilyRosterPopup`), and
  - the **baby profile avatar** (`ProfileEditModal` Basics tab).
  Everything else — journal entries, memory-book photos, First Times, bump diary, book cover, the S2
  **birth hero photo** — keeps the existing portrait/landscape crop **unchanged**. We may extend the
  circular option to other spots later, but **not now**. The shared crop modal must default to its
  current behaviour; circular is requested per-call.
- **Output stays a square image + CSS circle** (the `Avatar`/PeopleCanvas `rounded-full` + `object-cover`
  keep masking). Don't bake a transparent round PNG — square JPEG is safest for print/share reuse.

---

## Scope

### 1. People page sizing / page-fit (`PeopleCanvas.jsx`)
Make the page use its vertical space instead of top-aligning:
- **Two-up:** vertically centre the two columns in the body; enlarge avatars and bio type so the row
  sits in the visual middle, not crammed under the divider. Cap bio width for readability.
- **Spotlight (one person):** noticeably bigger avatar + name + bio, vertically centred — it should
  feel like a featured page, not a two-up page missing its second column.
- Keep it robust for 1 vs 2 people and short vs long bios (no overflow off the 600×800 canvas).
- Decide at build: a gentle decorative footer flourish (e.g. a small heart) to anchor the bottom, or
  pure whitespace balance. Don't add chrome the design doesn't need.

> Same under-fill can affect other data-driven pages; this plan only commits to People. If BirthDay
> needs similar balancing, note it but treat separately.

### 2. Circular crop (pulled forward from S6.6)
- **`lib/imageUtils.jsx`** — add an opt-in **1:1 / circular** crop mode threaded as a per-call option,
  e.g. `openCropModal(file, onComplete, onCancel, { shape: 'circle' })`. In that mode: lock aspect to
  1:1, hide the landscape/portrait orientation pills, and show a **circular preview overlay** on the
  crop area. Output a **square** JPEG blob. Default (no option) = today's portrait/landscape behaviour.
- **`ui/PhotoPickerButton.jsx`** — forward a `shape`/`cropShape` prop into `openCropModal` so callers
  can request the circle. Default unchanged.
- **Wire ONLY:** `FamilyRosterPopup` (member photo) + `ProfileEditModal` Basics (baby avatar) pass the
  circle option. Leave every other `PhotoPickerButton` / `openCropModal` caller as-is.

---

## Files to touch (anticipated)
| File | Change |
|---|---|
| `Frontend/src/components/storybook/PeopleCanvas.jsx` | Vertical balance + larger spotlight/two-up sizing |
| `Frontend/src/lib/imageUtils.jsx` | Opt-in 1:1 + circular-preview crop mode (per-call option) |
| `Frontend/src/components/ui/PhotoPickerButton.jsx` | Forward a `shape` option to `openCropModal` |
| `Frontend/src/components/storybook/FamilyRosterPopup.jsx` | Request circular crop for member photos |
| `Frontend/src/components/tabs/ProfileEditModal.jsx` | Request circular crop for the baby avatar only |

---

## Out of scope
- Circular crop anywhere other than People + baby avatar (explicitly deferred).
- Changing the birth hero / cover / firsts / journal / bump crops.
- Baking transparent round images.

---

## Open questions (resolve at build)
1. People page: vertically centre vs. distribute (space-between) the content — pick what looks best per
   screenshots.
2. Spotlight avatar target size (e.g. ~200–230px on the 600px canvas) — tune to fill without crowding.
3. Bottom flourish vs pure whitespace.
4. Circular crop: square-only (no orientation pills in circle mode) — confirm (lean yes).

---

## Verification
1. Two-up and spotlight People pages fill the page — no large empty lower half; renders in builder,
   published view, and PDF.
2. Adding/editing a People member photo shows a **circular** crop; the saved face matches the framing.
3. The baby profile avatar uses the circular crop too.
4. Journal / firsts / memory-book / bump / cover / birth-hero crops are **unchanged** (still portrait/landscape).
5. Frontend build + tests green.
