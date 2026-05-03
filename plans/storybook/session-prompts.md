# Storybook — Session Opening Prompts

Copy-paste the relevant block at the start of each session.

---

## Session 0 — Planning & Print-on-Demand Evaluation

```
Session 0 of storybook. No branch needed — planning only, no code.
Plan: plans/storybook/s0-planning.md

This is a decisions session, not an implementation session. Goals:
1. Decide whether S5 (Lulu print-on-demand) is in scope for the initial launch or deferred
2. Choose the pricing model for the digital storybook (one-time vs. subscription)
3. Confirm free-vs-paid gating behavior (full hide vs. teaser chapters)
4. If S5 is in scope: research Lulu API checkout flow + PDF spec requirements,
   create plans/storybook/s5-print.md as a stub

Read plans/storybook/s0-planning.md fully before starting. All open questions and
the Lulu API evaluation are there. Do not write any code this session.
```

---

## Session 1 — Paid User Flag

```
Session 1 of storybook. Branch: feature/storybook (create from main if it doesn't exist).
Plan: plans/storybook/s1-paid-flag.md

Full-stack. Latest migration is V22. Next is V23.

Backend — 1 migration + DTOs + AuthService:
1. Backend/db/migration/V23__add_is_paid_to_users.sql — ALTER TABLE users ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false
2. Backend/src/main/java/com/gotcherapp/api/auth/dto/MeResponse.java — add isPaid field
3. Backend/src/main/java/com/gotcherapp/api/auth/dto/LoginResponse.java — add isPaid field
4. Backend/src/main/java/com/gotcherapp/api/auth/dto/RegisterResponse.java — add isPaid field
5. Backend/src/main/java/com/gotcherapp/api/auth/AuthService.java — read is_paid from DB, populate all three DTOs

Frontend — 3 files:
6. Frontend/src/lib/auth.js — include is_paid in the stored session user object
7. Frontend/src/components/CradleHq.jsx — add isPaid to user state, pass where needed
8. Frontend/src/components/ui/PaidGate.jsx — new component: renders children if isPaid=true, renders upgrade prompt card if false

Read AuthService.java and all three DTO files before writing anything — the pattern is
already established, just add one field. All decisions in the plan file.
```

---

## Session 2 — Storybook Backend

```
Session 2 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s2-backend.md

Full-stack backend. S1 must be done (V23 migration must exist). Latest migration is V23.
Next migrations: V24 (storybook_chapters), V25 (book_share_tokens).

Backend — new package com.gotcherapp.api.storybook:
1. Backend/db/migration/V24__create_storybook_chapters.sql — schema in plan
2. Backend/db/migration/V25__create_book_share_tokens.sql — schema in plan
3. Backend/src/main/resources/application.properties — add anthropic.api.key binding
4. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookChapter.java — record
5. Backend/src/main/java/com/gotcherapp/api/storybook/dto/ChapterResponse.java
6. Backend/src/main/java/com/gotcherapp/api/storybook/dto/UpdateChapterRequest.java
7. Backend/src/main/java/com/gotcherapp/api/storybook/ClaudeClient.java — RestTemplate wrapper calling Anthropic HTTP API
8. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookService.java
9. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookController.java
10. Backend/src/main/java/com/gotcherapp/api/config/SecurityConfig.java — add /book/public/** to permitAll()

Use RestTemplate (not Anthropic Java SDK) for the Claude API call. Model: claude-haiku-4-5-20251001.
Endpoint list, DB schemas, prompt design, and paid check logic are all in the plan file.

Read AppointmentService.java and AppointmentController.java first — same JdbcTemplate +
ownership check pattern. Also read SecurityConfig.java before adding the permitAll rule.
```

---

## Session 3 — In-App Storybook View

```
Session 3 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s3-in-app-view.md

Frontend only. S2 must be done (backend endpoints must be live and tested).

Files:
1. Frontend/src/components/tabs/MemoriesTab.jsx — add 'Book' option to PillNav; render StorybookTab
2. Frontend/src/components/tabs/StorybookTab.jsx — new file, full storybook view
3. Frontend/src/components/CradleHq.jsx — add chapters state + fetch, wire unlock calls into
   milestone toggle and first-times save handlers

Read MemoriesTab.jsx, CradleHq.jsx, and PaidGate.jsx before writing anything.
The four chapter states (unlocked / generating / draft / published) and their UI are
all specified in the plan file. Typography decisions for published chapters are there too.
```

---

## Session 4 — Shareable Book Link

```
Session 4 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s4-share-link.md

Frontend only. S3 must be done (storybook view must exist). Backend public endpoint
already built in S2.

Files:
1. Frontend/src/components/tabs/StorybookTab.jsx — add Share section at the bottom
2. Frontend/src/App.jsx — add /book/:token route outside the auth gate
3. Frontend/src/components/PublicBookPage.jsx — new file, read-only public renderer

Read App.jsx first to understand the current routing structure and auth gate placement.
Read share.js to reuse the clipboard fallback pattern.
Check deployment-guide.html to confirm Caddy catch-all is configured for SPA routing.
All layout, privacy, and routing decisions are in the plan file.
```
