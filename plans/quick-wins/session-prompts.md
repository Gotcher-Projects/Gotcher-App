# Quick Wins — Session Opening Prompts

Copy-paste the relevant block at the start of each session.
Claude reads the session file + only the specific files listed — no discovery phase.

---

## Session 1 — Journal Design Spiff

```
Session 1 of quick-wins. Branch: quick-wins (create from main if it doesn't exist).
Plan: plans/quick-wins/s1-journal-spiff.md

One file to change — frontend only, no backend:

Frontend/src/components/BabySteps.jsx — rework the journal entry card layout.
The entry cards are in the JournalTab function starting around line 787.
The read-only card view (not the edit form) needs the photo, typography, and empty state polished.
All decisions are in the plan file — no new components, no new files, style changes only.
```

---

## Session 2 — Vaccine Tracker

```
Session 2 of quick-wins. Branch: quick-wins.
Plan: plans/quick-wins/s2-vaccine-tracker.md

Full-stack feature. Latest DB migration is V13 (poop_logs), so next is V14.

Backend — 3 new files, pattern mirrors MilestoneController/MilestoneService exactly:
1. Backend/db/migration/V14__create_vaccine_records.sql — schema in plan file
2. Backend/src/main/java/com/gotcherapp/api/baby/VaccineService.java
3. Backend/src/main/java/com/gotcherapp/api/baby/VaccineController.java
No SecurityConfig changes needed.

Frontend — 2 files:
4. Frontend/src/lib/babyData.js — add VACCINES constant (CDC 0-18m schedule, structure in plan)
5. Frontend/src/components/BabySteps.jsx — add vaccine state, mount fetch, toggle functions,
   VaccineTab component, and tab trigger. Tab goes between Milestones and Journal.

Read MilestoneService.java and MilestoneController.java before writing the vaccine equivalents
— the pattern is identical. Key decisions in the plan file.
```

---

## Session 3 — Doctor Appointment Reminders

```
Session 3 of quick-wins. Branch: quick-wins.
Plan: plans/quick-wins/s3-appointments.md

Full-stack feature. V14 (vaccines) must exist before this session. Next migration is V15.

Backend — 6 new files, new package com.gotcherapp.api.appointments:
1. Backend/db/migration/V15__create_appointments.sql — schema in plan file
2. Backend/src/main/java/com/gotcherapp/api/appointments/Appointment.java
3. Backend/src/main/java/com/gotcherapp/api/appointments/dto/AppointmentRequest.java
4. Backend/src/main/java/com/gotcherapp/api/appointments/dto/AppointmentResponse.java
5. Backend/src/main/java/com/gotcherapp/api/appointments/AppointmentService.java
6. Backend/src/main/java/com/gotcherapp/api/appointments/AppointmentController.java
No SecurityConfig changes needed.

Frontend — 1 file:
7. Frontend/src/components/BabySteps.jsx — add appointments state, mount fetch, CRUD functions,
   AppointmentTab component, tab trigger, and upcoming card in DashboardTab.

Read GrowthService.java and GrowthController.java as the closest pattern (has create/delete,
uses JdbcTemplate, same ownership check). Key decisions and all DTO fields in the plan file.
```

---

## Session 4 — Feature Planning Review

```
Session 4 of quick-wins. Planning session only — no code.
Plan: plans/quick-wins/s4-planning-review.md

Work through the agenda at the bottom of the plan file:
1. Resolve the First Times tracker design questions (sharing approach, preset vs. free-form,
   tab location, Cloudinary dependency). Exit with enough decisions made to write an
   implementation session file.
2. Stack-rank the 8 other feature ideas — assign each one to "next plan", "later", or "cut".
3. If First Times is fully spec'd by end of session, write s5-first-times.md before ending.

Do not write any code. This session is decisions only.
```

---

## Session 5 — First Times Tracker

