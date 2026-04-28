# Mobile Session Prompts

---

## S1 — Capacitor Install & Android Build

Start S1. Plan: `plans/mobile/s1-capacitor-android-setup.md`

Read before writing anything:
- `Frontend/package.json` (current deps + scripts)
- `Frontend/vite.config.js` (check base path)
- `Frontend/.env.production` (confirm VITE_API_URL points to prod)
- `Frontend/.gitignore` (where to add android/ entry)

Goal: Capacitor installed, Android platform added, app running in emulator with working login.

Do not touch any application logic. Do not add the camera plugin yet. Do not commit the `android/` directory.

Prerequisites the user must complete manually before this session:
- Android Studio installed with an AVD emulator configured
- `java -version` returns 17+
- `node -v` returns 18+

---

## S2 — Camera Plugin

Start S2. Plan: `plans/mobile/s2-camera-plugin.md`

Read before writing anything:
- `Frontend/src/components/tabs/MemoriesTab.jsx` (all 4 file inputs — lines ~147, ~213, ~422, ~575)
- `Frontend/src/lib/` (check what helpers already exist before adding camera.js)
- `Frontend/package.json` (confirm @capacitor/core is present from S1)

Goal: Replace all 4 `<input type="file">` photo pickers with the Capacitor Camera plugin on native, with web fallback preserved.

Do not add crop UI to First Times — that's a separate deferred item. Do not touch sleep/feeding/diaper. Web behavior must be unchanged.

---

## S3 — Android Play Store Prep

Start S3. Plan: `plans/mobile/s3-android-play-store.md`

This session is mostly manual (keystore generation, Play Console setup, build). Code changes are limited to `android/app/build.gradle` signing config.

Read before writing anything:
- `Frontend/android/app/build.gradle` (current release build config)
- `Frontend/capacitor.config.json` (confirm appId is com.gotcherapp.cradlehq)

Prerequisites the user must complete manually before this session:
- Google Play Console account activated ($25 one-time fee, takes up to 48h)
- App icon (512×512 PNG) and feature graphic (1024×500 PNG) prepared
- At least 2 screenshots from the Android emulator

---

## S4 — iOS CI/CD Pipeline (Codemagic)

Start S4. Plan: `plans/mobile/s4-ios-codemagic-pipeline.md`

Read before writing anything:
- `Frontend/package.json` (confirm Capacitor version)
- `Frontend/capacitor.config.json` (appId, appName)
- Root directory (check if codemagic.yaml already exists)

Goal: `ios/` platform added and committed, `codemagic.yaml` written and triggering a successful cloud build, IPA uploaded to TestFlight.

Prerequisites the user must complete manually before this session:
- Apple Developer account activated ($99/yr, takes 24–48h)
- Codemagic account created and connected to GitHub repo
- App Store Connect app record created (bundle ID: com.gotcherapp.cradlehq)
- Apple Distribution certificate + provisioning profile downloaded and uploaded to Codemagic

---

## S5 — App Store Connect Submission

Start S5. Plan: `plans/mobile/s5-app-store-submission.md`

This session is entirely manual — no code changes. Work through the App Store Connect metadata checklist in the plan.

Prerequisites the user must complete manually before this session:
- Privacy policy page live at https://michaelgotcher.com/privacy
- iOS screenshots prepared (6.5" and 5.5" sizes)
- TestFlight smoke test passed on a real device
- Demo account (demo@gotcherapp.com / DemoPass1) confirmed working on the TestFlight build
