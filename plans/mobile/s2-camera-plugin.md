# S2 — Camera Plugin
**Status:** Not started
**Branch:** mobile/camera-plugin
**Depends on:** S1 complete — Capacitor installed, Android platform added

## Goal
Replace the 4 `<input type="file">` photo pickers in `MemoriesTab.jsx` with the Capacitor Camera plugin so that native iOS/Android photo pickers are used on device, while the web version continues to work unchanged.

## Background
All 4 file inputs live in `Frontend/src/components/tabs/MemoriesTab.jsx`:
- Line ~147 — Journal new entry photo (has crop/orientation flow)
- Line ~213 — Journal edit entry photo (has crop/orientation flow)
- Line ~422 — First Times new entry photo (no crop flow yet)
- Line ~575 — First Times edit entry photo (no crop flow yet)

The existing crop flow (S9) takes a `File` object from the input and runs it through a crop modal. The camera plugin returns a `dataUrl` — we need to convert that to a `File` so the existing crop logic is untouched.

## Steps

### 1. Install the camera plugin
```bash
cd Frontend
npm install @capacitor/camera
npx cap sync android
```

### 2. Create `Frontend/src/lib/camera.js`
This wrapper abstracts the platform difference:
- On native (Android/iOS): uses `@capacitor/camera` `getPhoto()`
- On web: falls back to programmatically clicking a hidden file input

```js
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export async function pickPhoto() {
  if (!Capacitor.isNativePlatform()) {
    // Web: return null and let the caller use its existing <input type="file">
    return null;
  }
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
    quality: 90,
  });
  // Convert dataUrl → File for compatibility with existing crop flow
  const res = await fetch(photo.dataUrl);
  const blob = await res.blob();
  return new File([blob], `photo.${photo.format}`, { type: blob.type });
}
```

### 3. Update MemoriesTab.jsx — Journal new entry (line ~147)
The button currently wraps a hidden `<input type="file">`. Update the button's `onClick` to:
1. Call `pickPhoto()`
2. If `pickPhoto()` returns `null` (web), fall through to the existing input click
3. If it returns a `File`, feed it directly into the same handler that `onChange` currently calls

The `<input type="file">` stays in the DOM for web — it just won't be triggered on native.

### 4. Repeat for the other 3 inputs
Same pattern for lines ~213, ~422, ~575. Each one:
- Button onClick calls `pickPhoto()` first
- On native: use the returned File
- On web: click the hidden input as before

### 5. Android permissions
Capacitor Camera requires READ_MEDIA_IMAGES on Android 13+. This is declared automatically in the plugin's `AndroidManifest.xml` — no manual step needed. Confirm by opening `android/app/src/main/AndroidManifest.xml` and checking for the permission after `npx cap sync`.

### 6. Test on Android emulator
- New journal entry → tap photo button → system photo picker opens → select image → crop modal appears (same as web)
- Edit journal entry → same flow
- New first time → tap photo → system picker → image appears in preview
- On web (browser): all 4 pickers still work via file input

## Expected File Changes
- `Frontend/package.json` — `@capacitor/camera` added
- `Frontend/src/lib/camera.js` — new helper
- `Frontend/src/components/tabs/MemoriesTab.jsx` — 4 button onClick handlers updated

## Out of Scope
- No crop modal for First Times (deferred from S9 — still deferred)
- No camera capture (only photo library picker, not live camera)
- No iOS platform yet

## Outputs needed for S3
- [ ] Photo picker works natively in Android emulator for all 4 entry points
- [ ] Web photo picker still works in browser (regression check)
- [ ] `npx cap sync android` runs clean after install
