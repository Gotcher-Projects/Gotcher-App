# Rebrand — Session Opening Prompts

Copy-paste the relevant block at the start of each session.
Claude reads the session file + only the specific files listed — no discovery phase.

---

## S1 — CradleHQ Rebrand

```
Session 1 of rebrand. Branch: rebrand/cradlehq (create from main if it doesn't exist).
Plan: plans/rebrand/s1-rebrand.md
Change map: plans/rebrand/change-map.txt

Read before writing anything:
- Frontend/index.html (title + meta tags)
- Frontend/src/components/LoginPage.jsx (find app name display + check for existing footer)
- Frontend/src/components/BabySteps.jsx (search for "Baby Steps" display text only — file is large)
- Backend/src/main/java/com/gotcherapp/api/auth/EmailVerificationService.java (email subject + body)

Brand:
- App name: CradleHQ
- Domain: cradlehq.app
- Privacy email: privacy@cradlehq.app (does not exist yet — use it anyway)

All decisions are in the plan. Do not rename any files or components. Do not add any new dependencies.
Create Frontend/public/privacy.html and Frontend/public/terms.html as standalone HTML — no React, no imports.
The one backend change is a text edit only — no new endpoints, no schema changes.
```

---

## S2 — Password Reset

Prerequisites (manual — must be done before this session):
- Resend (or equivalent SMTP provider) account set up, domain verified, credentials added to VPS .env
- API container restarted and smoke test confirmed (verification email actually arrives)
- See the Prerequisites section at the top of plans/rebrand/s2-password-reset.md for full steps

```
Session 2 of rebrand. Branch: rebrand/cradlehq (continue from S1).
Plan: plans/rebrand/s2-password-reset.md
Prerequisites confirmed: SMTP is live and verification email was received in smoke test.

Read before writing anything:
- Backend/src/main/java/com/gotcherapp/api/auth/EmailVerificationService.java (token pattern to mirror)
- Backend/src/main/java/com/gotcherapp/api/auth/AuthController.java (constructor injection pattern + existing endpoints)
- Backend/src/main/java/com/gotcherapp/api/config/SecurityConfig.java (existing permitAll list)
- Frontend/src/App.jsx (the useEffect that already handles ?email_verified= — extend it for ?reset_token=)
- Frontend/src/components/LoginPage.jsx (current view/tab structure — add forgot + reset views)

Next migration is V22. All decisions are in the plan.
Do not add React Router. The reset flow uses a query param (?reset_token=) exactly like email verification does.
```
