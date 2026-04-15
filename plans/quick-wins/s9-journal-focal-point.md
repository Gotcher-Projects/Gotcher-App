# Session 9 — Journal Photo Focal Point
**Status:** Pending
**Branch:** feature/journal-focal-point
**Depends on:** S6 complete (Journal lives inside Memories tab after restructure)

---

## Context
Journal entry cards show a fixed-height hero image. Currently `object-cover` crops the image
unpredictably — portraits often lose the baby's face. A simple `object-position` toggle
(top / center / bottom) lets the parent pick which part of the photo is visible without
needing a full crop UI.

---

## Decision Made in S4
Simple focal-point toggle (3 positions stored per entry) rather than a full drag-to-crop UI.
`object-position` is a CSS property — we just store the value and apply it.

---

## Backend

### Migration — V17 (or V18 if V17 is taken by S8)
Check the latest migration number before creating this file.

```sql
ALTER TABLE journal_entries ADD COLUMN image_position VARCHAR(10) DEFAULT 'center';
```

### API Change
`PATCH /journal/{id}` already exists. Add `imagePosition` to the request DTO:

- `Backend/src/main/java/com/gotcherapp/api/journal/dto/UpdateJournalRequest.java` (or equivalent) — add `String imagePosition`
- `JournalService.update()` — add `image_position` to the dynamic SET clause
- Response DTO / entity — include `imagePosition` in the returned record

Read the existing PATCH implementation before making changes — follow the same nullable
partial-update pattern used in `AppointmentService`.

---

## Frontend

### Position toggle UI
On the journal entry card (read-only view, not just edit mode):
- Only visible if the entry has an `imageUrl`
- Three small buttons below or overlaid on the image: `↑ Top` | `— Center` | `↓ Bottom`
- Tapping one immediately sends `PATCH /journal/{id}` with `{ imagePosition: 'top' | 'center' | 'bottom' }`
- Optimistic update — apply the CSS change immediately, revert on error

### CSS
```jsx
<img
  src={entry.imageUrl}
  className="w-full h-48 object-cover"
  style={{ objectPosition: entry.imagePosition || 'center' }}
/>
```

### Position values
| Button label | `imagePosition` value | CSS `object-position` |
|---|---|---|
| Top | `'top'` | `'top'` |
| Center | `'center'` | `'center'` |
| Bottom | `'bottom'` | `'bottom'` |

### Where to add the toggle
In `JournalTab` (or `JournalCard` if extracted), on the entry card's image section.
Keep it subtle — small pill buttons, muted color, only visible on cards with photos.

---

## Files to Change

| File | Change |
|------|--------|
| `Backend/db/migration/V17__add_image_position_to_journal.sql` | New migration — ALTER TABLE |
| Journal entity / response DTO | Add `imagePosition` field |
| Journal service `update()` | Handle `imagePosition` in dynamic SET |
| `Frontend/src/components/BabySteps.jsx` | Add position toggle UI to journal cards; apply `objectPosition` style |

Read the journal section of BabySteps.jsx (search for `JournalTab`) and the journal backend
files before coding — understand the current update flow.

---

## Testing Checklist
- [ ] Default position is 'center' for existing entries (no visual change on existing data)
- [ ] Clicking Top/Center/Bottom updates the image crop immediately (optimistic)
- [ ] Position persists on page reload
- [ ] PATCH with `imagePosition` doesn't affect other fields (label, notes, imageUrl unchanged)
- [ ] Toggle buttons only appear on cards that have a photo
- [ ] No visual regression on cards without photos
- [ ] Position toggle works in both read-only card view and after editing

---

## Out of Scope
- Extending focal point to First Times photos (same mechanism, separate session)
- Full drag-to-crop UI
- Multiple photo support per journal entry
