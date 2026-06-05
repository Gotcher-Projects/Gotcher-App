# CradleHQ — App Context Primer

> **Purpose:** A single, accurate, project-wide briefing on how CradleHQ is built —
> stack, architecture, auth, data model, and where everything lives. Paste this into a
> new AI session before doing non-trivial work so the assistant has correct context
> without re-deriving it. Last mapped: 2026-05-31.
>
> **Companion docs:** `TECH_STACK.html` (human-readable handoff of the same material);
> `plans/storybook/storybook-context.md` (deep primer for the Storybook feature — read
> that one before any storybook work, it is the most complex subsystem).

---

## 0. Things that surprise people

1. **"Baby Steps" was renamed to "CradleHQ".** The main component is `CradleHq.jsx` (not
   `BabySteps.jsx` — that older file/name is historical). Production domain is
   `cradlehq.app`. Package/appId is still `com.gotcherapp.*` and DB is still `gotcherapp`.
2. **Auth is dual-mode.** Web uses **httpOnly cookies**; the Capacitor mobile app uses
   **Bearer tokens in localStorage**. The same backend serves both. Frontend branches on
   `Capacitor.isNativePlatform()`. This is the single biggest "gotcha" in the codebase.
3. **There is no ORM.** Backend is Spring Boot but uses raw **JdbcTemplate** SQL everywhere.
   No JPA/Hibernate. DTOs are Java `record`s. Schema is managed by **Flyway** (`V1`–`V33`).
4. **There are two separate "theme" systems.** The app-wide UI theme (`ThemeContext`,
   `base`/`dark`, `data-theme` attribute) is unrelated to **book themes**
   (`bookThemes.js`, `classic`/`coral`/`midnight`/`meadow`) used only inside the Storybook.
5. **The frontend is also a mobile app.** Capacitor 8 wraps the Vite `dist/` build as a
   native Android app (`webDir: dist`, `appId: com.gotcherapp.cradlehq`). Same React code.
6. **AI is a direct REST call, not an SDK.** `ClaudeClient.java` POSTs to the Anthropic
   Messages API via `RestTemplate`. Model is configurable (`anthropic.model`, currently
   `claude-haiku-4-5-20251001`).

---

## 1. Three-tier architecture

```
Browser (port 3000 dev)         Spring Boot API (port 3001)        PostgreSQL 16 (5432)
React 18 + Vite 6        ──►     Spring Security (stateless)  ──►   Docker container
Tailwind + shadcn/ui            JdbcTemplate (raw SQL)             Flyway migrations
                                JJWT, Cloudinary, Claude
       │                                                                  ▲
       │ Capacitor 8 wraps the same build into a native Android app       │
       └──────────────────────────────────────────────────────────────────┘
```

- **Web (dev):** Vite dev server :3000 → API :3001 → Postgres :5432 (Docker).
- **Web (prod):** Hetzner VPS, Docker Compose: **Caddy** (TLS + static files + reverse
  proxy) + **api** (Spring Boot) + **postgres**. `Caddyfile` strips `/api/*` → `api:3001`,
  everything else serves the SPA (`try_files {path} /index.html`).
- **Mobile:** Capacitor Android app loads the built SPA; talks to the same hosted API over
  HTTPS with `capacitor://localhost` as an allowed CORS origin.

---

## 2. Backend (`Backend/`)

**Spring Boot 3.4.1 · Java 21 · Gradle (Kotlin DSL, `build.gradle.kts`).** Run with
`./gradlew bootRun`. Entry point: `GotcherAppApplication.java`. Port from `${PORT:3001}`.

### Dependencies (`build.gradle.kts`)
| Dependency | Purpose |
|---|---|
| `spring-boot-starter-web` | REST controllers, embedded Tomcat |
| `spring-boot-starter-security` | Auth filter chain (stateless JWT) |
| `spring-boot-starter-jdbc` | `JdbcTemplate` — raw SQL, no ORM |
| `postgresql` | JDBC driver |
| `flyway-core` + `flyway-database-postgresql` | Schema migrations |
| `jjwt-api/impl/jackson` 0.12.6 | JWT generate/verify |
| `spring-boot-starter-actuator` | `/health` for proxy/container checks |
| `spring-boot-starter-mail` | Transactional email (verification, password reset) |
| `cloudinary-http45` 1.39.0 | Image upload + CDN |
| `spring-boot-starter-test` | JUnit 5 + Mockito |

