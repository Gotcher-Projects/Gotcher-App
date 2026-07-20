# Print pr4 follow-up — Cover photo crop-to-slot

**Status:** Complete — **standardized on 4:3, built + verified 2026-07-17** (Michael confirmed the locked-4:3
crop modal in-app; frontend build green; print re-render unchanged).
**Decision:** standardize the cover photo on **4:3** (Michael, 2026-07-17) — the default landscape crop already
produced 4:3, so existing cover photos need no migration.
**Scope:** the cover *photo* crop only — pr4's geometry/layout (spine, wrap, back, spine-text threshold) is done
and correct. **Keep the spine-text threshold** (decided 2026-07-17).
**Touches:** `Frontend/src/components/storybook/BookCover.jsx` (on-screen cover, upload+crop),
`Frontend/src/components/PrintCoverPage.jsx` (print front cover), `Frontend/src/lib/imageUtils.jsx` (crop modal).

---

## The problem (a recurrence of the known crop-to-slot gap)

The cover photo is cropped with the **generic** crop modal, which only offers **4:3 / 3:4** (or circle) —
`imageUtils.jsx:25` `aspect = isCircle ? 1 : (orientation === 'landscape' ? 4/3 : 3/4)`. But the cover photo
lands in slots that are **not exactly 4:3**:
- **On-screen** (`BookCover.jsx`): hero is `aspectRatio: 4/3` (1.333).
- **Print** (`PrintCoverPage.jsx`): the front-cover photo area is 600×440 ≈ **1.36:1**, and it fills via
  `object-fit: cover`, so a 4:3 crop gets **re-cropped/shifted** at print time.

Net: the user's carefully-chosen crop isn't exactly what either surface shows, and the two surfaces don't even
agree with each other. This is the same issue already solved for template photo slots via the crop modal's
`slotAspect` path (`imageUtils.jsx:196`, templates' `slotAR` in `storybookTemplates.js`) and tracked historically
in `plans/storybook/s12.3-crop-to-slot.md` — the cover photo just never got wired to it.

## Fix direction (decide the aspect first)

1. **Pick ONE canonical cover-photo aspect** and use it everywhere. Open question: what is it? Options —
   match the on-screen 4:3 and change the print slot to 4:3; or pick a cover-specific ratio and apply it to both.
   The print front cover follows the interior's FIT-whole convention, so the slot ratio is adjustable.
2. **Crop to that slot aspect on upload** — pass it as `slotAspect` to `openCropModal` in `BookCover` (the
   mechanism already exists for template slots), instead of the generic 4:3/3:4 toggle.
3. **Render both surfaces at that exact aspect** so `object-fit: cover` never re-crops — on-screen hero and the
   print front-cover photo area use the same ratio the photo was cropped to.

## What was built (2026-07-17)

Standardized the cover photo on **4:3**, so the upload crop, the on-screen hero, and the print slot all agree
and `object-fit: cover` never re-crops:
- **`imageUtils.jsx`** — `openCropModal` now accepts `{ aspect: <number> }`, which **locks** the crop to that
  ratio and **hides the landscape/portrait toggle** (parallels the existing `{ shape: 'circle' }` opt-in). The
  generic toggle behaviour is unchanged for every other caller.
- **`BookCover.jsx`** — passes `{ aspect: 4/3 }` when cropping a cover photo, so a cover can no longer be
  cropped portrait.
- **`PrintCoverPage.jsx`** — the front-cover photo slot is now an exact 4:3 box (`CANVAS_W·3/4 = 450` of the
  600×800 canvas), matching BookCover's 4:3 hero.

**Verify:** upload a cover photo in the app → the crop modal shows **no orientation toggle** and is locked 4:3;
the same crop shows identically on the on-screen cover and in a print cover render (no shift/re-crop).

## Not this
Spine/wrap geometry (pr4, done) · spine-text threshold (keep it) · any Lulu API work (pr5). Photo crop only.
