# Session 2 — Vaccine Tracker
**Status:** Pending
**Branch:** `quick-wins`
**Depends on:** S1 complete (or can be done independently — no shared files)

## Goal
CDC-schedule vaccine checklist, stored per baby profile. Same toggle UX as milestones.

## Files to Change

### Backend
| File | Change |
|------|--------|
| `Backend/db/migration/V14__create_vaccine_records.sql` | New — vaccine_records table |
| `Backend/src/main/java/com/gotcherapp/api/baby/VaccineService.java` | New — getKeys, achieve, unachieve |
| `Backend/src/main/java/com/gotcherapp/api/baby/VaccineController.java` | New — GET/POST/DELETE /vaccines/{key} |

### Frontend
| File | Change |
|------|--------|
| `Frontend/src/lib/babyData.js` | Add VACCINES constant (CDC schedule groups) |
| `Frontend/src/components/BabySteps.jsx` | Add vaccine state + API calls, VaccineTab component, tab trigger |

## Key Decisions

### Schema
```sql
CREATE TABLE vaccine_records (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  vaccine_key     VARCHAR(40) NOT NULL,
  administered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(baby_profile_id, vaccine_key)
);
```

### Vaccine key format
Stable string: `"{ageGroup}-{index}"` e.g. `"birth-0"`, `"2m-1"`. Same stable-key logic as milestones.
Age group slugs: `birth`, `2m`, `4m`, `6m`, `12m`, `15m`, `18m`.

### API endpoints (mirror MilestoneController exactly)
- `GET  /vaccines`      → `{ "keys": ["birth-0", "2m-1", ...] }`
- `POST /vaccines/{key}` → 200 (idempotent upsert)
- `DELETE /vaccines/{key}` → 204

### VaccineService pattern
Copy MilestoneService structure:
- `getKeys(userId)` — look up profileId via BabyProfileRepository, query vaccine_records
- `achieve(userId, key)` — upsert with `ON CONFLICT DO NOTHING`
- `unachieve(userId, key)` — delete row

### SecurityConfig
No change needed — `/vaccines/**` falls under `.anyRequest().authenticated()` automatically.

### VACCINES data structure in babyData.js
```js
export const VACCINES = {
  birth: [
    "Hepatitis B (HepB) — 1st dose",
  ],
  "2m": [
    "Hepatitis B (HepB) — 2nd dose",
    "Rotavirus (RV) — 1st dose",
    "Diphtheria/Tetanus/Pertussis (DTaP) — 1st dose",
    "Haemophilus influenzae type b (Hib) — 1st dose",
    "Pneumococcal (PCV15/PCV20) — 1st dose",
    "Inactivated Poliovirus (IPV) — 1st dose",
  ],
  // ... 4m, 6m, 12m, 15m, 18m
};
```
Include all standard CDC 0–18m vaccines. Use the display name as the value (key is the stable slug).

### Frontend state
Add alongside milestones state pattern in BabySteps:
```js
const [vaccines, setVaccines] = useState({});   // { "birth-0": true, ... }
```
Load on mount: `GET /vaccines` → convert keys array to `{ key: true }` map.

### VaccineTab UI
- Same layout as MilestonesTab: group cards by age period
- Each vaccine is a row with a Checkbox + label
- Checked = administered. Toggle calls POST or DELETE.
- Show a progress badge per group: "3 / 6 given"
- Color scheme: sky-600 (matches `<TabsTrigger value="…">` style for milestones)

### Tab insertion
Add tab trigger + content between Milestones and Journal in the tab list (line ~343–353 in BabySteps.jsx).

## Verification
- [ ] `Backend/gradlew bootRun` starts without Flyway errors (V14 migration applies cleanly)
- [ ] `GET /vaccines` returns `{ "keys": [] }` for a new profile
- [ ] Checking a vaccine in the UI persists after page refresh
- [ ] Unchecking removes it
- [ ] Progress badge counts are accurate per age group
- [ ] Tab renders correctly on mobile (flex-wrap tab list handles extra tab)
- [ ] No console errors
