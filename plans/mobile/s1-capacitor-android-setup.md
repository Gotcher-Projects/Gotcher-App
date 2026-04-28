# S1 — Capacitor Install & Android Build
**Status:** Needs Verification — app loads in emulator, CORS fix written but not yet deployed to production. Login will work once CORS_ORIGINS env var is set on VPS and API container is rebuilt.
**Branch:** mobile/capacitor-setup
**Depends on:** Nothing — app already live at cradlehq.app

## Goal
Get Capacitor installed in the existing Vite+React frontend, add the Android platform, and verify the app loads correctly in an Android emulator. No feature changes — just the scaffold.

## Prerequisites (manual — do before this session)
1. **Install Android Studio** — https://developer.android.com/studio
   - During setup, install the Android SDK (API 34+) and at least one AVD (emulator image)
   - Confirm `ANDROID_HOME` or `ANDROID_SDK_ROOT` env var is set
2. **Install Java 17+** — Android Gradle requires it (you may already have Java 21 from the backend)
   - Confirm: `java -version`
3. **Confirm Node version** — Capacitor 6 requires Node 18+
   - Confirm: `node -v`

## Steps

### 1. Install Capacitor into Frontend
```bash
cd Frontend
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
```

### 2. Initialize Capacitor
```bash
cd Frontend
npx cap init "CradleHQ" "com.gotcherapp.cradlehq" --web-dir dist
```
This creates `capacitor.config.json`. Review it — confirm `webDir: "dist"` and `appId: "com.gotcherapp.cradlehq"`.

### 3. Verify vite.config.js base
Open `Frontend/vite.config.js` — confirm there is no `base` override that would break asset paths in a file:// context. Capacitor serves from `dist/` directly, so relative paths must work. The default Vite `base: "/"` works fine; if it's set to something else, change it to `"/"`.

### 4. Build and add Android platform
```bash
cd Frontend
npm run build
npx cap add android
```
This generates `Frontend/android/` — the native Android Studio project.

### 5. Sync
```bash
npx cap sync android
```
Copies the built web assets into the Android project. Run this after every `npm run build`.

### 6. Open in Android Studio and run
```bash
npx cap open android
```
In Android Studio:
- Wait for Gradle sync to finish
- Select an AVD emulator
- Click Run (▶)
- The app should open showing the Baby Steps login screen

### 7. Verify API connectivity
- Log in with the demo account: demo@gotcherapp.com / DemoPass1
- The app must hit `https://cradlehq.app` — confirm `VITE_API_URL` is set correctly in `Frontend/.env.production` (should already exist from deployment work)
- If login works, API connectivity is confirmed

### 8. .gitignore the Android build artifacts
Add to `Frontend/.gitignore`:
```
# Capacitor Android
android/
```
The `android/` directory is a generated native project — it should not be committed. Developers run `npx cap add android` + `npx cap sync` to regenerate it.

## Expected File Changes
- `Frontend/package.json` — 3 new dependencies
- `Frontend/capacitor.config.json` — new file
- `Frontend/android/` — generated, gitignored
- `Frontend/.gitignore` — android/ entry added
- `Frontend/vite.config.js` — possibly base path fix (may be a no-op)

## Out of Scope
- No camera plugin this session
- No app signing or Play Store prep
- No iOS platform
- No UI changes

## Outputs needed for S2
- [ ] `npx cap open android` launches the app in emulator without errors
- [ ] Login works (confirms API URL is correct)
- [ ] `capacitor.config.json` committed and merged to main
- [ ] Build + sync workflow documented (the `npm run build && npx cap sync` loop)
