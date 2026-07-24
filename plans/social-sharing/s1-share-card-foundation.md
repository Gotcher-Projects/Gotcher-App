# S1 — Share-Card Foundation

**Status: Not started**
**Branch:** TBD (suggest `feature/share-cards`)
**Depends on:** nothing. (Pairs nicely with pregnancy S2/S3 but does not require them.)

---

## Context
Build the reusable pipeline that turns a styled DOM card into a shareable PNG, and prove it on **one**
card type (first-times — it already has a share button and `shareFirstTime()`). Everything else in
this plan is "another card template" on top of this foundation, so get the rendering + share
fallbacks right here.

## Decisions
- **Client-side** rasterization via **html2canvas** (already a dependency for the storybook PDF).
- **Prove on first-times first**, then template. No card framework before one card ships.
- Graceful degradation: image-file share → download → existing text/link. Never a silent failure.
- Obey `feedback_html2canvas_limitations`: **no pseudo-elements** (`::before`, `::first-letter`),
  no `mask-image`; render **off-screen at a fixed pixel size**, not scaled-to-fit.

---

## Pieces

### 1. Off-screen render util — `Frontend/src/lib/shareCard.js` (new)
```js
import html2canvas from 'html2canvas';

// Render a React-produced DOM node (mounted off-screen at a fixed size) to a PNG Blob.
// Caller mounts the card off-screen (see pattern below) and passes the element ref.
export async function nodeToPngBlob(el, { width = 1080, height = 1080, scale = 1 } = {}) {
  const canvas = await html2canvas(el, {
    width, height, scale,
    backgroundColor: null,
    useCORS: true,           // Cloudinary images are cross-origin
    logging: false,
  });
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
```
**Off-screen mount pattern** (do NOT use `display:none` — html2canvas needs layout): mount the card
in a container positioned far off-screen (`position:fixed; left:-99999px; top:0`) at the exact target
pixel size, render, then unmount. Mirror the existing storybook off-screen export approach so we stay
consistent with what already works for PDF.

> Instagram-friendly default is **1080×1080** (square). Allow a portrait variant (1080×1350) later.

### 2. Share / download util — extend `Frontend/src/lib/share.js`
```js
// Share a PNG blob via the native share sheet (with file), else download it,
// and always also offer the text/link as a caption fallback.
export async function shareImageCard({ blob, filename, title, text, url }) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title, text });
    return 'shared';
  }
  // Fallback: trigger a download, and copy the caption text/link.
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = filename; a.click();
  URL.revokeObjectURL(href);
  if (text || url) await navigator.clipboard.writeText(`${text ?? ''}${url ? '\n' + url : ''}`);
  return 'downloaded';
}
```
Keep the existing `shareFirstTime()` text path as the deepest fallback (no canvas support at all).

### 3. The card component — `Frontend/src/components/share/FirstTimeShareCard.jsx` (new)
A fixed 1080×1080 card built with **real DOM elements only** (no pseudo-elements), themed with the
existing tokens:
- baby photo (Cloudinary URL, `crossorigin` for html2canvas + `useCORS`),
- "{babyName}'s first {label}",
- the date,
- a small CradleHQ wordmark/logo (`public/images/cradleLogo.png`) for brand carry.

### 4. Wire into the first-times share button
Today the first-times Share button calls `shareFirstTime()` (text/link). Add an **"Share as image"**
path: mount `<FirstTimeShareCard>` off-screen → `nodeToPngBlob` → `shareImageCard`. Keep the plain
text share available (menu or secondary action). On `'downloaded'`, show the existing inline "Saved /
copied" message.

---

## Gotchas
- **CORS:** Cloudinary images must load with `crossOrigin="anonymous"` AND `useCORS:true`, or the
  canvas taints and `toBlob` returns null. Verify with a real Cloudinary photo, not a local asset.
- **Fonts:** the card uses brand fonts (Inter/Poppins) — ensure they're loaded before render or
  html2canvas falls back to a system font. Await `document.fonts.ready`.
- **No `::first-letter` drop caps** or other pseudo-elements in the card — they won't rasterize.

---

## Testing checklist
- [ ] `nodeToPngBlob` returns a non-null PNG blob from an off-screen card
- [ ] Card with a Cloudinary photo rasterizes (no CORS taint / null blob)
- [ ] Mobile (Web Share w/ files): share sheet opens with the PNG attached
- [ ] Desktop (no file share): downloads the PNG + copies the caption text
- [ ] No-canvas fallback still does the existing text/link share
- [ ] Brand fonts + logo render correctly (not system-font fallback)
- [ ] Card visually matches on-screen design (off-screen render ≠ distorted)

## Out of scope
- Journal / pregnancy size / bump card templates — S2.
- Portrait/story aspect ratios, server-side OG images.
