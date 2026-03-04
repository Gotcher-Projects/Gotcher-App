# Baby Steps — Planning Notes

Use this file to plan and refine the app with Claude. Open questions and decisions to make are marked with `[ ]`.

---

## What We Have (MVP)

A working single-user React demo with six tabs:

| Tab | Status | Notes |
|-----|--------|-------|
| Dashboard | Done | Profile setup, age calc, milestone preview |
| Milestones | Done | 0–12mo milestones, checkbox tracking |
| Journal + AI Book | Done | Text entries + Claude API narrative generation |
| Marketplace | Done | Local listings with photo upload (base64) |
| Playdates | Demo | Static demo profiles, no real matching |
| Activities | Done | Age-appropriate activities + product recs |

All data saved to `localStorage`. No backend. No auth. Single user only.

---

## Big Decisions to Plan

### 1. App Direction
- [ ] Keep all 6 features, or pare down for launch?
- [ ] Priority order of features?
- [ ] Who is the primary user — parent, seller, or both?

### 2. Backend & Auth
- [ ] What backend? (Node/Express, Next.js API routes, Supabase, Firebase, etc.)
- [ ] Auth provider? (Clerk, NextAuth, Supabase Auth, custom JWT)
- [ ] Database? (PostgreSQL via Supabase, MongoDB, PlanetScale, etc.)

### 3. Image Storage
- [ ] Currently base64 in localStorage — hits 5MB limit fast
- [ ] Options: Cloudinary, AWS S3, Supabase Storage, Uploadthing

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
- [ ] Current: calls Anthropic API directly from browser (no API key management)
- [ ] Should move to a backend proxy to protect the API key
- [ ] Additional AI features to add? (activity suggestions, personalized milestone coaching)

### 7. Deployment
- [ ] Where? (Vercel, Netlify, Railway, etc.)
- [ ] Custom domain?
- [ ] Mobile app eventually? (React Native, PWA)

---

## Tech Stack (Current)
- Vite + React (JSX, no TypeScript)
- Tailwind CSS v3
- shadcn/ui components
- lucide-react icons
- localStorage (demo only)
- Anthropic Claude API (direct browser call — needs to be proxied)

## Tech Stack (Proposed for Production)
_Fill in during planning sessions_
- [ ] Backend:
- [ ] Database:
- [ ] Auth:
- [ ] Image storage:
- [ ] Deployment:

---

## Color & Brand
- Primary: Fuchsia-600
- Secondary: Sky-600
- Accent: Emerald-600
- Background: rose/sky/emerald-50 gradient
- Tone: Warm, supportive, parent-friendly

---

## Notes from Planning Sessions

_Add session notes here as we work through decisions._
