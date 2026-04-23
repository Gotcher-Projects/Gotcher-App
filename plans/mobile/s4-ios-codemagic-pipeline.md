# S4 — iOS CI/CD Pipeline (Codemagic)
**Status:** Not started
**Branch:** mobile/ios-pipeline
**Depends on:** S3 complete — Android AAB built successfully, app working in emulator

## Goal
Add the iOS Capacitor platform, set up a Codemagic CI/CD pipeline that builds and signs the iOS IPA on a cloud Mac, and verify the build completes successfully. No local Mac required.

## Prerequisites (manual — do before this session)
1. **Apple Developer account** — https://developer.apple.com/programs/
   - $99/yr individual or $299/yr organization
   - Takes 24–48 hours to activate for new accounts
   - Use michaelgotcher7@gmail.com or a dedicated Apple ID

2. **Codemagic account** — https://codemagic.io
   - Sign up with GitHub — it will need repo access
   - Free tier: 500 build minutes/month (enough for initial setup)

3. **App Store Connect app record** — https://appstoreconnect.apple.com
   - New App → iOS → Bundle ID: `com.gotcherapp.babysteps`
   - SKU: `babysteps-ios-1`
   - Name: Baby Steps

## Steps

### 1. Add iOS platform locally (or in CI)
Even without a Mac you can generate the `ios/` directory structure. Run this in the repo and commit it — Codemagic will use it:
```bash
cd Frontend
npx cap add ios
npx cap sync ios
```
Unlike `android/`, commit the `ios/` directory — Codemagic needs it and won't regenerate it.

Remove the `ios/` line from `.gitignore` if it was added there.

### 2. Create Apple signing certificates
In Apple Developer portal:
- Create an **iOS Distribution certificate** (App Store)
- Create an **App ID** with bundle ID `com.gotcherapp.babysteps`
- Create an **App Store provisioning profile** for that App ID

Download the `.p12` certificate and provisioning profile — you'll upload these to Codemagic.

### 3. Add signing files to Codemagic
In Codemagic → Teams → Code signing identities:
- Upload the `.p12` certificate + password
- Upload the `.mobileprovision` provisioning profile

### 4. Create `codemagic.yaml` in repo root
```yaml
workflows:
  ios-release:
    name: iOS Release Build
    max_build_duration: 60
    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: com.gotcherapp.babysteps
      node: 20
      xcode: latest
      cocoapods: default
    scripts:
      - name: Install dependencies
        script: cd Frontend && npm ci
      - name: Build web assets
        script: cd Frontend && npm run build
      - name: Capacitor sync
        script: cd Frontend && npx cap sync ios
      - name: Set up code signing
        script: xcode-project use-profiles
      - name: Build IPA
        script: |
          cd Frontend/ios/App
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Release \
            -archivePath build/App.xcarchive \
            archive
          xcodebuild -exportArchive \
            -archivePath build/App.xcarchive \
            -exportOptionsPlist exportOptions.plist \
            -exportPath build/output
    artifacts:
      - Frontend/ios/App/build/output/*.ipa
    publishing:
      app_store_connect:
        auth: integration
        submit_to_testflight: true
```

### 5. Create `Frontend/ios/App/exportOptions.plist`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
</dict>
</plist>
```
Replace `YOUR_TEAM_ID` with your 10-character Apple Developer Team ID.

### 6. Connect Codemagic to GitHub
Codemagic → Add application → GitHub → select this repo → select the `codemagic.yaml` workflow.

### 7. Trigger a build
Push the `codemagic.yaml` to main (or the mobile branch). In Codemagic dashboard, start the `ios-release` workflow manually.

Monitor the build log — first run will likely take 20–30 minutes (CocoaPods install + full Xcode build).

### 8. Verify the IPA
If the build succeeds, Codemagic uploads the IPA to TestFlight automatically (if `submit_to_testflight: true`). Add yourself as a TestFlight tester and install on a physical iPhone if available.

## Expected File Changes
- `Frontend/ios/` — generated Xcode project (committed)
- `codemagic.yaml` — new file in repo root
- `Frontend/ios/App/exportOptions.plist` — new file

## Notes
- Codemagic's free tier (500 min/month) is enough for ~10 release builds/month. If you need more, the Starter plan is $95/month but pay-per-minute options exist.
- The `ios/` directory includes `Podfile` — CocoaPods is required. Codemagic handles this automatically via the `cocoapods: default` env setting.
- If CocoaPods issues arise, `npx cap update ios` regenerates the Pods config.

## Outputs needed for S5
- [ ] Codemagic build completes without errors
- [ ] IPA artifact produced
- [ ] IPA uploaded to TestFlight (even if not yet reviewed)
- [ ] `codemagic.yaml` committed and working
