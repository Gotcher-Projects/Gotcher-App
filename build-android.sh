#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/Frontend"
AAB_PATH="$FRONTEND_DIR/android/app/build/outputs/bundle/release/app-release.aab"

export KEYSTORE_PATH='C:\Users\micha\OneDrive\Desktop\GotcherApp\cradlehq-release.jks'
export KEYSTORE_PASS="GotcherApps#1"
export KEY_ALIAS="cradleHQ"
export KEY_PASS="GotcherApps#1"

# --- Version code reminder ---
BUILD_GRADLE="$SCRIPT_DIR/Frontend/android/app/build.gradle"
CURRENT_VERSION=$(grep -m1 'versionCode' "$BUILD_GRADLE" | tr -dc '0-9')
echo ""
echo "============================================"
echo "  VERSION CODE CHECK"
echo "============================================"
echo "  Current versionCode: $CURRENT_VERSION"
echo ""
echo "  Every Play Store upload requires a unique,"
echo "  incrementing versionCode. If this is a new"
echo "  build, bump it before continuing."
echo ""
echo "  File: Frontend/android/app/build.gradle"
echo "  Line: versionCode $CURRENT_VERSION"
echo "============================================"
echo ""
read -rp "Have you updated the versionCode? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted. Update versionCode in:"
  echo "  $BUILD_GRADLE"
  exit 1
fi

# --- Check required env vars ---
missing=()
[[ -z "${KEYSTORE_PASS:-}" ]] && missing+=("KEYSTORE_PASS")
[[ -z "${KEY_PASS:-}"      ]] && missing+=("KEY_PASS")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: Missing required environment variables: ${missing[*]}"
  echo ""
  echo "Set them before running:"
  echo "  export KEYSTORE_PATH=/path/to/cradlehq-release.jks"
  echo "  export KEYSTORE_PASS=your_store_password"
  echo "  export KEY_ALIAS=cradlehq"
  echo "  export KEY_PASS=your_key_password"
  exit 1
fi

echo "==> Building frontend..."
cd "$FRONTEND_DIR"
npm run build

echo "==> Syncing Capacitor..."
npx cap sync android

echo "==> Building release AAB..."
cd "$FRONTEND_DIR/android"
./gradlew bundleRelease

echo ""
echo "Build complete."
echo "AAB: $AAB_PATH"
echo ""
echo "Upload to Play Console:"
echo "  https://play.google.com/console → CradleHQ → Production → Create new release"
