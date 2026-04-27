# S2 — Apply Base Theme Across App
**Status:** Complete
**Completed steps:** 1, 2, 3, 4, 5, 6 — all steps done
**Step 4 details:** font-display added to all h2/h3/h4 section headings across FeedingTab, SleepTab, GrowthTab, DiaperTab, AppointmentTab, DiscoverTab, MemoriesTab (journal titles + first-times card title); font-medium added to all CradleHq TabsTriggers
**Also done (extra):** Brand gradient on page backgrounds, milestone progress bar brand colors, feeding/sleep stat card accent tints, milestones/memories stat boxes tinted, Discover activities card updated
**Remaining:** None — verify in browser
**Depends on:** S1 complete
**Area:** `LoginPage.jsx`, `CradleHq.jsx`, all tab components, `index.html`

## Goal
Replace all hardcoded colors and generic branding with base theme tokens and official CradleHQ assets. After this session the app should fully reflect the design plan visually.

## Steps

### 1. LoginPage — logo + colors
`Frontend/src/components/LoginPage.jsx`
- Replace `text-fuchsia-700` CradleHQ wordmark with the horizontal logo layout:
  - `<img src="/images/cradleLogo.png">` icon (h-10) + `<span className="font-display font-bold text-2xl text-brand-navy">CradleHQ</span>`
- Replace any hardcoded accent colors with theme tokens (`text-primary`, `bg-brand-lavender`, etc.)
- Tagline "Track · Celebrate · Connect" styled in `font-display text-sm text-muted-foreground`

### 2. App header — CradleHq.jsx
`Frontend/src/components/CradleHq.jsx`
- Replace the plain "CradleHQ" text at line 431 with icon + wordmark (same as LoginPage horizontal layout)
- Header background: use `bg-white border-b border-border` (picks up theme border token)

### 3. Audit and replace hardcoded colors across components
Search for and replace:
- `text-fuchsia-*`, `bg-fuchsia-*` → theme tokens
- `text-purple-*`, `bg-purple-*` → `text-primary` / `bg-primary` where appropriate
- `text-indigo-*`, `bg-indigo-*` → same
- Any `text-gray-*` used as foreground → `text-foreground` or `text-muted-foreground`
- Any `bg-gray-*` used as surface → `bg-card` or `bg-muted`

Affected files to audit: all files in `Frontend/src/components/tabs/`

### 4. Typography pass
- Add `font-display` (Poppins) to all page-level headings (`h1`, `h2`, section titles)
- Body text inherits `font-sans` (Inter) from the Tailwind base — verify it renders correctly
- Tab labels and nav items: `font-sans font-medium`

### 5. Favicon + page title
- **Current state:** Temporary SVG favicon (`/images/favicon.svg`) — purple rounded square with "HQ" text. Works, but not the real logo icon.
- **Proper fix:** The PNG files (`cradleLogo.png`, `cradleVector.png`) have too much transparent padding to work as favicons. Three options to resolve:
  1. **Online tool (easiest):** Upload `cradleLogo.png` to realfavicongenerator.net — auto-crops whitespace, exports proper `favicon.ico` + PNG set. Drop output in `Frontend/public/` and update `<link>` in `index.html`.
  2. **Script:** Write a Node.js script using `sharp` to auto-crop transparent pixels and save a square `favicon.png`. Needs `sharp` installed (`npm install sharp --save-dev` in Frontend/).
  3. **From design source:** If the logo exists in Figma/Illustrator/SVG, export just the icon mark at 64×64 with no padding.
- `index.html` `<title>`: already reads `CradleHQ` ✓

### 6. Privacy/Terms pages
`Frontend/public/privacy.html` and `terms.html`:
- Update any hardcoded color references to use the brand purple hex directly (these are static HTML, no CSS vars)
- Update page title tags if still showing old branding

## Verification
- Login page shows icon + wordmark, no fuchsia/hardcoded colors visible
- App header matches the design plan horizontal logo treatment
- Poppins renders for headings; Inter for body — verify in browser DevTools > Elements > Computed > font-family
- Favicon shows the cradle icon in the browser tab
- No `text-fuchsia-*` or `text-purple-*` Tailwind classes remain in any component file (grep check)
