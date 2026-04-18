# Baby Steps — Planning Notes

Use this file to plan and refine the app with Claude. Open questions and decisions to make are marked with `[ ]`.

---

## What We Have (Current)

Spring Boot backend + Vite/React frontend, PostgreSQL, JWT auth via httpOnly cookies.

| Tab | Status | Notes |
|-----|--------|-------|
| Dashboard | Done | Profile persisted to DB, milestones progress bar |
| Milestones | Done | Per-baby DB persistence, all age groups shown |
| Journal | In progress | Entries in DB, delete with inline confirm, image upload working — summary needs rework |
| Marketplace | localStorage only | Needs DB + image storage — deferred |
| Playdates | Demo | Static profiles — deferred, needs design decisions |
| Activities | Done | Age-appropriate activities + product recs |

Auth: register/login/logout/refresh, httpOnly cookies, email verification (SMTP optional).

---

## Next Session Priority Queue

Work items in the order they should be tackled:

| Priority | Work Item | Notes |
|----------|-----------|-------|
| 1 | Journal design spiff | Cards are functional but visually plain — polish typography, spacing, card layout |
| 2 | Baby age display | Easy win — show "Lily is 4 months and 12 days old" in dashboard header (more precise than current display) |
| 3 | Growth tracking | Weight / height / head circumference charted over time — new section or tab |

---

## Feature Backlog

Features agreed on but not yet scheduled. Add to queue above when ready to build.

### Tier 1 — Next after Growth Tracking
- **Feeding / Sleep Tracker** — timed logs per session (start/stop or manual entry). High daily engagement. Fits existing tab pattern — new DB table, new tab.
- **Vaccine Tracker** — CDC schedule mapped to age ranges, checkable like milestones. `vaccine_records` table, no external API needed.
- **Doctor Appointment Reminders** — dates + notes per appointment, upcoming reminders surfaced on dashboard. `appointments` table.

### Tier 2 — Medium Scope (design session required before building)
- **Multiple Baby Profiles** — one user → many babies. Requires schema change (`baby_profiles` loses one-per-user constraint, all tabs become profile-aware). Plan the data model before touching code.
- **Grandparent / Partner Sharing** — read-only invite link (token-based) to a baby's profile. Needs its own auth path separate from normal login.

### Tier 3 — Larger Features (strong monetization angle)
- **Photo Memory Wall** — grid/collage of all journal photos organized by month. Higher-engagement view than the journal list. Natural upsell: sell parents a printed photo book for grandparents (PDF export of the collage, or Printful/Lulu API integration). Pairs well with the existing PDF paywall seam in `Frontend/src/lib/pdf.js`.

---

## Big Decisions to Plan

### 1. App Direction
- [ ] Keep all 6 features, or pare down for launch?
- [ ] Priority order of features?
- [ ] Who is the primary user — parent, seller, or both?

### 2. Backend & Auth
- [x] Spring Boot 3 + PostgreSQL + custom JWT (httpOnly cookies)
- [x] Register / Login / Refresh / Logout / Email Verification

### 3. Image Storage
- [ ] Currently base64 in localStorage for marketplace — hits 5MB limit fast
- [ ] DECISION: Use Cloudinary (free tier: 25GB storage, 25GB bandwidth/month)
  - [ ] Sign up at cloudinary.com, get CLOUD_NAME, API_KEY, API_SECRET
  - [ ] Add `cloudinary` Java SDK to build.gradle.kts
  - [ ] Create `ImageUploadService.java` — accepts multipart file, returns secure_url
  - [ ] Add `POST /upload` endpoint (authenticated)
  - [ ] Frontend: replace base64 with URL returned from upload endpoint
  - [ ] Store image URLs (not base64) in marketplace_listings table

### 4. Marketplace
- [ ] Real listings (multi-user) vs. just your own listings
- [ ] Payment processing? (Stripe) or direct contact only for now?
- [ ] Shipping or local pickup only?
- [ ] Search, filters, categories?
- [ ] Buyer/seller messaging?

### 5. Playdates
- [ ] Real matching algorithm — what criteria? (location, age, values, interests)
- [ ] In-app messaging or just phone number share?
- [ ] Request/accept flow?

### 6. AI Book Feature
- [x] DECISION: Remove the AI book / Anthropic integration entirely
- [x] Replaced with plain journal-to-summary compiler (no external API)

