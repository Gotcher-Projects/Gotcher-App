# Baby Steps — Developer Rollout Plan

Assumes: you know your way around a backend. Skip the parts you already know.
Frontend is Vite + React (JSX), Tailwind, shadcn/ui. No TypeScript currently.

---

## Stack Decision Points

Make these calls before writing a line of backend code. Each section lays out your real options.

---

### 1. Backend Architecture

**Option A — BaaS (Supabase)**
Skip writing a backend entirely. Supabase gives you Postgres, auth, storage, and edge functions
under one free-tier account. You talk to it directly from the frontend via the JS SDK, with
Row Level Security handling data isolation. Fastest path to production.
- Best if: you want to move fast and don't need custom business logic on the server
- Tradeoff: less control, tied to their platform, RLS policies can get complex

**Option B — Node.js + Express/Fastify on a PaaS**
Build a conventional REST API, deploy it on Railway, Render, or Fly.io. You own the entire
stack. Standard CRUD endpoints, middleware, etc.
- Best if: you're most comfortable here, or you know this app will need complex server logic
- Tradeoff: more to build and maintain
- Fastify is worth considering over Express — faster, better TypeScript support, built-in schema validation

**Option C — Next.js (migrate frontend)**
Convert the Vite app to Next.js and use API Routes (or the newer App Router Route Handlers)
as the backend. One repo, one deployment, one `npm run dev`. Vercel is the natural host.
- Best if: you want a single deployable, or you anticipate needing SSR later
- Tradeoff: migrating from Vite to Next.js is a half-day of work; App Router has a learning curve

**Option D — Hono (modern lightweight alternative)**
Hono is a fast, tiny web framework with a great DX. Runs on Node, Bun, Cloudflare Workers,
Deno — same codebase. If you're curious about Cloudflare Workers for edge deployment this is
worth a look.
- Best if: you want to try something modern, or you want edge deployment
- Tradeoff: smaller ecosystem than Express, less StackOverflow answers

**My recommendation:** If you want the fastest path, go Option A (Supabase). If you want full
control and are comfortable with Express/Fastify, go Option B on Railway. Option C is good
if you're willing to do the Vite → Next.js migration and want one unified project.

---

### 2. Database

| Option | Notes | Free Tier |
|--------|-------|-----------|
| **Supabase Postgres** | Included with Supabase, great UI, easy RLS | 500MB, 2 projects |
| **Neon** | Serverless Postgres, branches like git, fast cold start | 0.5 GB |
| **Railway Postgres** | One-click add-on alongside your Railway app | $5/mo trial credit |
| **PlanetScale** | MySQL-compatible, branching workflow — went paid-only in 2024 | $39/mo min |
| **MongoDB Atlas** | Good if you prefer NoSQL and don't need relational joins | 512MB |
| **SQLite + Turso** | Edge-friendly, distributed SQLite, surprisingly capable | Generous free |

**Recommendation:** Postgres. The data model is relational (users → milestones, users → listings).
Supabase or Neon are both solid free options. Neon is worth considering if you're bringing
your own backend (Option B/C/D above) since it's just a Postgres connection string.

---

### 3. Auth

| Option | Notes | Free Tier |
|--------|-------|-----------|
| **Supabase Auth** | Built into Supabase, email/password + OAuth providers | Included |
| **Clerk** | Best DX in the space right now, prebuilt React components, handles sessions/JWTs | 10k MAU free |
| **Better Auth** | Open source, framework-agnostic, self-hosted or cloud | Free (OSS) |
| **Auth.js (NextAuth)** | Mature, well-documented, best with Next.js | Free (OSS) |
| **Firebase Auth** | Good OAuth support, generous free tier | Free |
| **Roll your own** | bcrypt + JWT + refresh tokens — totally fine for this scale | Free |

**Recommendation:** If using Supabase, use Supabase Auth — it's already there. If building a
custom backend, Clerk is the fastest path to a production-quality auth flow with the least code.
Rolling your own with JWT is completely reasonable for a project this size if you prefer control.

---

### 4. Image Storage

