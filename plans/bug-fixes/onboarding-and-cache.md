# Bug: Onboarding Gate + Baby Profile Cache

**Status:** Not started

## Issue 1 — Stale baby data shown on new account

When a new account is created, the frontend displays cached baby profile data from a previous session (localStorage) before the API call completes. This results in an "couldn't find the baby" API error as the new account has no baby profile yet.

**Root cause:** Baby profile data (and possibly form state) is persisted to localStorage and not cleared on login/register.

**Fix:** Clear baby-related localStorage keys when a new session starts (on login and register success).

---

## Issue 2 — No onboarding gate — user can access app without a baby profile

New users land in the main app without a baby profile, causing API errors throughout. The app should detect that no baby profile exists and force the user through a "create your baby" flow before showing any tabs.

**Fix:** In `App.jsx` or `BabySteps.jsx`, after loading the session, check if a baby profile exists. If not, show a dedicated onboarding/create-baby screen instead of the main app.

---

## Notes
- These two bugs are related — fix the onboarding gate first, as it removes most of the surface area where stale cache causes problems
- The cache clear should still be done regardless, as it's a correctness issue
