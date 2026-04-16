# Session 10 — Demo Seed, Code Review & Test Coverage
**Status:** Pending
**Branch:** feature/demo-and-testing
**Depends on:** S7 complete

---

## Context
Three housekeeping items before deployment prep: refresh the demo seed script to cover
features added since S3 (milestones, vaccines, appointments, first-times), do a code
review of the S7 dashboard work, then close the gaps in test coverage.

---

## Part 1 — Demo Seed Script Update

### Current state
`seed-demo-user.sh` seeds: profile, journal (8 entries), growth (6 records),
feeding (11 sessions, last 3 days), sleep (25 sessions, last 7 days), poop (16 entries).

### Missing data — add all of these
| Feature | API | Notes |
|---------|-----|-------|
| Milestones | `POST /milestones/{key}` | Seed achieved milestones for weeks 0–20. Key format: `${Math.floor(week/4)*4}-${index}`. Mark ~70% achieved to look realistic, not perfect. |
| Vaccines | `POST /vaccines/{key}` | Seed all vaccines due by 4 months (birth, 2m, 4m schedules). Key format matches VACCINES constant in `babyData.js`. |
| Appointments | `POST /appointments` | 2 past (completed), 2 upcoming. Fields: appointmentDate, appointmentType, doctorName, notes, isCompleted. |
| First times | `POST /first-times` | 6–8 entries: first smile, first laugh, first roll, first bath, first solid food, etc. Fields: title, date, notes, presetKey. |

### Feeding — extend window
Current script seeds 3 days of feeds. The quick-log stats cards on Dashboard look at
"today" and "last 24h" — if the script is run mid-day, those cards will show zeros.
Add at least 3 feeds for today (offset 0) spaced ~3h apart so the dashboard stats are
populated immediately after seeding.

### Birthdate note
The birthdate `2025-11-02` is hardcoded with a comment "Born ~20 weeks ago from 2026-03-22".
Update the comment to reflect actual age as of 2026-04-15 (~24 weeks). The date itself is
fine — do not change it, as the journal entry week numbers would need to change too.

---

## Part 2 — Code Review

Review these files changed in S6.5 and S7. Look for: logic bugs, missing null guards,
prop-shape mismatches, accessibility issues, anything that would break on first use.

### Files to review
| File | What to check |
|------|--------------|
| `Frontend/src/components/tabs/DashboardTab.jsx` | Quick-log submit logic (especially nurse duration math and the bottle/formula oz field being optional), stat card edge cases (empty arrays, undefined props), "See all milestones" deep-link, celebration message condition |
| `Frontend/src/components/tabs/HealthTab.jsx` | useEffect sync — does it fire correctly when healthView changes from Dashboard? Does it reset to 'growth' when the prop goes back to undefined? |
| `Frontend/src/components/BabySteps.jsx` | Controlled Tabs — does `onValueChange` fire for all tab clicks? healthView state — does it stay in sync if the user manually clicks the Health pill nav? |

### Known issue to fix
`run-all-tests.sh` checks for `build.gradle.kts` but the backend uses `build.gradle`
(not Kotlin DSL). The backend suite is silently skipped on every run. Fix the check to
look for `build.gradle` instead.

---

## Part 3 — Test Coverage

### Current state
Frontend: 2 test files — `auth.test.js` (17 tests), `api.test.js` (7 tests).
Backend: 0 test files (silently skipped due to the build.gradle.kts bug above).

### Frontend — new test files to add

**`Frontend/src/test/babyAge.test.js`**
Test the pure functions in `Frontend/src/lib/babyAge.js`:
- `getWeek(birthdate)` — null/empty input returns 0, known dates return correct week count
- `formatBabyAge(birthdate)` — null returns empty string, known dates return human-readable age
- Edge cases: birthdate today (0 weeks), birthdate in the future (clamp to 0)

**`Frontend/src/test/dashboardStats.test.js`**
The stat computation helpers in DashboardTab (`timeAgo`, `fmtDuration`) are currently
inline. Extract them to `Frontend/src/lib/dashboardStats.js` and test:
- `fmtDuration` — 0 secs, 45 secs, 90 secs (1m 30s), 3600 secs (1h 0m), 3750 secs (1h 2m... wait: 1h + floor((3750%3600)/60) = 1h 2m)
- `timeAgo` — just now (<1 min), 45 min ago, 2h 30m ago, exactly 1h
- `computeFeedingStats(feeding)` — returns { mostRecentFeed, todayFeeds, avgGapStr } correctly
- `computeSleepStats(sleep)` — returns { totalSleepSecs, longestSleepSecs, mostRecentSleep } for last 24h only

Extracting to a lib file also removes the inline-function smell from DashboardTab.

**`Frontend/src/test/utils.test.js`**
Test `cn()` from `Frontend/src/lib/utils.js` — basic className merging, conditional classes.
Very small but closes the gap.

### Backend — new test files to add

The backend has no tests at all. Add unit tests with JUnit 5 + Mockito (already in scope
from Spring Boot starter-test).

**`Backend/src/test/java/com/gotcherapp/api/auth/AuthServiceTest.java`**
Mock `JdbcTemplate` and `JwtUtil`. Test:
- `register()` — throws when email already exists, returns LoginResponse on success
- `login()` — throws on bad password, returns tokens on success
- `refresh()` — throws when token not found, returns new tokens on success

**`Backend/src/test/java/com/gotcherapp/api/baby/MilestoneServiceTest.java`**
Mock `JdbcTemplate`. Test:
- `getKeys()` — returns list of keys for the baby profile
- `achieve()` — calls correct INSERT, handles duplicate gracefully
- `unachieve()` — calls correct DELETE

These two are the highest-value backend tests. If time allows, add FeedingServiceTest
following the same pattern.

---

## Files to Change

| File | Change |
|------|--------|
| `seed-demo-user.sh` | Add milestones, vaccines, appointments, first-times sections; extend feeding to include today; update birthdate comment |
| `run-all-tests.sh` | Fix `build.gradle.kts` → `build.gradle` check |
| `Frontend/src/lib/dashboardStats.js` | New file — extract helpers from DashboardTab |
| `Frontend/src/components/tabs/DashboardTab.jsx` | Import helpers from dashboardStats.js instead of inline |
| `Frontend/src/test/babyAge.test.js` | New file |
| `Frontend/src/test/dashboardStats.test.js` | New file |
| `Frontend/src/test/utils.test.js` | New file |
| `Backend/src/test/java/.../AuthServiceTest.java` | New file |
| `Backend/src/test/java/.../MilestoneServiceTest.java` | New file |

---

## Testing Checklist
- [ ] `./run-all-tests.sh` — all suites pass (backend no longer skipped)
- [ ] Demo seed runs cleanly end-to-end: `./seed-demo-user.sh`
- [ ] Dashboard stats cards show data immediately after seeding (today's feeds populated)
- [ ] Milestones card on Dashboard shows correct current-age-group items for Lily (~24 weeks)
- [ ] Upcoming appointments card shows 2 future appointments
- [ ] "See all milestones" deep-link lands on Health → Milestones
- [ ] No regressions on any other tab

---

## Out of Scope
- S8 CDC percentile overlay
- S9 journal focal point
- Any new user-facing features
