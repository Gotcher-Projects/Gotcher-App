# S3 — Android Play Store Prep
**Status:** In Progress
**Branch:** mobile-v1
**Depends on:** S2 complete — camera plugin working in emulator

## Goal
Sign a release build of the Android app, create the Google Play Console listing, and submit the app for review on the Play Store.

## Prerequisites
1. **Google Play Console account** — https://play.google.com/console ✅
   - One-time $25 registration fee
   - Use michaelgotcher7@gmail.com or a dedicated account

2. **App icon** — 512×512 PNG ✅
   - Generated: `Frontend/public/images/play-store-icon-512.png`
   - White background, centered purple CradleHQ logo

3. **Screenshots** ✅
   - Taken from physical Android device (full resolution)
   - Located in `C:\Projects\GotcherApp\MobileAppScreenshots\`
   - Mobile layout overflow bugs fixed (AppointmentTab, GrowthTab, FeedingTab)
   - Dashboard profile form moved to Edit Profile modal (cleaner screenshot)

## Steps

### 1. ✅ Generate a release keystore
This keystore is permanent — back it up. If lost, you cannot update the app.

```bash
keytool -genkey -v \
  -keystore cradlehq-release.jks \
  -alias cradlehq \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```
Fill in the prompts (name, org, etc.). Store the resulting `cradlehq-release.jks` somewhere safe outside the repo (e.g., a password manager or encrypted drive).

**Do NOT commit the keystore or passwords to git.**

### 2. ✅ Configure signing in Android Gradle
In `Frontend/android/app/build.gradle`, add a `signingConfigs` block and update `buildTypes.release`:

```groovy
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "../../../cradlehq-release.jks")
            storePassword System.getenv("KEYSTORE_PASS")
            keyAlias System.getenv("KEY_ALIAS") ?: "cradlehq"
            keyPassword System.getenv("KEY_PASS")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

Using env vars keeps secrets out of the file. Set them in your shell before building:
```bash
export KEYSTORE_PATH=/path/to/cradlehq-release.jks
export KEYSTORE_PASS=your_store_password
export KEY_ALIAS=cradlehq
export KEY_PASS=your_key_password
```

### 3. ✅ Build a release AAB
Google Play requires Android App Bundle (AAB) format:
```bash
cd Frontend
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 4. ✅ Verify the build locally (optional)
Install `bundletool` and test the AAB on your emulator before uploading:
```bash
# Download bundletool from https://github.com/google/bundletool/releases
java -jar bundletool.jar build-apks \
  --bundle=app-release.aab \
  --output=app.apks \
  --ks=cradlehq-release.jks --ks-key-alias=cradlehq
java -jar bundletool.jar install-apks --apks=app.apks
```

### 5. ✅ Create the Play Store listing
In Google Play Console → Create app:
- App name: **CradleHQ**
- Default language: English (US)
- App or game: App
- Free or paid: Free

Fill in the store listing:
- Short description (80 chars): Track everything about your baby — feeding, sleep, diapers, and every memory.
- Full description (4000 chars):
  ```
  CradleHQ is the baby tracking app built by parents, for parents, who wanted an easy way to stay on top of every moment.

  Track the essentials:
  • Feeding — log breast, bottle, and solid feeds. Track timing, amounts, and patterns over time.
  • Sleep — track naps and nighttime sleep, see patterns at a glance
  • Diapers — quick pee/poop logging with optional color and consistency notes
  • Growth — record height, weight, and head circumference over time
  • Vaccines & Appointments — never miss a checkup. Log upcoming appointments and track your baby's vaccine history.

  Capture the memories:
  • Journal — write entries and attach photos to document your baby's story
  • First Times — log those one-of-a-kind moments like first smile, first steps, and first words
  • Milestones — track developmental milestones week by week

  Fast to log, easy to review. Everything you need and nothing you don't — right when you need it most.

  Start tracking today — because the early days go fast.
  ```
- Category: Parenting
- Upload screenshots (at least 2 phone)
- Upload feature graphic
- Upload 512×512 icon

Content rating: complete the questionnaire (this app is rated Everyone).

### 6. ✅ Set up Google Play App Signing
Play Console → Setup → App integrity → Enroll in Play App Signing.
Upload your keystore — Google re-signs APKs for distribution. This means even if your keystore is later lost, Google holds the signing key.

### 7. ✅ Create a release — Internal testing release submitted (2026-05-14). Awaiting Play Store propagation before promoting to production.
Play Console → Production → Create new release → Upload `app-release.aab`
- Add release notes: "Initial release of CradleHQ baby tracking app."
- Review and roll out

### 8. Wait for review
Initial reviews take 3–7 days for new accounts. Google may request additional policy information.

## Expected File Changes
- `Frontend/android/app/build.gradle` — signing config added
- `babysteps-release.jks` — generated locally, NOT committed

## Notes
- The `android/` directory is gitignored from S1 — the Gradle signing config change lives there. Document the signing config block in this plan so it can be reapplied after a fresh `npx cap add android`.
- Consider adding the signing config to a committed `android-signing-config.gradle` snippet stored in the repo (without actual secrets) so it's not lost.
- Keystore file: `cradlehq-release.jks`, alias: `cradlehq`

## Outputs needed for S4
- [ ] AAB built and signed successfully
- [ ] Play Console listing created (even if not yet live)
- [ ] Keystore backed up securely
- [ ] App submitted to Play Store (or at least internal testing track)
