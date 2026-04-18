# Baby Steps — Ideal Rollout Plan

## My Recommendation: Move Fast, Stay Simple

The biggest risk here isn't technical — it's building features nobody uses. The goal of this plan
is to get real users on a live URL as fast as possible, validate what they actually care about,
and then layer in complexity only where it's worth it.

The MVP demo is already solid. The job now is to make it production-ready in the right order.

---

## Recommended Stack (Final)

| Layer | Tool | Why |
|-------|------|-----|
| Frontend | Vite + React (current) | Already built, no reason to change |
| Deployment | Vercel (free tier) | 1-click deploys, free, handles both frontend + serverless functions |
| Backend / DB | Supabase | Auth + PostgreSQL + file storage in one free-tier service — eliminates the need to build a custom backend |
| Auth | Supabase Auth | Built into Supabase, handles email/password + Google sign-in out of the box |
| Image Storage | Supabase Storage | Same dashboard, same SDK, no extra accounts |
| AI Proxy | Vercel Serverless Function | One small function to protect the Anthropic API key — replaces the current browser-direct call |
| Payments (later) | Stripe | Only when marketplace volume justifies it |

**Why Supabase instead of building a backend:**
Supabase gives you a real PostgreSQL database, user auth, and file storage — all free up to 500MB
and 2 projects. You skip writing a Node/Express server entirely. Row Level Security (RLS) means
each user's data is automatically isolated at the database level. For a project this size, it's the
right call.

---

## Phase 0 — Current State (Done)
- Working React demo running locally
- All 6 features functional
- Data stored in localStorage (single-user, browser-only)
- AI book feature calls Anthropic API directly from the browser (API key is exposed — must fix before launch)

---

## Phase 1 — Get It Live (Days 1–3)

**Goal: Give people a URL they can visit. No backend yet.**

### Steps
1. Push the project to a GitHub repo (public or private)
2. Connect the repo to Vercel (free account)
3. Deploy — Vercel auto-builds on every push
4. Share the URL with 3–5 people you trust

### Why this first
You now have a live demo at a real URL. Anyone can test it without running Node locally.
The AI book feature won't work yet (API key problem), but every other tab will. This is
good enough to get early feedback on the concept before spending time on backend work.

### Deliverable
- Public URL (e.g., `baby-steps.vercel.app`)
- Takes ~1 hour

---

## Phase 2 — Secure the AI Feature (Days 3–5)

**Goal: Make the AI book generation work safely in production.**

### The Problem
Right now, `JournalTab` calls the Anthropic API directly from the browser:
```
fetch("https://api.anthropic.com/v1/messages", { headers: { "x-api-key": "..." } })
```
This means the API key would be exposed in browser devtools. Never deploy this publicly as-is.

### The Fix
Create one Vercel Serverless Function (`/api/generate-book`) that acts as a proxy:
- Frontend sends journal entries to `/api/generate-book`
- The function (running server-side) adds the API key and calls Anthropic
- Returns the result to the frontend

The API key lives in a Vercel environment variable, never in the browser.

### Steps
1. Create `api/generate-book.js` in the project root (Vercel auto-detects this as a serverless function)
2. Move the Anthropic fetch call into that function
3. Update `JournalTab` to call `/api/generate-book` instead
4. Add `ANTHROPIC_API_KEY` to Vercel environment variables

### Deliverable
- AI books work on the live URL
- API key is never exposed to users
- Takes ~2–3 hours

---

## Phase 3 — Supabase Setup + Auth (Week 2)

**Goal: Real user accounts. Data lives in the cloud, not the browser.**

### Steps

**3a. Create the Supabase project**
1. Sign up at supabase.com (free)
2. Create a new project — takes ~2 minutes to spin up
3. Note the project URL and anon key (goes in `.env.local`)

