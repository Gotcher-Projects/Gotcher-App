# S12 — Diaper Tracking (Poop → Diaper + Add Pee)
**Status:** Done
**Branch:** `quick-wins`
**Depends on:** nothing

## Goal
Rename all "poop" tracking to "diaper" and add pee as a loggable category. Pee entries are simpler — no color/consistency fields. Poop entries stay the same.

## Scope Summary
- DB: rename table + add `category` column
- Backend: rename package/files, update validation, rename endpoint `/poop` → `/diaper`
- Frontend: rename PoopTab UI, add pee/poop selector, hide color/consistency for pee logs
- Seed script: add `category` to existing entries

## Files to Change

| File | Change |
|------|--------|
| `Backend/db/migration/V18__rename_poop_to_diaper.sql` | New — rename table + add category column |
| `Backend/src/main/java/com/gotcherapp/api/poop/` | Rename package to `diaper`, rename all files |
| `PoopLog.java` → `DiaperLog.java` | Add `category` field |
| `PoopRequest.java` → `DiaperRequest.java` | Add `category` field (required) |
| `PoopService.java` → `DiaperService.java` | Rename table refs, add category validation, skip color/consistency validation for pee |
| `PoopController.java` → `DiaperController.java` | Change mapping `/poop` → `/diaper` |
| `PoopServiceTest.java` → `DiaperServiceTest.java` | Update refs |
| `Frontend/src/components/tabs/TrackTab.jsx` | Rename PoopTab → DiaperTab, add pee/poop selector, conditionally show color/consistency |
| `Frontend/src/lib/api.js` | Update `/poop` → `/diaper` endpoint calls |
| `seed-demo-user.sh` | Add `"category":"poop"` to all poop entries, add a few `"category":"pee"` entries |

## Key Decisions
- **`category` values:** `pee` or `poop` — required on all new entries. Default existing rows to `poop` in migration.
- **Pee entries:** Only log `loggedAt`, `category`, and optionally `notes`. Color/consistency/type fields hidden in UI and ignored by backend.
- **Poop entries:** Unchanged — type/color/consistency still apply.
- **Endpoint:** `/diaper` replaces `/poop`. No backwards compatibility needed (local dev only at this stage).
- **Table name:** `poop_logs` → `diaper_logs` in migration. Flyway handles it cleanly as a new versioned migration.
- **Package rename:** Move files from `com.gotcherapp.api.poop` → `com.gotcherapp.api.diaper`.

## Migration (V18)
```sql
ALTER TABLE poop_logs RENAME TO diaper_logs;
ALTER TABLE diaper_logs ADD COLUMN category VARCHAR(10) NOT NULL DEFAULT 'poop';
ALTER TABLE diaper_logs ADD CONSTRAINT diaper_logs_category_check CHECK (category IN ('pee', 'poop'));
```

## Verification
- [ ] API boots without errors
- [ ] `POST /diaper` with `category: pee` saves without color/consistency
- [ ] `POST /diaper` with `category: poop` saves with color/consistency as before
- [ ] `GET /diaper` returns both pee and poop entries with correct category field
- [ ] TrackTab shows pee/poop toggle when logging
- [ ] Color/consistency fields hidden for pee, visible for poop
- [ ] Existing entries still display correctly (all show as poop)
- [ ] Seed script runs cleanly with category field
