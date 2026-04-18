# Session 9 — Photo Crop & Orientation
**Status:** Complete
**Branch:** feature/photo-crop-orientation
**Depends on:** S6 complete (Journal and First Times live inside Memories tab after restructure)

---

## Context
Photos of varying aspect ratios (especially portrait phone shots) displayed in fixed-height
cards caused unpredictable cropping — a big portion of the photo could be cut off with no
way for the user to fix it. The solution is to enforce a crop at upload time so every stored
image has a known aspect ratio. Cards then render at the correct height for their orientation.
A shared `imageUtils.js` handles the crop flow for both journal entries and first times,
ready to reuse for any future photo feature.

---

## Decisions
- Two supported formats: **landscape (4:3)** and **portrait (3:4)**
- Crop modal opens immediately on file selection — before anything is uploaded
- User picks orientation via toggle, drags crop box to frame the shot, confirms
- Canvas export → blob → upload to Cloudinary (existing upload flow unchanged)
- `image_orientation VARCHAR(11) DEFAULT 'landscape'` stored on both `journal_entries` and `first_times`
- Single column, variable height cards: portrait cards taller than landscape cards

---

## Backend

### Migration
Check the latest migration number before creating this file (could be V17 or V18 depending
on whether S8 added a migration).

```sql
ALTER TABLE journal_entries ADD COLUMN image_orientation VARCHAR(11) DEFAULT 'landscape';
ALTER TABLE first_times     ADD COLUMN image_orientation VARCHAR(11) DEFAULT 'landscape';
```

Both can go in a single migration file.

### API Changes
`PATCH /journal/{id}` and `PATCH /first-times/{id}` already exist. Add `imageOrientation`
to each:

**Journal:**
- Update DTO — add `String imageOrientation`
- Response DTO / entity — include `imageOrientation`
- `JournalService.update()` — add `image_orientation` to the dynamic SET clause

**First Times:**
- Update DTO — add `String imageOrientation`
- `FirstTime` response record — include `imageOrientation`
- `FirstTimeService.update()` — add `image_orientation` to the dynamic SET clause

Follow the nullable partial-update pattern already used in `AppointmentService`.

---

## Frontend

### New file: `Frontend/src/lib/imageUtils.js`
Exports one function: `openCropModal(file, onComplete)`

- Renders a modal overlay with the selected image
- Two toggle buttons: `▭ Landscape (4:3)` and `▯ Portrait (3:4)`
- Crop box constrained to the selected ratio — user drags to reframe
- Confirm: `canvas.toBlob()` → compress to max 1400px on the long edge, quality 0.85
- Calls `onComplete({ blob, orientation: 'landscape' | 'portrait' })`
- Cancel dismisses without calling `onComplete`

Use `react-image-crop`. Check if already installed (`package.json`); if not, `npm install react-image-crop`.

### Card Display
Replace fixed `h-48` on image elements with orientation-driven height:

```jsx
<img
  src={entry.imageUrl}
  className={`w-full object-cover ${entry.imageOrientation === 'portrait' ? 'h-72' : 'h-48'}`}
/>
```

Apply to journal entry cards and First Times cards in `MemoriesTab.jsx`.

### Upload Flow
Wherever a file input's `onChange` currently triggers upload directly, insert the crop step:

```js
onChange={async (e) => {
  const file = e.target.files[0]
  if (!file) return
  openCropModal(file, async ({ blob, orientation }) => {
    // pass blob instead of file to existing upload logic
    // pass orientation to save with the entry
  })
}}
```

Update both the journal photo upload and the first times photo upload.

---

## Files to Change

| File | Change |
|------|--------|
| `Backend/db/migration/V__add_image_orientation.sql` | New migration — two ALTER TABLE statements |
| Journal update DTO | Add `imageOrientation` |
| Journal response DTO / entity | Add `imageOrientation` |
| `JournalService.update()` | Add `image_orientation` to dynamic SET clause |
| First times update DTO | Add `imageOrientation` |
| `FirstTime` record | Add `imageOrientation` |
| `FirstTimeService.update()` | Add `image_orientation` to dynamic SET clause |
| `Frontend/src/lib/imageUtils.js` | New file — crop modal |
| `Frontend/src/components/tabs/MemoriesTab.jsx` | Wire crop modal into upload flows; orientation-driven card heights |

Read `MemoriesTab.jsx`, `JournalService.java`, `FirstTimeService.java`, and
`FirstTimeController.java` before coding.

---

## Testing Checklist
- [ ] Crop modal opens immediately on file selection (journal and first times)
- [ ] Landscape / Portrait toggle changes the crop box ratio correctly
- [ ] Confirmed crop uploads a properly cropped image (verify in Cloudinary)
- [ ] `imageOrientation` is saved and returned from both endpoints
- [ ] Portrait cards render taller than landscape cards
- [ ] Existing entries with no orientation value default to landscape height (no regression)
- [ ] Cancel on crop modal does not trigger upload
- [ ] Cards without photos are unaffected by the height changes

---

## Out of Scope
- Extending crop to other future photo surfaces (imageUtils is ready for reuse when needed)
- Multiple photos per entry
- Drag-to-reposition after upload