**3b. Set up the database tables**
Create these tables in Supabase (SQL editor or table editor):
```sql
-- User profiles (extends Supabase auth.users)
profiles (
  id uuid references auth.users primary key,
  baby_name text,
  birthdate date,
  parent_name text,
  email text,
  phone text,
  city text,
  values text,
  interests text,
  created_at timestamptz default now()
)

-- Milestones checked off by user
milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  milestone_key text,   -- e.g., "28-1"
  achieved boolean default true,
  achieved_at timestamptz default now()
)

-- Journal entries
journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  week int,
  title text,
  story text,
  created_at timestamptz default now()
)
```

**3c. Enable Row Level Security**
Add RLS policies so users can only read/write their own data. Supabase has a policy wizard
for this — it takes about 10 minutes.

**3d. Add auth to the React app**
1. Install `@supabase/supabase-js`
2. Create `src/lib/supabase.js` with the client
3. Add a simple `AuthContext` with login/signup/logout
4. Wrap the app in the context
5. Show a login screen if no session, app if logged in

**3e. Migrate localStorage reads/writes to Supabase**
Replace the current `save()` and `load()` calls with Supabase queries:
- On app load: fetch profile, milestones, journal from Supabase
- On change: upsert to Supabase (keep localStorage as a local cache if you want offline support)

### Deliverable
- Users can sign up, log in, log out
- Data persists in the cloud (works on any device)
- Multiple users can use the app independently
- Takes ~1 week of focused work (or 2–3 evenings)

---

## Phase 4 — Image Storage (Week 2, alongside Phase 3)

**Goal: Replace base64 localStorage photos with real cloud storage.**

### The Problem
The marketplace currently stores photos as base64 strings in localStorage. This is fine for
a demo but localStorage has a ~5MB limit — 2–3 photos fills it up. Base64 also bloats the
data by ~33%.

### The Fix
Use Supabase Storage (included free up to 1GB):
1. Create a `marketplace-photos` storage bucket in Supabase
2. Make it public (photos should be viewable without auth)
3. In the marketplace upload handler, replace `fileToBase64()` with a Supabase storage upload
4. Store the returned public URL in the listing instead of the base64 string

### Deliverable
- Photos upload to cloud storage
- No localStorage size limit
- Photos load from CDN (fast)
- Takes ~1 day

---

## Phase 5 — Multi-User Marketplace (Week 3)

**Goal: Users can see and browse each other's listings.**

This is the biggest UX unlock. Right now each user only sees their own listings. Making
it multi-user turns the marketplace into an actual community feature.

### Database addition
```sql
marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  title text not null,
  description text,
  price numeric(10,2),
  photo_urls text[],    -- array of Supabase Storage URLs
  seller_name text,
  seller_email text,
  seller_phone text,
  city text,
  status text default 'active',   -- active | sold | deleted
  created_at timestamptz default now()
)
```

### RLS Policy
- Anyone logged in can READ all active listings
- Users can only INSERT / UPDATE / DELETE their own listings

### UI changes
- Add a "Browse" tab (or split current Marketplace into "Browse" and "My Listings")
- Add basic filters: city, price range
- Add "Mark as Sold" button on your own listings
- Show seller contact info on listing cards

### Deliverable
- Real community marketplace
- All users see all listings
- Sellers can manage their own listings
- Takes ~3–4 days

---

## Phase 6 — Real Playdates (Week 4)

**Goal: Replace the hardcoded demo profiles with real users.**

### Steps
1. The `profiles` table (created in Phase 3) already stores `city`, `values`, `interests`
2. Create a query to fetch all other users' profiles where `city` matches (or is nearby)
3. Replace `DEMO_PROFILES` in `PlaydatesTab` with a live Supabase query
4. Add a "Request Playdate" action that sends a notification (email via Supabase Edge Functions,
   or just reveals contact info for now)

### For V1 (simple)
- Show all profiles in the same city
- Clicking "Request Playdate" reveals the person's email/phone
- No in-app messaging yet — that's complex and can wait

### For V2 (later)
- Distance-based matching (lat/lng, geocoding)
- In-app messaging (Supabase Realtime)
- Request / accept / decline flow
- Baby age proximity filter