### Package layout (`com.gotcherapp.api`)
Each feature is a package with the **Controller → Service → DTO/record** pattern, raw SQL
in the service, ownership scoped by `baby_profile_id` on every query.

| Package | Responsibility |
|---|---|
| `auth` | Register/login/refresh/logout, `/auth/me`, email verification, password reset, `CookieUtil`, `EmailService`, `UserDto` |
| `security` | `JwtUtil` (sign/parse), `JwtAuthFilter` (token resolution), `AuthPrincipal` (record in SecurityContext) |
| `config` | `SecurityConfig` (filter chain + CORS), `AppConfig` (`RestTemplate` bean), `CloudinaryConfig` |
| `baby` | `BabyProfileService/Controller`, `MilestoneService`, `VaccineService`, `KeyedRecordService` (shared base for keyed records), `BabyProfileRepository` |
| `journal` | Journal entries (week, title, story, image) |
| `growth` | Growth records (weight/height/head, imperial units) |
| `feeding` | Feeding sessions (start/stop timer) |
| `sleep` | Sleep logs |
| `diaper` | Diaper logs (pee/poop category; was `poop`, renamed V19) |
| `firsttimes` | "First Times" milestone-style events |
| `appointments` | Medical appointments (date + time) |
| `storybook` | AI memory-book feature — see `storybook-context.md` |
| `upload` | `ImageUploadService` (Cloudinary), `UploadController` (multipart) |
| `admin` | `AdminController` — account deletion (gated by `ADMIN_SECRET`), `DeletionReport` |
| `common` | `ApiError` shared error shape |

