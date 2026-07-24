# CradleHQ — Claude Instructions

CradleHQ (formerly "Baby Steps") is a baby-tracking app: milestones, a journal with
AI-generated memory books ("Storybook"), pregnancy "bump-to-baby" tracking, feeding/sleep/diaper
logs, growth percentiles, first-times, and appointments. Live at https://cradlehq.app.

## Stack

- **Frontend** (`Frontend/`) — Vite + React (JSX, **no TypeScript**), Tailwind v3 + shadcn/ui
  tokens, lucide-react icons, `@dnd-kit` for the book builder, Tiptap for rich text. Port 3000.
- **Backend** (`Backend/`) — Spring Boot 3.4 (Java 21), Spring Security 6 (stateless JWT),
  **raw `JdbcTemplate` SQL — no ORM**, Flyway migrations (`Backend/db/migration/V*.sql`), JJWT.
  Port 3001.
- **Database** — PostgreSQL 16 via Docker Compose (`Backend/docker-compose.yml`), port 5432.
- **PDF sidecar** — headless-Chrome PDF renderer for the print feature (dev: port 4000; prod: `pdf-sidecar`
  Compose service). The API POSTs a print-route URL, Chrome renders it, the sidecar returns PDF bytes. Only
  needed for print (Lulu) work — see `plans/storybook-v2/payments-print-context.md`.

## How to run

- **Everything** (Docker + API + frontend): `./start-services.sh` **from the repo root** (both
  `start-services.sh` and `stop-services.sh` live at the root — NOT in `Backend/`). Stop: `./stop-services.sh`.
  If the API port sticks after stop, kill the stale process: `netstat -ano | findstr :3001` → `taskkill /PID <pid> /F`.
- **Frontend only:** `cd Frontend && npm run dev`.
- **Frontend tests:** `cd Frontend && npm run test` (Vitest). **Backend tests:**
  `cd Backend && ./gradlew test` (JUnit 5 + Mockito).
- **Deploy** (Hetzner VPS): `git pull origin main && docker compose -f docker-compose.prod.yml up -d --build`.
  Demo account: `demo@gotcherapp.com` / `DemoPass1`.

## Gotchas

- **Spring 401 trap:** an uncaught `RuntimeException` in a controller re-dispatches to `/error`
  unauthenticated → surfaces as **401, not 500**. Catch `Exception` (not just `IOException`) in
  controllers calling external services (Cloudinary, Claude) and return a mapped `ApiError`.
- **Shared port 5432:** the TavernTales project uses the same Postgres port. If its container is
  up, GotcherApp's Postgres starts without a port binding and DB connections silently hit the
  wrong container. Stop TavernTales first.
- **Dates:** all display dates go through `formatDate` / `formatMonthYear` in `lib/formatting.js`
  (noon-anchored, `en-US`). Never inline `new Date(...).toLocaleDateString`.

## Conventions

- **Discuss options & tradeoffs before writing code**; never add unrequested features/design
  choices — ask first if an idea seems nice.
- **Multi-session work** lives in `plans/<name>/sN-*.md` (+ `session-prompts.md`). Always check a
  plan's **Status** before doing anything (see below).
- After implementing a plan, mark it **Needs Verification**; only **Complete** once the user
  confirms it works.
- **Never** add `Co-Authored-By: Claude` to commits.
- When updating the Claude model/API, use the `/claude-api` skill.

## Pointers

- **Storybook primer:** `plans/storybook/storybook-context.md` — read before any memory-book work.
- **Payments & Print primer:** `plans/storybook-v2/payments-print-context.md` — read before any Stripe (billing)
  or Lulu (physical book / PDF sidecar) work.
- **Pregnancy feature:** `plans/pregnancy/` (+ `pregnancy-context.md` primer).
- **Payments track:** `plans/storybook-v2/` P-series (`p12-live-cutover.md` = Stripe live).
- **Print (Lulu) track:** `plans/storybook-v2/print/` (pr0–pr10 + s14; `pr10-live-cutover.md` = go-live gate).
- **Branch review + fixes:** `plans/storybook-v2-review/` (5-pass review, findings F1–F15) →
  `plans/storybook-v2-review-fixes/` (the sliced fixes).
- **Active review-fixes track:** `plans/storybook-and-pregnancy-review-fixes/`.

## Plans

When working from a plan file in `plans/`, check the **Status** field at the top before doing anything.

- If `Status: Complete` — stop immediately. Tell the user this plan is already done and ask what they want to work on instead. Do not implement anything from it. Completed plans will eventually be moved to `plans/completed/` — this is not yet implemented.
- If `Status: In Progress` — pick up where it left off; confirm current state with the user before writing code.
- If `Status: Not started` — proceed normally.
