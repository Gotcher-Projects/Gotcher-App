# S1 — CradleHQ Rebrand
**Status:** Complete
**Branch:** rebrand/cradlehq
**Depends on:** Nothing — production already updated

## Goal
Rename the app from "Baby Steps" to "CradleHQ" everywhere it appears in the UI and codebase. Add privacy policy and terms of service as standalone HTML pages. Add footer links to the login page.

One small backend change: update the verification email text. No new dependencies. Internal filenames stay as-is.

## Brand Reference
- App name: CradleHQ
- Domain: cradlehq.app
- Privacy email: privacy@cradlehq.app

## Affected Files

### Edit
- `Frontend/index.html` — page title
- `Frontend/src/components/LoginPage.jsx` — app name + add footer links
- `Frontend/src/components/BabySteps.jsx` — any visible "Baby Steps" display text
- `Backend/src/main/java/com/gotcherapp/api/auth/EmailVerificationService.java` — email subject + body text

### Create
- `Frontend/public/privacy.html` — standalone privacy policy
- `Frontend/public/terms.html` — standalone terms of service

### Manual (not a code change)
- Create `privacy@cradlehq.app` email address before legal pages go live

### Reference
- `plans/rebrand/change-map.txt` — full checklist of every touch point

---

## Steps

### 1. Update page title
`Frontend/index.html` — change `<title>` to `CradleHQ`

Also check for any meta tags (`og:title`, `og:url`, `description`) and update accordingly.

### 2. Rebrand LoginPage
`Frontend/src/components/LoginPage.jsx`:
- Find the app name / logo text and change "Baby Steps" → "CradleHQ"
- Search for any tagline or subtitle referencing the old name
- Search for any occurrence of "michaelgotcher.com" and replace with "cradlehq.app"
- Add a footer at the bottom of the page (below the login/register card, inside the outermost container):
  ```jsx
  <p className="text-center text-xs text-muted-foreground mt-6">
    <a href="/privacy.html" className="hover:underline">Privacy Policy</a>
    {" · "}
    <a href="/terms.html" className="hover:underline">Terms of Service</a>
  </p>
  ```

### 3. Rebrand BabySteps shell
`Frontend/src/components/BabySteps.jsx`:
- Search for any visible "Baby Steps" display text (headers, nav labels, empty states)
- Replace with "CradleHQ"
- Do NOT rename the file or the component function

### 4. Domain sweep
Search `Frontend/src/` for any remaining "michaelgotcher.com" occurrences and replace with "cradlehq.app".

### 5. Rebrand verification email
`Backend/src/main/java/com/gotcherapp/api/auth/EmailVerificationService.java`:
- Subject: `"Verify your Baby Steps email"` → `"Verify your CradleHQ email"`
- Body sign-off: `"— Baby Steps"` → `"— The CradleHQ Team"`
- Body intro: update any "Baby Steps" references in the email body text

### 6. Create privacy.html
`Frontend/public/privacy.html` — standalone HTML page (no React, no build step).

Structure:
- `<title>Privacy Policy — CradleHQ</title>`
- Small `<script>const BRAND = { name: "CradleHQ", url: "https://cradlehq.app", email: "privacy@cradlehq.app" };</script>` block (unused at render time, just documents the single place to update)
- "← Back to CradleHQ" link at top → `https://cradlehq.app`
- Sections:
  1. Introduction / last updated date
  2. Information we collect (account info, baby profile, journal entries, photos, usage data)
  3. How we use your information
  4. Data storage and security
  5. Children's privacy — COPPA note (app processes child data on behalf of parents)
  6. Data deletion — email privacy@cradlehq.app to request deletion
  7. Changes to this policy
  8. Contact us → privacy@cradlehq.app
- Minimal styling: system font stack, max-width centered, readable line height

### 7. Create terms.html
`Frontend/public/terms.html` — same structure/style as privacy.html.

Sections:
1. Acceptance of terms
2. Description of service (baby tracking app, personal use)
3. User accounts (you are responsible for your account)
4. Acceptable use (no scraping, no abuse, personal use only)
5. Content you upload (you own it, we store it on your behalf)
6. Disclaimer of warranties
7. Limitation of liability
8. Changes to terms
9. Contact → privacy@cradlehq.app

---

## Definition of Done
- [ ] "Baby Steps" no longer appears anywhere in the rendered UI
- [ ] "michaelgotcher.com" no longer appears in any frontend source file
- [ ] `/privacy.html` and `/terms.html` are reachable and render cleanly
- [ ] Login page has working Privacy Policy and Terms links at the bottom
- [ ] Verification email subject/body no longer mentions "Baby Steps"
- [ ] `plans/tech-debt/ai-memory-books.md` exists
