# S5 — App Store Connect Submission Prep
**Status:** Not started
**Branch:** mobile/ios-pipeline (same branch as S4, or main)
**Depends on:** S4 complete — Codemagic pipeline building IPA successfully, IPA in TestFlight

## Goal
Complete the App Store Connect listing metadata, prepare screenshots and assets, run basic TestFlight testing, and submit the app for App Store review.

## Prerequisites (manual — do before this session)
1. **iOS screenshots** — App Store requires screenshots for each device size you claim support for
   - Required: 6.5" (iPhone 14 Pro Max / 15 Plus) — 1290×2796 or 1284×2778
   - Required: 5.5" (iPhone 8 Plus) — 1242×2208
   - Optional but recommended: 12.9" iPad Pro
   - Use the iOS Simulator in Xcode (run on Codemagic or borrow a Mac briefly) OR use a tool like Rotato/Codemagic's screenshot service

2. **Privacy policy URL** — App Store requires a privacy policy for apps that collect user data (this app does: baby photos, health info)
   - Simplest option: a `/privacy` page on michaelgotcher.com
   - Can be a basic HTML page listing what data is collected and how it's used

3. **TestFlight tester** — install the TestFlight build on a real iPhone to verify core flows before submission. Borrow a device or add a family member as a tester.

## Steps

### 1. Complete App Store Connect metadata
App Store Connect → Baby Steps → App Information:
- **Subtitle** (30 chars): Baby tracking & memories
- **Category**: Primary — Health & Fitness, Secondary — Lifestyle
- **Privacy Policy URL**: https://michaelgotcher.com/privacy

App Store Connect → Baby Steps → Pricing and Availability:
- Price: Free
- Availability: All countries

### 2. Complete the version metadata (1.0)
App Store Connect → Baby Steps → iOS App → 1.0 Prepare for Submission:
- **Description** (4000 chars): Write a full store description. Lead with value, mention key features (feeding, sleep, diapers, milestones, journal, photo memories).
- **Keywords** (100 chars): baby tracker, infant log, feeding tracker, baby milestone, newborn journal
- **Support URL**: https://michaelgotcher.com
- **Marketing URL** (optional): https://michaelgotcher.com

Upload screenshots for each required device size.

### 3. App Review information
- Sign-in required: Yes
- Demo account: demo@gotcherapp.com / DemoPass1
- Notes to reviewer: "Demo account has a fully seeded baby profile (Lily, 3 months) with journal entries, milestones, and feeding/sleep/diaper logs."

### 4. Answer the content questionnaire
- Does the app contain ads? No
- Does the app use encryption? Yes — HTTPS for all API calls (standard)
  - This triggers an export compliance question — select "Uses standard encryption (HTTPS/TLS)"
- Does the app collect data? Yes — fill in the Data Privacy section:
  - Health & Fitness: baby feeding/sleep/diaper data — used for app functionality, not shared
  - Photos: journal images — uploaded by user, not shared with third parties
  - Contact Info: email address for login — not linked to third parties

### 5. Run TestFlight smoke test
Install the TestFlight build and verify:
- [ ] Register a new account
- [ ] Create a baby profile
- [ ] Log a feeding, sleep, diaper entry
- [ ] Add a journal entry with photo
- [ ] Add a milestone
- [ ] Log out and log back in

### 6. Submit for review
App Store Connect → Submit for Review.

Apple's review timeline: 24–48 hours for most apps, though first submissions can take up to a week.

### 7. After approval
- Set release to "Automatic" (releases immediately after approval) or "Manual" (you release it)
- Share the App Store link

## Notes
- **Export compliance**: Since the app uses HTTPS, you must answer the encryption questions. Standard HTTPS/TLS is exempt from export restrictions — just select the "standard encryption" option.
- **Age rating**: This app will likely receive a 4+ rating (no objectionable content).
- **Privacy policy**: Apple is strict about this for apps that collect health or personal data. Write a real one, not a placeholder.
- If rejected: App Store rejections come with a specific guideline number. Common first-submission issues: missing privacy policy, demo account not working, or screenshots showing a different app name.

## Outputs — Done When
- [ ] App approved and live on the App Store
- [ ] App Store URL recorded in MEMORY.md
- [ ] Play Store (Android) and App Store (iOS) links both working