### Config (`application.properties`)
All values are env-var bindings with local defaults. Key ones:
- DB: `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`
- JWT: `JWT_SECRET`, access 15 min (`900000`), refresh 7 days (`604800000`)
- CORS: `CORS_ORIGINS` (includes `capacitor://localhost` for mobile)
- Cookies: `SECURE_COOKIES` (true in prod)
- Cloudinary: `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`
- Mail: `SMTP_*` (blank = email silently disabled)
- Anthropic: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_TEMPERATURE`
- Admin: `ADMIN_SECRET`

---

## 3. Auth (the dual-mode model — read carefully)

**Tokens:** JWT access (15 min) + refresh (7 days, stored in `refresh_tokens` table,
rotated on each refresh; `jti` UUID claim prevents concurrent-refresh dup-key crashes).
Passwords hashed with **BCrypt(strength 12)**.

**Web (browser):**
- Login/refresh set **httpOnly cookies** via `CookieUtil`: `access_token` (path `/`),
  `refresh_token` (path `/auth`), `SameSite=Lax`, `secure` in prod.
- Frontend sends `credentials: 'include'`; never sees the tokens (XSS-safe).

**Native (Capacitor):**
- Login/refresh return tokens in the **JSON body**; stored in `localStorage`
  (`cradlehq_access_token`, `cradlehq_refresh_token`).
- Frontend sends `Authorization: Bearer <token>` and `credentials: 'omit'`.

**Server resolves either** — `JwtAuthFilter.resolveToken()` checks the `Authorization`
header first, then the `access_token` cookie.

**Frontend plumbing:**
- `lib/auth.js` — `loginUser/registerUser/logoutUser/validateSession`, branches on
  `isNative`. Stores the **user object** (not tokens) in `localStorage` key `gotcherapp_user`.
- `lib/api.js` — `apiRequest()` / `apiUpload()`. On `401`: calls `doRefresh()` (deduplicated
  via a module-level `refreshing` promise), retries once; on refresh failure fires a
  `session-expired` window event. `App.jsx` listens and boots the user to login.

**Gotcha (project-wide):** an uncaught `RuntimeException` in a controller re-dispatches to
`/error` **unauthenticated → surfaces as 401, not 500**. Wrap external-service calls
(Cloudinary, Claude) in try/catch and return a mapped `ApiError`. (See memory:
`Spring Security / Error Dispatch Pattern`.)

`SecurityConfig` permitAll routes: `/health`, `/auth/{register,login,refresh,logout,
verify-email,forgot-password,reset-password}`, `/admin/**`, `/book/public/**`. Everything
else requires auth.

---

## 4. Database (PostgreSQL 16, Flyway migrations `Backend/db/migration/`)

**Never edit an applied migration** (Flyway checksums them). Always add a new `V##__*.sql`.
`out-of-order=true` and `baseline-on-migrate=true` are set (V7 was a retroactive placeholder).

| Range | Tables / changes |
|---|---|
| V1–V4 | `users`, `refresh_tokens`, `baby_profiles` (one per user), `milestones` |
| V5–V8 | `email_verification_tokens`, `journal_entries` (+image), V7 placeholder |
| V9–V11 | `growth_records` (+imperial units) |
| V12–V16 | `sleep_logs`, `poop_logs`, `vaccine_records`, `appointments`, `first_times` |
| V17–V18 | baby `sex`, image orientation |
| V19–V20 | `poop_logs`→`diaper_logs` (+`category`), type nullable (pee fix) |
| V21–V22 | appointment time, `password_reset_tokens` |
| V23 | `users.tier` (`free`/`plus`/`pro`) + `ai_credits_remaining` + `credits_reset_at` |
| V24–V33 | **Storybook** — chapters, share tokens, images, wizard cols, layout_data, chapter_photos, book_theme, book_cover (see storybook-context.md) |

Latest migration: **V33**. Next: **V34**.

Local dev DB: `localhost:5432`, db `gotcherapp`, user `gotcherapp_app` / `changeme_local`.
`Backend/docker-compose.yml` runs postgres:16 + pgAdmin (:5050). `db/init/01-setup.sql`
creates the app user/DB on first boot.

---

## 5. Frontend (`Frontend/`)

**Vite 6 + React 18 (JSX, no TypeScript).** ESM project (`"type": "module"`). `@/` aliases
`src/`. Run `npm run dev` (:3000). Build → `dist/`.

### Key dependencies (`package.json`)
| Library | Used for | Where |
|---|---|---|
| `react` / `react-dom` 18 | UI | everywhere |
| `tailwindcss` v3 + `clsx` + `tailwind-merge` + `class-variance-authority` | styling; `cn()` helper | `lib/utils.js`, all `.jsx` |
| Radix UI (`@radix-ui/react-*`) | accessible primitives under shadcn/ui | `components/ui/` |
| `lucide-react` | icons | everywhere |
| `recharts` 3 | growth charts | `tabs/GrowthTab.jsx` |
| `@capacitor/core,android,cli,camera` 8 | native Android shell + camera | `lib/camera.js`, `lib/auth.js`, `lib/api.js` |
| `@tiptap/*` 3 | rich-text editing in the storybook layout editor | `lib/tiptap.js`, `storybook/LayoutEditor.jsx`, `LayoutRenderer.jsx` |
| `react-rnd` | drag/resize blocks on the layout canvas | `storybook/LayoutEditor.jsx` |
| `@dnd-kit/*` | drag-to-reorder chapters | `tabs/StorybookTab.jsx` |
| `react-image-crop` | photo crop modal | `lib/imageUtils.jsx` |
| `jspdf` + `html2canvas` | client-side PDF export of the book | `lib/storybookPdf.js`, `lib/pdf.js` |

### Dev tooling
- **Vitest** + `@testing-library/react` + `jsdom` — frontend unit tests in `src/test/`.
  Config lives in `vite.config.js` (`test` block). Run `npm test`.

### App shell & structure
- `main.jsx` → `App.jsx` (auth gate: `LoginPage` vs `CradleHq`, wrapped in `ThemeProvider`).
- `components/CradleHq.jsx` — main shell. Owns all top-level data state (profile, milestones,
  journal, growth, feeding, sleep, diaper, vaccines, appointments, firsts, chapters, book
  theme/cover). 5 top-level tabs via shadcn `Tabs`:
  - **dashboard** → `tabs/DashboardTab.jsx`
  - **memories** → `tabs/MemoriesTab.jsx` (Journal + First Times + **Book/Storybook**)
  - **track** → `tabs/TrackTab.jsx` (Feeding + Sleep + Diaper)
  - **health** → `tabs/HealthTab.jsx` (Growth + Vaccines + Appointments + Milestones)
  - **discover** → `tabs/DiscoverTab.jsx` (Marketplace + Playdates + Activities)
- Grouped tabs use `components/ui/PillNav.jsx` for sub-navigation.
- `components/ui/` — manually-scaffolded shadcn components (button, card, input, label,
  textarea, tabs, dialog, select, badge, separator, switch, checkbox) + custom
  `PaidGate.jsx`, `EmptyState.jsx`, `LoadingButton.jsx`.

### lib/
| File | Role |
|---|---|
| `api.js` | authenticated fetch (`apiRequest`/`apiUpload`), 401-refresh, native/web branch |
| `auth.js` | login/register/logout/validateSession, token storage |
| `utils.js` | `cn()` Tailwind class merge |
| `babyAge.js` | `getWeek`, `getMonths`, `getActivities` |
| `babyData.js` | `MILESTONES` static data |
| `camera.js` | Capacitor camera wrapper |
| `imageUtils.jsx` | crop modal (`react-image-crop`), `openCropModal`, `pickPhoto` |
| `growthPercentiles.js`, `dashboardStats.js`, `formatting.js`, `share.js` | domain helpers |
| `tiptap.js`, `fitText.js`, `bookThemes.js`, `stickers.js`, `storybookPeriods.js`, `storybookPdf.js` | **Storybook** helpers (see storybook-context.md) |

### Theming (two systems — do not conflate)
- **App UI theme:** `contexts/ThemeContext.jsx` + `themes/index.js` (`base`, `dark`).
  Sets `data-theme` on `<html>`, persists to `localStorage` key `cradlehq-theme`. Tokens
  live in `index.css` `@layer base` (NOT via `@import` — Tailwind ordering, see memory
  `feedback_css_import_tailwind`).
- **Book theme:** `lib/bookThemes.js` (`classic`/`coral`/`midnight`/`meadow`), stored on
  `baby_profiles.book_theme`, applies only inside the rendered storybook.
- Fonts: Google Fonts in `index.html` (Inter, Poppins, Playfair Display, Merriweather,
  Lato, Nunito).

---

## 6. AI integration (Anthropic Claude)

- `storybook/ClaudeClient.java` — `@Component` wrapping `RestTemplate`. POSTs to
  `https://api.anthropic.com/v1/messages` with `x-api-key` + `anthropic-version: 2023-06-01`.
- Model/temperature from `application.properties`. Two system prompts:
  `BATCH_PAGES_SYSTEM_PROMPT` (one JSON page per memory) and `SYSTEM_PROMPT` (woven chapter
  with `[PHOTO:…]` markers).
- **Temporary `[CLAUDE-DEBUG]` logging** logs full prompts + responses (personal journal
  content) — slated for removal in S9 (`plans/storybook/s9-remove-claude-logging.md`).
- Generation is gated on `tier != 'free'` AND `ai_credits_remaining > 0`; a credit is
  decremented before the call and refunded if it throws.

---

## 7. Media uploads (Cloudinary)

- `upload/ImageUploadService.java` — `upload(file, folder, userId)` → Cloudinary, returns
  `secure_url`. Folders: `gotcherapp/{journal|misc|marketplace|babies|first-times}/{userId}`.
- `deleteAllForUser(userId)` — best-effort cleanup across all folders (used by account
  deletion). Multipart limit 10MB (`application.properties`).
- `CloudinaryConfig` builds the `Cloudinary` bean from env vars.

---

## 8. Deployment (production)

- **Host:** Hetzner VPS (`87.99.153.7`), user `deploy`, repo at `~/gotcherapp`.
- **Stack:** `docker-compose.prod.yml` — `caddy` + `api` + `postgres`.
- **Caddy** (`Caddyfile`): auto-TLS for `{$APP_DOMAIN}`, `/api/*` → `api:3001`
  (prefix stripped), SPA fallback for everything else; `www.` → apex redirect.
- **Frontend Dockerfile** builds the Vite app with `VITE_API_URL=https://${APP_DOMAIN}/api`
  and serves via Caddy. **Backend Dockerfile** builds the Spring Boot JAR.
- **Deploy:** `git pull origin main && docker compose -f docker-compose.prod.yml up -d --build`.
- Live at `https://cradlehq.app`. Full runbook: `deployment-guide.html` (root).
- Demo account: `demo@gotcherapp.com` / `DemoPass1` (baby Lily, seeded, upgraded to `plus`).

---

## 9. Conventions (from CLAUDE.md / project memory)

- **Discuss tradeoffs before coding.** Don't invent unrequested features — ask first.
- **Plans:** multi-session work uses `plans/<name>/sN` + `session-prompts.md`. Always check
  a plan's **Status** first (`Complete` → stop & ask; else confirm state before coding).
  Mark **Needs Verification** after implementing; **Complete** only after user confirms.
- **Commits:** never add `Co-Authored-By: Claude`.
- **Stack rules:** Frontend = Vite + React JSX (no TypeScript); Backend = Spring Boot + raw
  JdbcTemplate SQL (no ORM). When changing the Claude model/API, use the `/claude-api` skill.
- **Local dev:** `Backend/start-services.sh` (Docker + API + frontend). Port conflict with
  TavernTales (same 5432/5050/3000) — can't run both; `stop-services.sh` stops both.
```