| Option | Notes | Free Tier |
|--------|-------|-----------|
| **Supabase Storage** | Included with Supabase, simple SDK | 1GB |
| **Cloudinary** | Best-in-class image transforms (resize, optimize on-the-fly) | 25 credits/mo |
| **AWS S3 + CloudFront** | Industry standard, most flexible, most setup | 5GB / 12mo trial |
| **Uploadthing** | Dead simple file uploads for Next.js/React, great DX | 2GB |
| **Bunny.net CDN Storage** | Very cheap ($0.01/GB), fast global CDN | Pay as you go |

**Recommendation:** Supabase Storage if you're in the Supabase ecosystem. Cloudinary if you
want automatic image optimization (resizing listing photos, etc.). Uploadthing if you go
the Next.js route and want to be done in an hour.

---

### 5. Deployment

| Option | Notes | Free Tier |
|--------|-------|-----------|
| **Vercel** | Best for Vite/Next.js frontend + serverless functions | Hobby tier free |
| **Netlify** | Similar to Vercel, solid alternative | Free tier |
| **Railway** | Great for full-stack: frontend + Node API + Postgres in one dashboard | $5/mo trial credit |
| **Render** | Heroku alternative, free tier spins down after inactivity | Free (with limits) |
| **Fly.io** | Run Docker containers at the edge, generous free tier | Free allowance |
| **Cloudflare Pages + Workers** | Extremely fast, generous free tier, good for edge | Very generous |
| **DigitalOcean App Platform** | Simple PaaS, $5/mo droplets, predictable pricing | $200 trial credit |

