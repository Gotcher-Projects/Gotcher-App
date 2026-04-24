# Bug Fixes — Session Opening Prompts

Copy-paste the relevant block at the start of each session.
Claude reads the plan file + only the specific files listed — no discovery phase.

> **Note:** Plans marked `Status: Complete` should eventually be moved to `plans/completed/` to keep this folder clean. This is not yet implemented — tracked as a future workflow improvement.

---

## feeding-oz-tracking
**Status: Complete** — no session needed.

---

## remember-me

```
Bug fix session: Remember Me / Persistent Login.
Plan: plans/bug-fixes/remember-me.md

Read before writing anything:
- Frontend/src/components/LoginPage.jsx (current login form structure + view state)
- Frontend/src/lib/auth.js (loginUser signature)
- Backend/src/main/java/com/gotcherapp/api/auth/AuthController.java (login endpoint + constructor injection pattern)
- Backend/src/main/java/com/gotcherapp/api/auth/AuthService.java (login method signature)
- Backend/src/main/java/com/gotcherapp/api/auth/dto/LoginRequest.java (current fields)
- Backend/src/main/java/com/gotcherapp/api/config/CookieUtil.java (how the refresh cookie is built today)

All decisions are in the plan. Do not change token storage — tokens travel as cookies, no localStorage changes needed.
```

---

## appointment-time-field

```
Bug fix session: Appointment Time Field.
Plan: plans/bug-fixes/appointment-time-field.md

Read before writing anything:
- Backend/db/migration/V21__add_appointment_time.sql (confirm V23 is the next free migration number — V21 is appointment time, V22 is reserved for password reset)
- Backend/src/main/java/com/gotcherapp/api/appointments/dto/AppointmentRequest.java
- Backend/src/main/java/com/gotcherapp/api/appointments/dto/AppointmentResponse.java
- Backend/src/main/java/com/gotcherapp/api/appointments/AppointmentService.java
- Frontend/src/components/tabs/AppointmentTab.jsx
- Frontend/src/components/tabs/DashboardTab.jsx (find the upcoming appointments preview section)

All decisions are in the plan. Column is nullable — do not add a NOT NULL constraint or a default.
```

---

## nursing-timer-quick-link
**Status: Under Review** — confirm with the user before starting.

```
Bug fix session: Nursing Timer in Dashboard Quick Links.
Plan: plans/bug-fixes/nursing-timer-quick-link.md

⚠️ This plan is under review. Before reading any files or writing any code, ask the user:
"This plan is marked Under Review — do you want to go ahead and implement the live nursing timer on the dashboard?"
Only proceed if they explicitly confirm yes.

If confirmed, read before writing anything:
- Frontend/src/components/tabs/DashboardTab.jsx (current nurse quick log UI + props)
- Frontend/src/components/BabySteps.jsx (lines 457–477 — DashboardTab props, and startFeed/stopFeed functions)
- Frontend/src/components/tabs/FeedingTab.jsx (existing elapsed timer pattern to mirror)
```
