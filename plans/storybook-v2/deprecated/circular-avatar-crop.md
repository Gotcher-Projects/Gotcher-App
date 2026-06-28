# SUPERSEDED — Circular crop for the baby avatar   *(was sv2-s6.6; folded into sv2-s3.5)*

**Status: SUPERSEDED — folded into `sv2-s3.5-people-polish-and-circular-crop.md` (2026-06-26).** The
circular-crop work was pulled forward into S3.5 (done sooner, and scoped to People photos + the baby
avatar only). Do the work there; this file is kept for history. Everything below is the original plan.
**Depends on:** `sv2-profile-modal.md` (IMPLEMENTED 2026-06-26) — that session added the baby avatar
field and reused the existing portrait crop. NOT blocked on anything else.
**Reference:** the avatar shipped in the profile modal — `Frontend/src/components/ui/Avatar.jsx`,
`Frontend/src/components/tabs/ProfileEditModal.jsx`, crop modal `Frontend/src/lib/imageUtils.jsx`.

---

## Why this plan exists

The profile modal (sv2-profile-modal) added a baby **avatar photo**. To avoid touching the shared crop
modal at the time, we **reused the existing portrait (3:4) crop and display it inside a circle** with
`object-cover` (`Avatar.jsx`). It works, but it's a portrait photo masked into a circle — the crop UI
doesn't show the user the actual circular framing, so faces can sit off-centre once round-masked.

This session makes the **crop experience itself circular** (a square/1:1 crop with a circular preview
overlay), so what the user frames is what they get.

---

## Current state (as built, 2026-06-26)

- `lib/imageUtils.jsx` — `CropModal` (via `openCropModal`) offers only **landscape (4:3)** or
  **portrait (3:4)** orientations; `aspect` is `4/3` or `3/4`. **No square / 1:1 option.** Output is a
  rectangular JPEG blob.
- `PhotoPickerButton` → `openCropModal` → `onPicked({ blob, orientation })` → uploaded via
  `uploadCroppedPhoto` to `POST /baby-profile/photo`. The avatar is a normal rectangular image.
- `ui/Avatar.jsx` displays it in a `rounded-full` container with `object-cover` (circular *display*
  only — the stored image is still a portrait rectangle).
- The crop modal is shared (book cover, bump diary, first-times, etc.) — **do not regress those.**

---

## Scope

Add a **circular/square crop mode** that the avatar picker uses, without breaking the existing
landscape/portrait callers.

Likely approach (decide at build):
1. **Add a `1:1` (square) crop option** to `CropModal` — either a third orientation pill ("Square") or
   a per-call `shape`/`aspect` parameter passed through `openCropModal(file, onComplete, onCancel, opts)`.
   A per-call option is cleaner than a global third pill (keeps the cover/diary UIs unchanged).
2. **Circular preview overlay** while cropping (a round mask on the 1:1 crop area) so the user frames
   the face inside the actual circle. Output stays a **square** JPEG (don't bake transparency / a real
   circle into the file — let `Avatar`'s `rounded-full` keep masking; safest for print/share reuse).
3. **Wire the avatar picker** (`ProfileEditModal` / `PhotoPickerButton`) to request the square crop.
4. Confirm `Avatar.jsx` still looks right with a true square source (it will — `object-cover` on a
   square is a no-op crop).

### Out of scope
- Changing the book cover / bump / first-times crops (they stay landscape/portrait).
- Storing an actually-circular (alpha) image. Keep the square source + CSS circle.

---

## Files to touch (anticipated)

| File | Change |
|---|---|
| `Frontend/src/lib/imageUtils.jsx` | Add 1:1 crop support + optional circular preview overlay; thread a per-call option through `openCropModal` |
| `Frontend/src/components/ui/PhotoPickerButton.jsx` | Allow callers to request the square/circular crop (pass option through) |
| `Frontend/src/components/tabs/ProfileEditModal.jsx` | Ask for the circular crop when picking the avatar |

---

## Open questions (resolve at build)

1. **Third pill vs per-call option.** Per-call `openCropModal(..., { aspect: 1, round: true })` keeps
   other callers untouched — lean this way. Confirm.
2. **Lock the avatar to square-only** (no orientation pills in avatar mode) vs still allow choosing —
   square-only is simpler and correct for an avatar.
3. **Round-masked file or square file + CSS circle** — lean square file + CSS (current `Avatar`). Confirm.

---

## Verification

1. Picking an avatar shows a **circular** crop framing; the saved photo matches what was framed.
2. Existing crops (book cover, bump diary, first-times) are **unchanged** (still landscape/portrait).
3. `Avatar` renders the new square source cleanly on the dashboard card + modal.
4. Frontend build + tests green.
