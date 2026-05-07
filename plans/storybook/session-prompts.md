# Storybook — Session Opening Prompts

Copy-paste the relevant block at the start of each session.

---

## Session 0 — Planning & Decisions
**Status: Complete** — decisions recorded in plans/storybook/s0-planning.md

---

## Session 1 — Paid User Flag (tier system)

```
Session 1 of storybook. Branch: feature/storybook (create from main if it doesn't exist).
Plan: plans/storybook/s1-paid-flag.md

Full-stack. Latest migration is V22. Next is V23.

Key S0 decisions driving this session:
- Use tier VARCHAR(20) ('free'/'plus'/'pro'), NOT is_paid BOOLEAN
- Also add ai_credits_remaining INT and credits_reset_at TIMESTAMPTZ in the same migration
- Teaser gating: free users see the Book tab and chapter titles, just can't generate
- Actual DTO structure: UserDto.java (not MeResponse/LoginResponse/RegisterResponse — those don't exist)
- /auth/me currently returns a bare Map — update it to return a full UserDto with tier

Backend — 1 migration + UserDto + AuthService + AuthController:
1. Backend/db/migration/V23__add_tier_to_users.sql
   — ALTER TABLE users ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'free'
   — ALTER TABLE users ADD COLUMN ai_credits_remaining INT NOT NULL DEFAULT 0
   — ALTER TABLE users ADD COLUMN credits_reset_at TIMESTAMPTZ
2. Backend/src/main/java/com/gotcherapp/api/auth/dto/UserDto.java — add tier field with @JsonProperty("tier")
3. Backend/src/main/java/com/gotcherapp/api/auth/AuthService.java
   — login(): add tier to SELECT, pass to UserDto
   — register(): pass "free" directly to UserDto (no re-query needed)
   — refresh(): add tier to user SELECT, pass to UserDto
4. Backend/src/main/java/com/gotcherapp/api/auth/AuthController.java
   — /auth/me: query users table by principal userId, return full UserDto with tier

Frontend — 3 files:
5. Frontend/src/lib/auth.js — include tier in stored session user object
6. Frontend/src/components/CradleHq.jsx — use tier (not isPaid); pass where needed
7. Frontend/src/components/ui/PaidGate.jsx — new component; takes tier prop; teaser/upgrade prompt for free users

Read AuthService.java, UserDto.java, and AuthController.java before writing anything.
All decisions are in the plan file.
```

---

## Session 2 — Storybook Backend

```
Session 2 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s2-backend.md
Design reference: plans/storybook/design-decisions.md — READ THIS FIRST for full context.

Full-stack backend. S1 must be done (V23 migration must exist with tier + credits columns).
Latest migration is V23. Next migrations: V24 (storybook_chapters), V25 (book_share_tokens).

Key S0 decisions:
- Generation gated by tier (must be plus or pro) AND credits (ai_credits_remaining > 0)
- Per-chapter credit cost — each generate call costs 1 credit, decrement before calling Claude
- Refund credit if Claude call fails
- Free users CAN have unlocked chapter rows — they just can't generate them
- Partial regeneration fully supported — individual chapters only

Key S2 planning decisions (2026-05-03):
- Two chapter types: 'milestone'|'first_time' (event-anchored) AND 'period' (time-period)
- V24 adds period_start_weeks, period_end_weeks, sort_order columns (see schema in plan)
- Both ANTHROPIC_API_KEY and ANTHROPIC_MODEL are env-var configurable (never hardcode the key)
- Share tokens: SecureRandom hex 64 chars (not UUID)
- Claude prompt is text-only — no image URLs passed to the API

Backend — new package com.gotcherapp.api.storybook:
1. Backend/db/migration/V24__create_storybook_chapters.sql — schema in plan
2. Backend/db/migration/V25__create_book_share_tokens.sql — schema in plan
3. Backend/src/main/resources/application.properties — add anthropic.api.key + anthropic.model
4. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookChapter.java — record
5. Backend/src/main/java/com/gotcherapp/api/storybook/dto/ChapterResponse.java
6. Backend/src/main/java/com/gotcherapp/api/storybook/dto/UpdateChapterRequest.java
7. Backend/src/main/java/com/gotcherapp/api/storybook/dto/UnlockRequest.java
8. Backend/src/main/java/com/gotcherapp/api/storybook/ClaudeClient.java — RestTemplate wrapper
9. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookService.java
10. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookController.java
11. Backend/src/main/java/com/gotcherapp/api/config/SecurityConfig.java — add /book/public/** to permitAll()

Use RestTemplate (not Anthropic Java SDK). Model configurable via anthropic.model property.
All schemas, endpoint specs, credit logic, and prompt design are in the plan file.

Read AppointmentService.java and AppointmentController.java first — same JdbcTemplate +
ownership check pattern. Also read SecurityConfig.java before adding the permitAll rule.
```

