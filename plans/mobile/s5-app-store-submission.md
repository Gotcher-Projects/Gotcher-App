# S5 — App Store Connect Submission Prep
**Status:** In Progress
**Branch:** mobile/ios-pipeline (same branch as S4, or main)
**Depends on:** S4 complete — Codemagic pipeline building IPA successfully, IPA in TestFlight

## Goal
Complete the App Store Connect listing metadata, prepare screenshots and assets, run basic TestFlight testing, and submit the app for App Store review.

## Prerequisites (manual — do before this session)
1. **iOS screenshots** ✅ DONE — 5 screenshots captured via Chrome DevTools (428×926, DPR 3 → 1284×2778) and uploaded to App Store Connect 6.5" slot
   - Use custom device in DevTools: Width 428, Height 926, DPR 3 (NOT iPhone 14 Pro Max — its 1290×2796 is not accepted)
   - Screens captured: Dashboard, Track (Feeding), Memories (Journal), Health (Milestones), Health (Appointments)

2. **Privacy policy URL** ✅ DONE — live at https://cradlehq.app/privacy

3. **TestFlight smoke test** ✅ SKIPPED — web app at cradlehq.app is pixel-identical; tested there instead

## Steps

### 1. Complete App Store Connect metadata
App Store Connect → CradleHQ → App Information:
- **Subtitle** (30 chars): Baby tracking & memories
- **Category**: Primary — Health & Fitness, Secondary — Lifestyle
- **Privacy Policy URL**: https://cradlehq.app/privacy

App Store Connect → CradleHQ → Pricing and Availability:
- Price: Free
- Availability: All countries

### 2. Complete the version metadata (1.0) ✅ DONE
App Store Connect → CradleHQ → iOS App → 1.0 Prepare for Submission:

**Description** (paste as-is):
```
CradleHQ helps parents capture every precious moment of their baby's first years — from first smiles to first steps.

Track the details that matter most:
• Feeding logs — breast, bottle, or solids
• Sleep tracking — naps and overnight sessions
• Diaper logs — quick pee or detailed poop entries
• Growth measurements and vaccine records
• Upcoming appointments

Celebrate every milestone as it happens. CradleHQ comes preloaded with the developmental milestones your pediatrician watches for, so you can mark them off as your baby reaches each one.

Capture memories that last a lifetime. The journal lets you write entries and attach photos, building a keepsake record of your baby's story from day one.

Simple, fast, and built for the sleep-deprived. Log a feeding in seconds, check your history at a glance, and never lose track of when the last nap ended.

CradleHQ is free to use.
```

**Keywords** (93 chars — paste exactly):
```
baby tracker,infant log,feeding tracker,sleep log,diaper log,baby milestone,newborn journal
```

- **Support URL**: https://cradlehq.app
- **Marketing URL** (optional): https://cradlehq.app

### 3. App Review information ✅ DONE
- Sign-in required: Yes
- Demo account: demo@gotcherapp.com / DemoPass1
- Notes to reviewer: "Demo account has a fully seeded baby profile (Lily, 3 months) with journal entries, milestones, and feeding/sleep/diaper logs."

### 4. Answer the content questionnaire ✅ DONE
- Does the app contain ads? No
- Does the app use encryption? Yes — HTTPS for all API calls (standard)
  - This triggers an export compliance question — select "Uses standard encryption (HTTPS/TLS)"
- Does the app collect data? Yes — fill in the Data Privacy section:
  - Health & Fitness: baby feeding/sleep/diaper data — used for app functionality, not shared
  - Photos: journal images — uploaded by user, not shared with third parties
  - Contact Info: email address for login — not linked to third parties

### 5. Submit for review ✅ DONE — Submitted 2026-06-06
Apple's review timeline: 24–48 hours for most apps, though first submissions can take up to a week.

### 6. After approval
- Set release to "Automatic" (releases immediately after approval) or "Manual" (you release it)
- Share the App Store link

## Notes
- **Export compliance**: Since the app uses HTTPS, you must answer the encryption questions. Standard HTTPS/TLS is exempt from export restrictions — just select the "standard encryption" option.
- **Age rating**: This app will likely receive a 4+ rating (no objectionable content).
- **Privacy policy**: Apple is strict about this for apps that collect health or personal data. Write a real one, not a placeholder.
- If rejected: App Store rejections come with a specific guideline number. Common first-submission issues: missing privacy policy, demo account not working, or screenshots showing a different app name.

## Pending check on wake-up
- [x] Codemagic build triggered 2026-06-06 with Info.plist privacy strings fix — verified passed, new IPA uploaded to TestFlight (2026-06-06)

## Outputs — Done When
- [ ] App approved and live on the App Store
- [ ] App Store URL recorded in MEMORY.md
- [ ] Play Store (Android) and App Store (iOS) links both working
