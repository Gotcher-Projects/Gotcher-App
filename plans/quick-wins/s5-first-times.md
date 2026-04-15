# Session 5 — First Times Tracker
**Status:** Complete (2026-04-14)
**Branch:** feature/first-times
**Depends on:** S3 complete (appointments already done)
**Note:** S6 (tab restructure) will move the First Times tab into Memories. Build First Times
as a standalone tab here; S6 handles the merge.

---

## Context
First Times is a personal log of one-off baby firsts — first smile, first solid food, first
word, first steps, etc. Different from CDC milestones (those are a checklist). These are the
parent's own moments, with photos, dates, and optional notes. The standout feature is
one-tap sharing to grandparents via the native share sheet.

## Decisions made in S4 (do not re-litigate)
- **Sharing:** Web Share API (`navigator.share`) + Cloudinary-hosted image URL. No Canvas needed.
  Falls back to clipboard copy on desktop.
- **Entry style:** Hybrid — ~10 preset suggestions (quick-tap) + free-form custom label
- **Tab location:** Standalone "Firsts" tab for now. S6 merges it into a "Memories" tab with Journal.
- **Photo storage:** Cloudinary via existing `POST /upload?context=first_times` pattern

---

## Backend

### Migration — V16__create_first_times.sql
```sql
CREATE TABLE first_times (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  label           VARCHAR(120) NOT NULL,
  occurred_date   DATE NOT NULL,
  image_url       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_first_times_baby ON first_times(baby_profile_id);
```

### New package: `com.gotcherapp.api.firsttimes`
Follow the exact same pattern as `com.gotcherapp.api.appointments`:
- `FirstTime.java` — record: id, babyProfileId, label, occurredDate, imageUrl, notes, createdAt
- `FirstTimeRepository.java` — JdbcTemplate queries (findAllByBabyProfileId, save, delete, update)
- `FirstTimeService.java` — resolves baby profile from authenticated user, delegates to repo
- `FirstTimeController.java` — REST endpoints below
- `dto/CreateFirstTimeRequest.java` — record: label, occurredDate, imageUrl, notes
- `dto/UpdateFirstTimeRequest.java` — record: label, occurredDate, notes (no image — image
  replace reuses existing upload endpoint)

### Endpoints
| Method | Path | Description |
|---|---|---|
| GET | /first-times | List all for current user's baby, ordered by occurred_date DESC |
| POST | /first-times | Create new entry |
| PATCH | /first-times/{id} | Update label, date, notes |
| DELETE | /first-times/{id} | Delete entry |

Image upload: reuse existing `POST /upload?context=first_times` (ImageUploadService already
handles arbitrary context strings for the folder path).

All endpoints require JWT auth. Ownership check: verify first_times.baby_profile_id belongs
to the authenticated user's baby before any mutation.

---

## Frontend

### New file: `Frontend/src/lib/share.js`
```js
export async function shareFirstTime({ label, occurredDate, babyName, imageUrl }) {
  const text = `${babyName}'s first ${label} — ${occurredDate}`;
  const shareData = { title: `${babyName}'s First Times`, text };
  if (imageUrl) shareData.url = imageUrl;

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    await navigator.share(shareData);
  } else {
    await navigator.clipboard.writeText(`${text}${imageUrl ? '\n' + imageUrl : ''}`);
    // Caller should show a "Copied to clipboard" inline message
    return 'copied';
  }
}
```

### Preset suggestions (hardcoded in component)
```js
const FIRST_TIME_PRESETS = [
  'Smile', 'Laugh', 'Solid food', 'Steps', 'Word',
  'Haircut', 'Swim', 'Trip', 'Tooth', 'Rolled over',
];
```

### Changes to BabySteps.jsx
Add `value="firsts"` TabsTrigger + TabsContent alongside existing tabs (S6 relocates it).

State — add to existing data object:
```js
firsts: []
```

Mount fetch — same pattern as appointments:
```js
const firsts = await apiRequest('/first-times');
```

#### FirstTimesTab UI sections

**1. Add new first (top of tab)**
- Toggle between "Suggestions" and "Custom" mode
- Suggestions: grid of preset chips — tap one to pre-fill the label field
- Custom: plain text input for label
- Date picker (`type="date"`), optional note textarea, optional photo upload
- Photo upload: FormData → `apiUpload('/upload?context=first_times')` → store returned URL
- Save → POST /first-times

**2. First Times list (below add form)**
- Card per entry, sorted by occurred_date DESC
- Card shows: full-width hero photo (if present), label (large), date, notes
- Actions per card: Share, Edit (inline), Delete

**3. Share button behavior**
- Calls `shareFirstTime()` from share.js
- If returns `'copied'`: show brief "Copied to clipboard" inline message (no toast library)

---

## Testing checklist
- [ ] POST /first-times creates record; GET returns it
- [ ] PATCH updates label/date/notes; image_url unchanged
- [ ] DELETE removes record; subsequent GET excludes it
- [ ] Ownership check: user B cannot mutate user A's entry (403)
- [ ] Photo upload: file → Cloudinary → image_url stored on record
- [ ] Share on mobile: native share sheet opens with correct text + image URL
- [ ] Share on desktop: clipboard copy fires; "Copied" message appears
- [ ] Preset chip pre-fills label input
- [ ] Custom entry accepts any text up to 120 chars

---

## Out of scope for this session
- Moving First Times into the Memories tab — that's S6 (tab restructure)
- Shareable Milestone Card — post-deployment
- Memory Book PDF (Journal + First Times combined export) — future session