---

## Session 2.1 — Storybook Backend Verification

```
Session 2.1 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s2.1-verification.md

Verification only — no new code. S2 must be complete (all backend files written).

Steps:
1. Start Docker Desktop + services
2. Run seed-demo-user.sh (now upgrades demo user to plus + 20 credits via psql at the end)
3. Follow the curl verification steps in the plan file
4. Tick off each item in the checklist
5. If anything fails, fix it before marking S2 Complete

When all checklist items pass: update s2-backend.md Status to Complete, then report back.
```

---

## Session 3.5 — AI Prompt & Algorithm Tuning

```
Session 3.5 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s3.5-prompt-tuning.md

Backend only — no schema changes. Tuning the Claude prompt and generation pipeline.
S2 must be complete and verified.

Key issue: Claude makes assumptions about family structure (two parents, "your dad")
and invents emotional reactions not grounded in the journal data. Goal is tighter,
more factual output that works for any family structure.

Files to change:
- Backend/src/main/java/com/gotcherapp/api/storybook/StorybookService.java — buildPrompt()
- Backend/src/main/java/com/gotcherapp/api/storybook/ClaudeClient.java — add temperature
- Backend/src/main/resources/application.properties — add anthropic.temperature binding

Read the current buildPrompt() and SYSTEM_PROMPT in ClaudeClient before making changes.
Try variants systematically — keep old prompt commented out during experimentation.
```

---

## Session 3 — In-App Storybook View

```
Session 3 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s3-in-app-view.md

Frontend only. S2 must be done (backend endpoints must be live and tested).

Key S0 decisions:
- Teaser gating: Book tab always visible; free users see chapter titles with locked Generate
- No full-tab PaidGate wrapper — show upgrade prompt inline per chapter card
- Free users also get unlock rows (chapter titles appear for them too)
- Paid users with 0 credits see disabled Generate with credit message

Files:
1. Frontend/src/components/tabs/MemoriesTab.jsx — add 'Book' option to PillNav; render StorybookTab
2. Frontend/src/components/tabs/StorybookTab.jsx — new file, full storybook view with teaser logic
3. Frontend/src/components/CradleHq.jsx — add chapters state + fetch, wire unlock calls into
   milestone toggle and first-times save handlers

Read MemoriesTab.jsx, CradleHq.jsx, and PaidGate.jsx before writing anything.
The four chapter states (unlocked/generating/draft/published) and teaser gating behavior
are all specified in the plan file.
```

---

## Session 4 — Shareable Book Link

```
Session 4 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s4-share-link.md

Frontend only. S3 must be done (storybook view must exist). Backend public endpoint
already built in S2.

Key S0 decisions:
- Share section visible to plus and pro users only (check tier !== 'free')
- Free users do not see the share section

Files:
1. Frontend/src/components/tabs/StorybookTab.jsx — add Share section at the bottom
2. Frontend/src/App.jsx — add /book/:token route outside the auth gate
3. Frontend/src/components/PublicBookPage.jsx — new file, read-only public renderer

Read App.jsx first to understand the current routing structure and auth gate placement.
Read share.js to reuse the clipboard fallback pattern.
Check deployment-guide.html to confirm Caddy catch-all is configured for SPA routing.
All layout, privacy, and routing decisions are in the plan file.
```