```
Session 5 of quick-wins. Branch: feature/first-times.
Plan: plans/quick-wins/s5-first-times.md

Full-stack feature. Latest DB migration is V15 (appointments), so next is V16.

Backend — new package com.gotcherapp.api.firsttimes:
1. Backend/db/migration/V16__create_first_times.sql — schema in plan
2. Backend/src/main/java/com/gotcherapp/api/firsttimes/FirstTime.java — record
3. Backend/src/main/java/com/gotcherapp/api/firsttimes/dto/CreateFirstTimeRequest.java
4. Backend/src/main/java/com/gotcherapp/api/firsttimes/dto/UpdateFirstTimeRequest.java
5. Backend/src/main/java/com/gotcherapp/api/firsttimes/FirstTimeService.java
6. Backend/src/main/java/com/gotcherapp/api/firsttimes/FirstTimeController.java
No SecurityConfig changes needed.

Frontend — 2 files:
7. Frontend/src/lib/share.js — shareFirstTime() using Web Share API + clipboard fallback
8. Frontend/src/components/BabySteps.jsx — firsts state, mount fetch, CRUD handlers,
   FirstTimesTab component (preset chips + custom mode + photo upload), FirstTimeCard
   (hero photo, share/edit/delete), "Firsts" TabsTrigger + TabsContent.

Read AppointmentService.java and AppointmentController.java first — this feature follows
the exact same pattern. All decisions and DTO fields are in the plan file.
```

---

## Session 6 — Tab Restructure (12 → 5)

```
Session 6 of quick-wins. Branch: feature/tab-restructure.
Plan: plans/quick-wins/s6-tab-restructure.md

Frontend only. No backend changes, no new API calls.

One file to change: Frontend/src/components/BabySteps.jsx

Goal: replace the current 12-tab row with 5 top-level tabs (Dashboard, Memories, Track,
Health, Discover). Each grouped tab gets a PillNav for sub-views. All existing components
stay exactly as-is — only the navigation wrapper changes.

Read the plan file for: exact tab groupings, secondary view state variable names, PillNav
component spec, and which components go under which tab. Do not change DashboardTab content —
that's S7.
```

---

## Session 6.5 — Split BabySteps.jsx by Tab

```
Session 6.5 of quick-wins. Branch: feature/file-split.
Plan: plans/quick-wins/s6.5-file-split.md

Frontend only. Pure file reorganization — no feature changes, no backend.

Goal: split BabySteps.jsx (~2530 lines) into one file per top-level tab so future
sessions only need to read one small file instead of the whole thing.

Target structure:
  Frontend/src/components/ui/PillNav.jsx
  Frontend/src/components/tabs/DashboardTab.jsx
  Frontend/src/components/tabs/MemoriesTab.jsx
  Frontend/src/components/tabs/TrackTab.jsx
  Frontend/src/components/tabs/HealthTab.jsx
  Frontend/src/components/tabs/DiscoverTab.jsx

Each tab file manages its own sub-view state (Option A in the plan). BabySteps.jsx
keeps all data state, handlers, and the nav shell — it should be under 450 lines after.

Read the plan file for the exact component-to-file mapping and execution order.
Do one tab file at a time, wire it into BabySteps.jsx, verify in the browser, then move on.
```

---

## Session 7 — Dashboard Upgrades

```
Session 7 of quick-wins. Branch: feature/dashboard-upgrades.
Plan: plans/quick-wins/s7-dashboard-upgrades.md

Frontend only. No backend changes. Uses data already loaded in BabySteps.jsx.

One file to change: Frontend/src/components/tabs/DashboardTab.jsx
(S6.5 will have split BabySteps.jsx — DashboardTab now lives in its own file)

Three additions to DashboardTab:
1. Quick-log buttons — 2×2 grid (Feed bottle, Feed nurse, Diaper, Sleep). Each opens a
   minimal inline form that calls the existing handler functions passed as props.
   No new API calls needed.
2. Milestone card — current age group's milestones with inline checkboxes. Uses existing
   toggleMilestone handler and data.milestones state. "See all" navigates to Health tab.
3. Sleep + feeding summary cards — computed stats from existing `feeding` and `sleep` state.
   No new API calls.

Read DashboardTab.jsx before writing anything — understand what props it already receives.
All decisions in the plan file.
```

