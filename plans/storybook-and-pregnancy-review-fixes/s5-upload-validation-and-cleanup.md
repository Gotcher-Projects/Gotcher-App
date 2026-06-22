# s5 — Image Upload Validation + Storage Cleanup Taxonomy

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** s2
**Source:** `branch-review.html` → Pass 5 (P2 upload validation; P2 privacy/cleanup; ties to Pass 1/Pass 5 consistency)

---

## Goal
Stop arbitrary-byte uploads and fix account-deletion so it actually removes every user's images.

## Scope
### Upload validation
- `UploadController.upload` only checks `file.isEmpty()`; `ImageUploadService.upload` streams any
  bytes to Cloudinary (and `getBytes()` buffers the whole file in memory).
- Add: content-type must be `image/*`; enforce a max size. Set
  `spring.servlet.multipart.max-file-size` / `max-request-size` in `application.properties` AND add
  an explicit guard so the error is a clean 400, not a generic multipart failure.
- Apply to **both** `/upload` and `/storybook/{id}/chapter-photos`.

### Storage cleanup taxonomy
- `ImageUploadService.deleteAllForUser` folder list is `{journal, misc, marketplace, babies, first-times}`.
  Actual folders written are `journal`, `marketplace`, `bump_photos`, `misc`, `storybook`.
- Result: `bump_photos` and `storybook` assets are **never deleted** on account removal; the list
  references `first-times`, a folder that's never written (the `first_times` context falls to `misc`).
- Fix: centralise folder names in one constant/enum shared by `UploadController`'s switch,
  `StorybookService.uploadChapterPhoto`, and `deleteAllForUser`. Add `bump_photos` + `storybook` to
  cleanup; drop the dead `first-times` entry (or give `first_times` its own folder in the switch and
  cover it in cleanup).

## Tests
- Upload: a non-image or oversize file → 400; a valid image → 200.
- Cleanup: `deleteAllForUser` invokes deletion for every folder actually written (assert the set).

## Files
- `Backend/.../upload/UploadController.java`
- `Backend/.../upload/ImageUploadService.java`
- `Backend/.../storybook/StorybookService.java` (uploadChapterPhoto folder constant)
- `Backend/.../resources/application.properties`

## Verification
1. `./gradlew test` green. ✓
2. Manual: uploading a `.txt` is rejected; uploading an image works on journal, first-times, bump,
   cover, and chapter-photo surfaces.
   - **Backend live-verified (curl, demo acct, 2026-06-20):** `.txt`→400, empty→400, real PNG→200
     (landed in `gotcherapp/journal/2/`), chapter-photos `.txt`→400, 11MB→400 via the multipart
     handler. Left a stray 1×1 px PNG in the demo account's `journal/2` Cloudinary folder — harmless,
     and a handy real asset for spot-checking the `deleteAllForUser` cleanup half later.
   - **Pending:** frontend manual smoke — confirm the cropper now refuses a non-image gracefully
     (no crash) and a real photo still crops/uploads across the surfaces.

## Implementation notes (done)
- New `upload/UploadFolder` enum is the single source of truth: `JOURNAL, MARKETPLACE, BUMP_PHOTOS,
  BABIES, STORYBOOK, MISC`. `fromContext()` maps request contexts (and folds `first_times`/unknown
  into `MISC`). `deleteAllForUser` iterates `UploadFolder.values()`, so cleanup can't drift again.
  Call sites updated: `UploadController` switch (removed), `StorybookService.uploadChapterPhoto`,
  `BabyProfileService.uploadCoverPhoto`.
- **Finding:** the review's "actual folders written" list missed `babies` (written by
  `BabyProfileService.uploadCoverPhoto`). The old cleanup list happened to include `babies` already,
  but it was a string literal — now centralised in the enum. Net cleanup fixes: `bump_photos` +
  `storybook` added; dead `first-times` dropped.
- Validation: `ImageUploadService.imageValidationError(file)` (shared static) returns a 400 message
  or null — rejects empty / non-`image/*` / over-`MAX_FILE_SIZE_BYTES` (10MB). Wired into both
  `/upload` and `/storybook/{id}/chapter-photos`. `ApiExceptionHandler` now maps
  `MaxUploadSizeExceededException` → 400 (multipart limit rejects oversize at parse time, before the
  controller guard runs). `application.properties` already had the 10MB multipart limits.
- Tests: `UploadFolderTest` (new), expanded `UploadControllerTest` (non-image, missing type,
  oversize, bump/first_times routing), expanded `ImageUploadServiceTest` (full-folder sweep set +
  best-effort-on-failure + validation cases), `ApiExceptionHandlerTest` (oversize → 400).
- **Frontend crash surfaced during verification:** selecting a non-image via the OS dialog's
  "All files" filter fed a `.txt` into the cropper — the `<img>` never decoded and ReactCrop crashed
  on NaN crop dimensions (toggling orientation triggered `centerAspectCrop(0,0,…)`). Fixed in
  `Frontend/src/lib/imageUtils.jsx`: `openCropModal` now rejects non-`image/*` files up front
  (alert + onCancel, no modal); `CropModal` hardened with a FileReader/`<img>` `onError` path, a
  zero-dimension guard, and a visible "couldn't open as an image" message. New
  `Frontend/src/test/imageUtils.test.jsx` covers the guard. The picker `accept="image/*"` is only a
  UX hint (bypassable) — the real protection is this client guard + the S5 server-side 400.
