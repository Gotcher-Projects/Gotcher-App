# S3 — Visual Verification Walkthrough
**Status:** Complete
**Depends on:** S2 complete
**Area:** All pages and tabs — visual review only, no architecture changes

## Goal
Walk through every screen of the app and manually verify the theming looks correct. Lots of small things will have been missed in S2 — wrong slate colors, mismatched spacing, components that still feel off. Fix them as we go.

## Approach
Go page by page, screenshot by screenshot. For each screen:
1. Open it in the browser
2. User shares a screenshot or describes what looks off
3. Fix anything that doesn't match the design intent
4. Move to next screen

## Screens to cover

### Login flow
- [x] Login page (Sign In tab)
- [x] Login page (Sign Up tab)
- [x] Forgot password view
- [ ] Reset password view — **deferred, test against prod** (code reviewed, no theming issues found)

### Main app — Dashboard tab
- [x] Dashboard — no baby profile set (empty state)
- [x] Dashboard — profile filled in, milestones visible
- [x] Quick log — Bottle/Nurse expanded
- [x] Quick log — Diaper expanded
- [x] Quick log — Sleep expanded
- [x] Feeding stat card
- [x] Sleep stat card
- [x] Profile form
- [x] Milestone progress + checklist
- [x] Milestones / Memories stat boxes
- [x] Upcoming Appointments

### Main app — Memories tab
- [x] Memories > Journal (empty state)
- [x] Memories > Journal (with entries — landscape and portrait cards)
- [x] Memories > Journal — edit mode on a card
- [x] Memories > First Times (empty state)
- [x] Memories > First Times (with entries)
- [x] Memories > First Times — add a first

### Main app — Track tab
- [x] Track > Feeding (log form)
- [x] Track > Feeding — active timer state
- [x] Track > Feeding — history
- [x] Track > Sleep (log form + averages)
- [x] Track > Sleep — history
- [x] Track > Diaper (log form — pee)
- [x] Track > Diaper (log form — poop, with color/consistency)
- [x] Track > Diaper — history

### Main app — Health tab
- [x] Health > Growth (log form + records)
- [x] Health > Vaccines (checklist)
- [x] Health > Appointments (add form + upcoming/past lists)
- [x] Health > Milestones (full list)

### Main app — Discover tab
- [x] Discover > Marketplace (coming soon card)
- [x] Discover > Playdates (coming soon card)
- [x] Discover > Activities (no birthdate set)
- [x] Discover > Activities (with birthdate — activity list + recommended products)

### Static pages
- [x] `/privacy.html`
- [x] `/terms.html`

## Color palette audit
The accent colors are technically in use but most are too faint to be meaningful. During the walkthrough, look for natural places to make them more visible:

- **Peach (`--brand-peach`)** — currently only feeding card bg at 30% opacity. Could be used more boldly on feeding-related section headers, feeding log card backgrounds, or badge pills.
- **Mint (`--brand-mint`)** — memories/journal stat box at 40%, progress bar end. Could appear on health/growth cards, vaccine checkmarks, or "achieved" milestone states.
- **Pink (`--brand-pink`)** — only in the page gradient (barely visible). Good candidate for journal/memories card accents, First Times cards, or milestone achievement celebrations.
- **Lavender (`--brand-lavender`)** — already the most-used accent. Fine to keep as the dominant background tint.

The goal isn't to use every color everywhere — just ensure each accent appears at least once at full/meaningful strength so the palette feels intentional, not accidental.

## Common things to watch for
- Any remaining `text-slate-*` that should be `text-foreground` or `text-muted-foreground`
- Any remaining `bg-white` cards that should pick up `bg-card`
- Icons using wrong color (should be `text-primary` or `text-muted-foreground`)
- Spacing/padding that looks off after font change (Poppins has different metrics than system font)
- Empty states that look unstyled
- Buttons not using the primary color
- Select dropdowns and native inputs that look inconsistent with the rest of the theme
- Any screen that didn't get the page background gradient