---

## Session 8 — CDC Growth Percentiles ✓ COMPLETE

```
Session 8 of quick-wins. Branch: feature/growth-percentiles.
Plan: plans/quick-wins/s8-growth-percentiles.md

Mostly frontend. Backend change only if baby_profiles is missing a sex column (check V3
migration first).

Files:
1. Frontend/src/lib/growthPercentiles.js — new static data file with WHO 0–24m LMS tables
   for weight, length, and head circumference (boys + girls). Structure in plan file.
2. Frontend/src/components/BabySteps.jsx — import percentile data, overlay dashed reference
   lines (5th/50th/95th) on the existing growth chart in GrowthTab.

Read GrowthTab in BabySteps.jsx first — the chart implementation (SVG vs. library) determines
exactly how overlays are added. If baby_profiles doesn't have a sex column, add migration
V17 and the corresponding field to the profile form. All decisions in the plan file.
```

---

## Session 10 — Demo Seed, Code Review & Test Coverage

```
Session 10 of quick-wins. Branch: feature/demo-and-testing.
Plan: plans/quick-wins/s10-demo-and-testing.md

Three parts — work through them in order:

1. Demo seed script (seed-demo-user.sh) — add milestones, vaccines, appointments, and
   first-times sections. Also add today's feeding logs so the Dashboard stats cards are
   populated immediately after seeding. Fix the birthdate comment. Do not change the
   birthdate itself.

2. Code review — read DashboardTab.jsx, HealthTab.jsx, and the S7 changes in BabySteps.jsx.
   Fix anything found. Also fix run-all-tests.sh: it checks for build.gradle.kts but the
   backend uses build.gradle — the backend suite is silently skipped every run.

3. Test coverage — extract the stat helpers from DashboardTab into
   Frontend/src/lib/dashboardStats.js, then add test files:
     Frontend/src/test/babyAge.test.js
     Frontend/src/test/dashboardStats.test.js
     Frontend/src/test/utils.test.js
     Backend/src/test/java/.../AuthServiceTest.java
     Backend/src/test/java/.../MilestoneServiceTest.java

Read the plan file for the full list of what to seed, what to test, and what to check
in the review. Run ./run-all-tests.sh at the end — all suites must pass.
```

---

## Session 9 — Photo Crop & Orientation ✓ COMPLETE

```
Session 9 of quick-wins. Branch: feature/photo-crop-orientation.
Plan: plans/quick-wins/s9-journal-focal-point.md

Full stack. Check the latest migration number before creating the new one (could be V17 or V18).

Backend:
1. New migration — ALTER TABLE journal_entries ADD COLUMN image_orientation VARCHAR(11) DEFAULT 'landscape'
                   ALTER TABLE first_times ADD COLUMN image_orientation VARCHAR(11) DEFAULT 'landscape'
   (both statements in one migration file)
2. Journal update DTO + response DTO — add imageOrientation field
3. JournalService update() — add image_orientation to dynamic SET clause
4. FirstTime record + update DTO — add imageOrientation field
5. FirstTimeService update() — add image_orientation to dynamic SET clause

Frontend:
6. Frontend/src/lib/imageUtils.js — new file: openCropModal(file, onComplete)
   - Modal with image preview + Landscape/Portrait toggle (4:3 / 3:4)
   - Crop box constrained to ratio, canvas export, max 1400px long edge, quality 0.85
   - Calls onComplete({ blob, orientation: 'landscape' | 'portrait' })
   - Check if react-image-crop is installed in package.json; install if not
7. Frontend/src/components/tabs/MemoriesTab.jsx — wire openCropModal into both journal and
   first times photo upload onChange handlers; use orientation-driven card heights
   (h-72 portrait, h-48 landscape/default)

Read MemoriesTab.jsx, JournalService.java, FirstTimeService.java, FirstTimeController.java
before coding. All decisions in the plan file.
```
