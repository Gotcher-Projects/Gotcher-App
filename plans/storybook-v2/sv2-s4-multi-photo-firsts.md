# SV2-S4 — Multi-Photo First Times

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished).** (implemented 2026-06-25 — backend compiles, frontend builds, 244 FE tests pass; verify in-app then mark Complete)

## ✅ Implementation log (2026-06-25)

Built unattended per request. Decisions taken on the open questions (defaults, documented here):

**Open Q1 (empty gallery cells):** GalleryCanvas shows **only filled cells** in read/PDF (adaptive
grid — 1 photo = single column, 2–4 = 2-col grid). The builder shows all 4 droppable slots so they
can be filled. No dashed placeholders in the final page.
**Open Q2 (captions):** **optional.** Caption input per photo in the Firsts edit UI and per cell in
the gallery page; hidden on the page when blank.
**Open Q3 (hero in gallery):** gallery is **strictly the additional photos** — the hero
(`first_times.image_url`) is not duplicated into it.
**Open Q4 (max photos):** capped at **8 additional photos** per first time (`MAX_ADDITIONAL_PHOTOS`,
enforced server-side and in the UI).

### What was built
- **Migration `V38__create_first_time_photos.sql`** — the table from the schema below (sort_order
  `NOT NULL DEFAULT 0`).
- **Backend** (`com.gotcherapp.api.firsttimes`): `FirstTimePhoto` record; `FirstTime` gains
  `List<FirstTimePhoto> additionalPhotos` (populated on GET in one grouped query); service
  add/updateCaption/remove/reorder with ownership checks; controller sub-endpoints
  `POST /first-times/{id}/photos`, `PATCH /first-times/{id}/photos/{photoId}` (caption),
  `DELETE /first-times/{id}/photos/{photoId}`, `PATCH /first-times/{id}/photos/order`.
- **No multipart endpoint / no SecurityConfig change** (corrects the plan): the image is uploaded
  via the existing `POST /upload?context=first_times` → URL, then recorded as JSON. SecurityConfig
  is `anyRequest().authenticated()`, so the new routes are already protected.
- **Frontend:** `CradleHq.jsx` handlers + props; `MemoriesTab.jsx` — `GalleryStrip` (read-mode
  thumbnail strip on the card) + `MorePhotosEditor` (edit-mode add/caption/reorder via ◀ ▶/remove).
  Reorder uses move buttons rather than dnd (robust; dnd can be added later).
- **`GalleryCanvas.jsx`** renderer + `gallery` template + dispatch in ScrapbookBuilder /
  LayoutRenderer / storybookPdf + `GalleryThumb` in TemplateSheet. Photos fill from the photo tray;
  wiring it to `first_time_photos` **data** is deferred to sv2-s5/s7 per this plan.

### To verify in-app (needs Docker/DB + a session)
1. Memories → Firsts → edit a first → "More photos" → add 2–3 photos, caption them, reorder, remove one. Persists across reload.
2. Read-mode card shows the thumbnail strip.
3. Book builder → add a **Gallery** layout page → drop photos → renders; PDF export includes it.
4. Existing single-photo firsts unaffected (empty `additionalPhotos`).

---

**Status (original): Not started**
**Depends on:** sv2-s3 complete (or can run independently — no shared dependencies)
**Reference:** `planning.md` Q4 — first_time_photos table; enables gallery pages

---

**⭐ Page-type pattern (DECIDED 2026-06-24 — see `planning.md` §0 + `sv2-s1`):** this session is mostly the
**data layer** (`first_time_photos` table + Firsts UI). When the **`GalleryPage`** renderer it unlocks gets
built (here or in sv2-s5), build it as a **layout template + renderer in the book canvas** (the moment-hero
pattern) — a `renderer: 'gallery'` template in `lib/storybookTemplates.js` dispatched in `ScrapbookBuilder`
/ `LayoutRenderer` / `storybookPdf.js` — **NOT an `anchor_type` chapter.** The photo **data** lives in
`first_time_photos`; the **page** is just a layout reading it.

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