### 8. Journal — Memory Book PDF (done, future improvements noted)
- [x] jsPDF browser-based export — cover page, per-entry cards, inline photos
- [x] Card layout mirrors UI: week + title + date → image → story (landscape); image left / text right (portrait)
- [x] Paywall seam in place — `generatePdf()` and `downloadPdf()` are separate exports
- [ ] **Tech debt — Backend RowMapper utility:** Multiple services (`JournalService`, `FeedingService`, `SleepService`, `PoopService`, `GrowthService`, `AppointmentService`, `FirstTimeService`) each have their own copy-pasted `mapRow()` lambda. Extract a shared `RowMappers` utility class with static factory methods per entity. Cosmetic only — no correctness impact.
- [ ] **Tech debt — PDF export system:** The current jsPDF approach works but has limits.
  Consider replacing with a server-side or headless-browser renderer (Puppeteer, Playwright,
  or a React-to-PDF service) when paying users are involved. Benefits: real CSS/font rendering,
  better image quality control, no canvas CORS workarounds. Not urgent — revisit when the
  paywall is ready to go live.

### 9. Journal — Future Entry Types (larger expansion)
- Current entry type: text + optional single photo
- [ ] "Photo entry" type — multi-photo, event-based (baby's first birthday, first outing, etc.)
  - Separate entry_type column or separate table (TBD at design time)
  - Would reuse the same Cloudinary upload infra already built
  - Not blocking any current work — design when ready to build

### 7. Deployment Plan

#### Decided Stack (2026-03-27)
Single VPS running Docker Compose — Caddy + Spring Boot API + PostgreSQL all in one.

| Layer | Service | Notes |
|-------|---------|-------|
| VPS | **Hetzner** | ~$4-5/mo (CX22: 2vCPU/4GB RAM). Cheaper than DO for same specs. |
| Web server | **Caddy** | Container in Docker Compose. Auto-HTTPS via Let's Encrypt. Serves frontend static files + reverse proxies /api to Spring Boot. |
| Backend API | **Spring Boot** | Container in Docker Compose |
| Database | **PostgreSQL** | Container in Docker Compose |
| Images | **Cloudinary** | Deferred — not needed for demo |
| Email | **Resend** | Deferred — not needed for demo |

#### 🚧 BLOCKER: Domain name required before deploying
Caddy needs a domain to provision HTTPS via Let's Encrypt. Without HTTPS, secure cookies won't work.
- Purchase a domain (~$10-15/year via Namecheap or Cloudflare)
- Point DNS A record to the Hetzner VPS IP
- Set domain in Caddyfile — Caddy handles the cert automatically

#### What's built / ready
- `Backend/Dockerfile` — multi-stage build, copies db/migration for Flyway
- `CookieUtil.java` — `SECURE_COOKIES=true` env var enables secure flag in prod
| Domain | **Namecheap / Cloudflare** | Optional, point to Vercel + Railway |

#### Demo Deployment Shortcut (Live Link in ~2–4 Hours)

For a live demo that showcases auth, milestones, journal, and activities — you can skip Cloudinary and Resend entirely. Marketplace images stay broken but the tab still renders. Email verification silently skips (existing local behavior). Custom domain is optional.

**One required code change before deploying:** Uncomment `c.setSecure(true)` in `CookieUtil.java` — cookies won't work over HTTPS without this. It's a one-liner but it's a hard blocker.

| Step | Estimated Time | Notes |
|------|----------------|-------|
| Sign up Railway, create Postgres plugin, note `DATABASE_URL` | 10 min | Straightforward UI |
| Update `application.properties` to accept Railway's `DATABASE_URL` env var | 15 min | One binding change |
| Run Flyway migrations against prod DB | 5 min | `./run-migrations.sh` against Railway URL |
| Get backend deploying on Railway (Gradle buildpack) | 30–60 min | Buildpack usually works; Dockerfile is more reliable if it doesn't |
| Set env vars in Railway dashboard (`JWT_SECRET`, `FRONTEND_URL`, etc.) | 10 min | |
| Sign up Vercel, connect repo, set `VITE_API_URL` | 10 min | Vercel auto-detects Vite |
| Debug CORS issues (near-certain on first deploy) | 20–40 min | `FRONTEND_URL` must match Vercel URL exactly |
| Smoke test — login, journal, milestones | 15 min | |
| **Total** | **~2–4 hours** | Budget 4 if Railway Gradle buildpack needs coaxing |

**What to defer for a demo:**
- Cloudinary (marketplace images broken, tab still renders)
- Resend / email verification (silently skips — existing behavior)
- Custom domain (Railway/Vercel URLs are fine for a demo)

---

#### Step-by-Step Deployment Order

**Step 1 — Image storage (Cloudinary) — do before deploying**
- Complete Cloudinary integration (see Section 3 above)
- All marketplace images must be URLs, not base64, before going live

**Step 2 — Email (Resend)**
- Sign up at resend.com, verify a sending domain
- Set `SMTP_HOST=smtp.resend.com`, `SMTP_USERNAME=resend`, `SMTP_PASSWORD=<api-key>`
- Test email verification flow end-to-end locally first

**Step 3 — Deploy Database (Railway)**
- Create Railway project → Add PostgreSQL plugin
- Note the `DATABASE_URL` connection string Railway provides
- Update `application.properties` to accept `DATABASE_URL` env var (Railway format)
- Run Flyway migrations against the production DB before first API start

**Step 4 — Deploy Backend (Railway)**
- Connect GitHub repo → set root directory to `Backend/`
- Add a `Dockerfile` or use Railway's Gradle buildpack
- Set all env vars in Railway dashboard:
  - `JWT_SECRET` (generate a real 64-char random string)
  - `FRONTEND_URL` (your Vercel URL, e.g. `https://babysteps.vercel.app`)
  - `BACKEND_URL` (your Railway URL)
  - `SMTP_*` vars
  - `CLOUDINARY_*` vars (when ready)
  - `PGHOST`, `PGPORT`, etc. (or `DATABASE_URL` — update properties accordingly)
- Verify `GET https://<railway-url>/health` returns 200

**Step 5 — Deploy Frontend (Vercel)**
- Connect GitHub repo → set root directory to `Frontend/`
- Set env var: `VITE_API_URL=https://<railway-url>`
- Vercel auto-detects Vite and builds correctly
- Verify login + all API calls work with the production backend

**Step 6 — Custom Domain (optional)**
- Add domain in Vercel dashboard for frontend
- Add domain in Railway dashboard for backend API
- Update `FRONTEND_URL` and `BACKEND_URL` env vars to use custom domains
- Enable `Secure` flag on cookies in `CookieUtil.java` (commented out, just uncomment)

#### Pre-deployment Checklist
- [ ] Change `JWT_SECRET` to a real random secret (min 64 chars)
- [ ] Uncomment `c.setSecure(true)` in `CookieUtil.java` (requires HTTPS)
- [ ] Set `PGPASSWORD` to something other than `changeme_local`
- [ ] Verify `FRONTEND_URL` CORS setting matches production Vercel URL exactly
- [ ] Cloudinary image upload working locally before deploying marketplace
- [ ] Email verification tested end-to-end with Resend
- [ ] Run all Flyway migrations against production DB before first boot

---

## Tech Stack (Current)
**Frontend:** Vite + React (JSX), Tailwind CSS v3, shadcn/ui, lucide-react
**Backend:** Spring Boot 3.4.1 (Java 21), Spring Security 6, JdbcTemplate, Flyway
**Database:** PostgreSQL 16 (Docker locally)
**Auth:** Custom JWT — httpOnly cookies, 15min access token, 7d refresh token with rotation
**Email:** JavaMailSender — no-op if SMTP not configured

## Tech Stack (Production Target)
- **Frontend hosting:** Vercel
- **Backend hosting:** Railway
- **Database:** Railway PostgreSQL
- **Image storage:** Cloudinary (free tier)
- **Email:** Resend (SMTP relay)

---

## Color & Brand
- Primary: Fuchsia-600
- Secondary: Sky-600
- Accent: Emerald-600
- Background: rose/sky/emerald-50 gradient
- Tone: Warm, supportive, parent-friendly

---

## Notes from Planning Sessions

### 2026-03-04 — Repo Restructure (Frontend / Backend split)
- Moved all Vite+React frontend files into `Frontend/` subdirectory
- Created empty `Backend/` scaffold with `src/{routes,controllers,middleware,models,services,config}`
- Root `.gitignore` updated to cover both `Frontend/node_modules` and `Backend/node_modules`
- No backend code written yet — structure is a placeholder for future sessions
- To run dev server: `cd Frontend && npm run dev`