### Deliverable
- Real parent profiles browsable by city
- Contact info revealed on request
- Takes ~2 days for V1

---

## Phase 7 — Polish + Soft Launch (Week 5)

**Goal: Clean up the experience and invite the first real users.**

### Checklist
- [ ] Add loading spinners on all data fetches (currently instantaneous from localStorage)
- [ ] Add error messages when Supabase calls fail
- [ ] Add empty states with clear CTAs ("Add your first journal entry")
- [ ] Test on mobile (iOS Safari + Android Chrome)
- [ ] Add a simple onboarding flow for new users (set baby name + birthdate on first login)
- [ ] Add a basic landing page or at minimum a proper title/description in `index.html` for sharing
- [ ] Set up a custom domain if desired (Vercel makes this free and easy)
- [ ] Test the full signup → use → return flow with 5 real people

### Soft Launch
Invite 10–20 beta users. Real parents preferred. Give them a feedback form or just text them.
Focus questions:
- Which feature do you actually use daily?
- What's missing or confusing?
- Would you pay for this? What would make it worth paying for?

### Deliverable
- Stable, polished app
- 10–20 real users
- First feedback collected

---

## Phase 8 — Post-Launch Enhancements (As Needed)

Prioritize based on what users actually ask for. Don't build these speculatively.

### High-value, relatively easy
- **Email notifications** — Supabase Edge Functions can send email when someone requests a playdate
- **Download/share AI book** — Export as PDF (use a library like `jspdf`)
- **Photo on journal entries** — Journal is richer with photos
- **Listing categories** — Clothing, Gear, Toys, Furniture

### Medium effort
- **Stripe marketplace payments** — Only worth adding if listings are actually selling
- **In-app messaging** — Supabase Realtime makes this feasible; only needed if users complain about sharing contact info
- **Baby age filter on playdates** — Parents with 2-month-olds want to meet other parents with babies the same age

### Longer term
- **Push notifications** (PWA or React Native app)
- **Premium tier** — Unlimited AI books, featured listings, private journal
- **Social sharing** — Share a baby milestone card or AI book excerpt

---

## Timeline Summary

| Phase | Work | Timeline | Key Output |
|-------|------|----------|------------|
| 1 | Deploy to Vercel | Days 1–3 | Live URL, shareable |
| 2 | Secure AI feature | Days 3–5 | AI books work in production |
| 3 | Supabase auth + DB | Week 2 | Real user accounts, cloud data |
| 4 | Image storage | Week 2 | Marketplace photos in cloud |
| 5 | Multi-user marketplace | Week 3 | Community listings |
| 6 | Real playdates | Week 4 | Real parent profiles by city |
| 7 | Polish + soft launch | Week 5 | 10–20 beta users |
| 8+ | Post-launch features | Ongoing | Based on feedback |

**Realistic total to soft launch:** 5–6 weeks of part-time work, or 2–3 weeks with a developer
focused on it full-time.

---

## Cost Estimate (Monthly, at Launch Scale)

| Service | Free Tier | Paid (if needed) |
|---------|-----------|-----------------|
| Vercel | Free (hobby) | $20/mo (pro) |
| Supabase | Free (2 projects, 500MB) | $25/mo (pro) |
| Anthropic API | Pay per use | ~$0.01–0.05 per book generated |
| Domain | — | ~$12/year |
| **Total** | **~$0** | **~$45–50/mo** |

At soft launch scale (under 500 users), this likely stays free or near-free.

---

## What I'd Do First Thing Tomorrow

1. `git init` + push to GitHub (if not already done)
2. Connect to Vercel, deploy in under an hour
3. Create a Supabase project in parallel
4. Start Phase 2 (the AI proxy) — it's the most important fix before sharing the URL with anyone

The hardest part of this app isn't technical. It's getting parents to actually open it every day.
That means the Journal + AI Book feature needs to feel magical, and milestones need to feel
personal. Nail those two, and the marketplace and playdates grow naturally from the community
you build.