**Recommendation:** Vercel for the frontend (it's the fastest path for Vite/React). For the
backend server if you build one: Railway is the smoothest experience — you get the API server
and Postgres side-by-side in one project dashboard. Render is a close second.

---

## Database Schema

Standard Postgres. Adjust types to your ORM of choice.

```sql
-- Extends auth users table (or standalone if rolling your own auth)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_name   TEXT,
  birthdate   DATE,
  parent_name TEXT,
  email       TEXT,
  phone       TEXT,
  city        TEXT,
  values      TEXT,
  interests   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE milestones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone_key  TEXT NOT NULL,     -- e.g. "28-1" (week-index)
  achieved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, milestone_key)
);

CREATE TABLE journal_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week       INT,
  title      TEXT NOT NULL,
  story      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketplace_listings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(10, 2),
  photo_urls   TEXT[],              -- array of storage URLs
  city         TEXT,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'deleted')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playdate_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, target_id)
);
```

**Index recommendations:**
```sql
CREATE INDEX idx_milestones_user ON milestones(user_id);
CREATE INDEX idx_journal_user ON journal_entries(user_id);
CREATE INDEX idx_listings_status ON marketplace_listings(status);
CREATE INDEX idx_listings_city ON marketplace_listings(city);
CREATE INDEX idx_listings_user ON marketplace_listings(user_id);
```

---

## API Endpoints

If building Option B/D (custom backend). If using Supabase, these are handled by the SDK — skip this.

```
Auth
  POST   /api/auth/signup          body: { email, password }
  POST   /api/auth/login           body: { email, password }  → returns JWT
  POST   /api/auth/logout
  GET    /api/auth/me              → current user from JWT

Profile
  GET    /api/profile              → authenticated user's profile
  PUT    /api/profile              body: { baby_name, birthdate, parent_name, ... }

Milestones
  GET    /api/milestones           → all achieved milestones for user
  POST   /api/milestones           body: { milestone_key }
  DELETE /api/milestones/:key      → uncheck a milestone

Journal
  GET    /api/journal              → all entries, ordered by created_at desc
  POST   /api/journal              body: { title, story, week }
  DELETE /api/journal/:id

AI
  POST   /api/generate-book        body: { entries[], baby_name }  → proxies Anthropic API
                                   (API key never leaves the server)

Marketplace
  GET    /api/marketplace          ?city=&status=active&limit=&offset=
  GET    /api/marketplace/mine     → only the current user's listings
  POST   /api/marketplace          body: { title, description, price, city }
  PATCH  /api/marketplace/:id      body: { status: 'sold' }
  DELETE /api/marketplace/:id      → soft delete (sets status = 'deleted')
  POST   /api/marketplace/:id/photos  body: multipart/form-data → uploads to storage, returns URLs

Playdates
  GET    /api/playdates            ?city= → profiles browseable by others
  POST   /api/playdates/request    body: { target_id, message }
  PATCH  /api/playdates/request/:id body: { status: 'accepted' | 'declined' }
  GET    /api/playdates/requests   → incoming requests for current user
```

---

## The AI Proxy (Priority Fix)

The current code calls Anthropic directly from the browser. This must move server-side before
any public deployment. The fix is the same regardless of which backend option you pick.

**If using Vercel serverless functions** (`api/generate-book.js`):
```js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { entries, babyName } = req.body;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: buildPrompt(entries, babyName) }]
    })
  });

  const data = await response.json();
  res.json({ text: data.content?.[0]?.text });
}
```

**If using Express/Fastify**, it's the same fetch call inside a POST route handler.

Then update `JournalTab` in `BabySteps.jsx` to call `/api/generate-book` instead of
hitting Anthropic directly.

---

## Phased Rollout

### Phase 1 — Deploy the demo (Day 1)
- Push to GitHub
- Connect to Vercel (or Netlify/Cloudflare Pages)
- Deploy — app is live, localStorage-backed, no auth
- Get a shareable URL for early feedback
- **Do not share publicly until Phase 2 is done (API key)**

### Phase 2 — Secure the AI feature (Days 2–3)
- Add the `/api/generate-book` proxy (see above)
- Set `ANTHROPIC_API_KEY` in Vercel environment variables
- Now safe to share the URL

### Phase 3 — Auth + user accounts (Week 2)
- Pick your auth solution and wire it up
- Create the `profiles` table
- Add a login/signup screen (or modal)
- On signup: create a profile row, redirect to app
- On login: load profile from DB, fall back to empty state
- Keep localStorage as a short-term cache if you want (optional)

### Phase 4 — Migrate core data (Week 2, alongside Phase 3)
- Replace `save()` / `load()` localStorage calls with API/SDK calls
- Tables: `profiles`, `milestones`, `journal_entries`
- Milestone keys stay the same format (`"28-1"`) — just stored in DB now
- Journal entries get a real `id` and `user_id`

### Phase 5 — Image storage (Week 2–3)
- Create a storage bucket
- Replace `fileToBase64()` in `MarketplaceTab` with a real upload
- Store returned URLs in `marketplace_listings.photo_urls[]`
- Add the `/api/marketplace/:id/photos` endpoint (or use SDK directly)

### Phase 6 — Multi-user marketplace (Week 3)
- Create `marketplace_listings` table with RLS or middleware auth check
- `GET /api/marketplace` returns all active listings (not just yours)
- Split UI: "Browse" shows all listings, "My Listings" shows yours
- Add city filter (basic `WHERE city = $1`)
- Mark as Sold button on your own listings

### Phase 7 — Real playdates (Week 4)
- `GET /api/playdates?city=X` returns other users' profiles in that city
- Replace `DEMO_PROFILES` in `PlaydatesTab` with a real fetch
- Add the `playdate_requests` table
- V1: clicking "Request Playdate" just reveals email/phone — no in-app messaging needed yet
- V2 later: request/accept flow using the `playdate_requests` table

### Phase 8 — Soft launch (Week 5)
- Smoke test the full flow: signup → add baby → check milestones → journal entry → generate book
  → create listing → browse marketplace → find playdate
- Fix mobile layout issues (test iOS Safari specifically)
- Add error boundaries and loading states throughout
- Invite 10–20 beta users

---

## Environment Variables

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# If using Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# If using custom backend
DATABASE_URL=postgresql://user:pass@host:5432/babysteps
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=7d

# If using Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# App
NODE_ENV=production
```

Note: `VITE_` prefix is required for any env variable that needs to be accessible in the
Vite frontend. Backend-only variables (API keys, DB credentials) should NOT have the prefix.

---

## Quick Stack Combos

**Fastest to launch (least backend code):**
Supabase + Vercel — deploy frontend to Vercel, all backend logic via Supabase SDK + one
Vercel function for the AI proxy.

**Full control, familiar tools:**
Node/Fastify + Neon Postgres + Railway + Vercel frontend — conventional REST API,
you own everything, Railway handles the deploy.

**One repo, one deploy:**
Next.js + Supabase or Neon + Vercel — migrate frontend to Next.js App Router, use
Route Handlers as backend, deploy the whole thing to Vercel.

**Modern/edge curious:**
Hono + Cloudflare Workers + Cloudflare D1 (SQLite) or Neon — run the backend at
the edge globally, low latency, very generous free tier. More setup, interesting if
you want to learn the Workers ecosystem.
