# SV2-S4 — Multi-Photo First Times

**Status: Not started**
**Depends on:** sv2-s3 complete (or can run independently — no shared dependencies)
**Reference:** `planning.md` Q4 — first_time_photos table; enables gallery pages

---

## Goal

Extend First Times to support **multiple photos per event** — allowing parents to add several photos to a single First Time. This unlocks gallery pages in the moment-hero system (sv2-s5/sv2-s7) but is also a standalone improvement to the Firsts feature regardless of the book.

Current state: each First Time has exactly one `image_url`. This session adds a `first_time_photos` join table and updates the Firsts UI to add/remove/reorder additional photos.

---

## Schema

### New migration: `Vxx__create_first_time_photos.sql`
```sql
CREATE TABLE first_time_photos (
  id              BIGSERIAL PRIMARY KEY,
  first_time_id   BIGINT NOT NULL REFERENCES first_times(id) ON DELETE CASCADE,
  image_url       TEXT NOT NULL,
  caption         VARCHAR(200),
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_first_time_photos_first ON first_time_photos(first_time_id);
```

The existing `first_times.image_url` becomes the **hero photo** — it's the primary image shown in the moment-hero hero page, and the first photo in any gallery. Additional photos go in `first_time_photos`. This avoids a data migration and keeps the existing image handling intact.

---

## Scope

### 1. Backend

**Updates to existing `com.gotcherapp.api.firsttimes` package:**
- `FirstTime` record — add `List<FirstTimePhoto> additionalPhotos` (populated on GET)
- New `FirstTimePhoto` record
- `FirstTimeService` — include additional photos in list/get responses; add methods to add/remove/reorder
- New endpoints:
  - `POST /first-times/{id}/photos` — multipart upload, adds a photo, returns new photo record
  - `DELETE /first-times/{id}/photos/{photoId}` — removes a photo
  - `PATCH /first-times/{id}/photos/order` — reorder (`{ orderedIds: [...] }`)

### 2. Frontend — Firsts UI update

In the `FirstTimesTab` (inside `MemoriesTab.jsx`):

**On the First Time card:**
- Show existing hero photo as before
- Show additional photos as a small horizontal thumbnail strip below
- "Add another photo" button (only visible when card is in edit mode, or as a persistent "+")

**In the add/edit flow:**
- After the primary photo, a section "More photos (optional)" with a photo grid
- Each additional photo has a caption field and a remove button
- Drag-to-reorder the additional photos

Photo upload uses the same crop modal + upload pattern as the primary photo. Crop aspect: free (landscape or portrait both valid for gallery).

### 3. `GalleryPage.jsx` component
New file: `Frontend/src/components/storybook/GalleryPage.jsx`

Fixed layout. Props:
```js
{
  title: String,           // "More from First Steps"
  subtitle: String,        // "More from [section label]"
  photos: [{ url, caption }],  // up to 4; handles < 4 gracefully
  theme: BookTheme,
}
```

Layout:
- "More from [label]" header + italic subtitle
- 2×2 photo grid — each cell has photo + caption below
- If fewer than 4 photos: fill remaining cells with a subtle empty placeholder or leave blank (decide at session)
- Decorative section label at top

### 4. Integration with moment-hero

This session does **not** wire gallery pages into the book — that's sv2-s5/sv2-s7. This session just makes the data available and builds the `GalleryPage` renderer. The wiring happens when the guided book is built.

---

## Files to touch

| File | Change |
|---|---|
| `Backend/db/migration/Vxx__create_first_time_photos.sql` | New table |
| `Backend/.../firsttimes/FirstTime.java` | Add additionalPhotos field |
| `Backend/.../firsttimes/FirstTimeService.java` | Include photos in responses; add/remove/reorder |
| `Backend/.../firsttimes/FirstTimeController.java` | New photo sub-endpoints |
| `Frontend/src/components/storybook/GalleryPage.jsx` | New — 2×2 gallery page renderer |
| `Frontend/src/components/tabs/MemoriesTab.jsx` | Update FirstTimesTab + FirstTimeCard for multi-photo UI |
| `Frontend/src/lib/storybookPdf.js` | Handle gallery_page chapter type (if wired) |

---

## Open questions (resolve at session start)

1. **Empty gallery cells:** If a First Time has fewer than 4 additional photos, how does the gallery page handle it? (Empty/dashed placeholder, or only show as many cells as there are photos?)
2. **Caption requirement:** Are captions required, optional, or not shown at all?
3. **Hero photo in gallery:** Does the hero photo (from `first_times.image_url`) also appear in the gallery, or is the gallery strictly the *additional* photos?
4. **Max photos:** Is there a cap on additional photos per First Time?

---

## Verification

1. Add additional photos to an existing First Time — persists correctly.
2. Reorder photos — order persists.
3. Delete an additional photo — removed from the strip.
4. GalleryPage renders 1, 2, 3, and 4 photos correctly.
5. First Time cards in MemoriesTab show the additional photo strip.
6. Existing First Times with one photo are unaffected (empty additionalPhotos list).
