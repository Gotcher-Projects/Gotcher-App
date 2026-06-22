# s7 — Shared Utilities / De-duplication

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** s1 (smaller surface)
**Source:** `branch-review.html` → Pass 2 (HIGH + MED)

> **IMPLEMENTED 2026-06-20.** All HIGH + MED items done (MED-7 dates landed earlier — see its section).
> `npm run test` green (208) + `vite build` clean. New shared modules:
> - `lib/storybookText.js` `cleanBodyText` — replaced the 3 copies (ScrapbookBuilder.cleanBody,
>   storybookGrouping.extractPieceText, storybookPdf classic-chapter) — **fixes the PDF blank-line bug**.
> - `lib/tiptap.js` `toTiptapDoc` is now the only copy (deleted the private one in storybookGrouping.js).
> - `lib/imageUtils.jsx` `uploadCroppedPhoto(onUpload, blob) → url` — folded the FormData boilerplate at
>   BumpDiary ×2, MemoriesTab ×3, BookCover, StorybookWizard.
> - `components/ui/PhotoPickerButton.jsx` — generalised BumpDiary's `PhotoPicker`; now used by BumpDiary
>   ×2 and MemoriesTab ×4 (self-manages crop-modal cleanup; removed the per-site cancelCropRef/inputRef).
> - `lib/bookCanvas.jsx` `useCanvasScale(ref)` — replaced the identical ResizeObserver/scale effect in
>   ScrapbookBuilder + LayoutRenderer.
> - `lib/storybookPdf.js` `captureElement(el, bgColor)` — folded the 3 html2canvas copies; CANVAS_W/H now
>   imported from `lib/bookCanvas` (local re-declare gone).
> - `components/ui/TwemojiImage.jsx` — shared SVG-with-native-fallback; PregnancyHome `SizeIcon` and
>   BumpCard `SizeEmoji` now thin wrappers around it.
>
> **Deviation from the photo plan (HIGH-3):** `PhotoPickerButton` was applied only to the standard
> text-button pickers (BumpDiary, MemoriesTab). BookCover (floating overlay button), StorybookWizard
> (per-item upload w/ uploadingItems state) and PhotoTray (bottom-sheet upload label) have bespoke
> triggers that don't fit the component, so they kept their triggers and got `uploadCroppedPhoto` only.
> **PhotoTray was left fully as-is** — its upload needs the whole response (`{key,url,label}`), not just
> `url`, so `uploadCroppedPhoto` didn't fit; the FormData there is a deliberate one-off.
>
> **Pending:** manual smoke — crop+upload on all surfaces (journal, first-times, bump add/edit, cover,
> wizard per-item, chapter PhotoTray), publish a chapter + PDF export (check classic-chapter spacing),
> pregnancy home + bump-card size icons, builder drag/scale + LayoutRenderer page view.

---

## Goal
Collapse the HIGH and MED duplication clusters into shared helpers and point all call sites at them.
The HIGH items are divergence-bug fixes (copies that can silently drift).

## Scope
### HIGH
- **Single `toTiptapDoc`** — delete the private copy in `lib/storybookGrouping.js`; import from
  `lib/tiptap.js`. Verify output shape matches what `buildGroupedLayoutData` expects.
- **`cleanBodyText(s)`** — one helper (in `lib/tiptap.js` or new `lib/storybookText.js`):
  `(s||'').replace(/\[PHOTO:[^\]]+\]/g,'').replace(/\n{3,}/g,'\n\n').trim()`. Replace the 3 copies in
  `ScrapbookBuilder.cleanBody`, `storybookGrouping.extractPieceText`, `storybookPdf` (fixes the PDF
  copy that skips the blank-line collapse).
- **Photo pick→crop→upload** — extract a shared `<PhotoPickerButton onPicked={({blob,orientation})}/>`
  (generalise BumpDiary's local `PhotoPicker`) into `components/ui/`, plus a
  `uploadCroppedPhoto(onUpload, blob) → url` helper in `lib/imageUtils.jsx`. Switch the ~5 call sites
  (BumpDiary, MemoriesTab ×4, BookCover, StorybookWizard).

### MED
- Import `CANVAS_W`/`CANVAS_H` from `lib/bookCanvas` in `storybookPdf.js` (drop local re-declare).
- `captureElement(el, bgColor)` helper in `storybookPdf.js` — fold the 3 html2canvas boilerplate copies.
- `useCanvasScale(ref) → { containerSize, scale }` (in `lib/bookCanvas.jsx` or `lib/fitText.js`);
  use in `ScrapbookBuilder` and `LayoutRenderer`.
- Consolidate date formatters into `lib/formatting.js`: a TZ-safe
  `formatDate(value, { style, withYear })`; fix `formatEntryDate` to anchor the time. Repoint the ~6
  local copies (StorybookWizard, MemoriesTab ×2, BumpCard, PregnancyHome, BookCover/storybookPdf).
- `<TwemojiImage emoji label className/>` shared component; use in PregnancyHome + BumpCard.

## Out of scope (→ s10)
LOW items: `SlotImage`, `mountModal`, `ConfirmDeleteButton`, FONT_CLASS_MAP colocation.

## Tests
Tests for the new utilities (`cleanBodyText`, `formatDate`) land in **s8** alongside the other
frontend lib coverage. Run the existing suite here to catch regressions.

## Files
- `Frontend/src/lib/tiptap.js` · `storybookGrouping.js` · `imageUtils.jsx` · `bookCanvas.jsx` ·
  `fitText.js` · `formatting.js` · `storybookPdf.js` · `twemoji.js`
- `Frontend/src/components/ui/PhotoPickerButton.jsx` (new) · `TwemojiImage.jsx` (new)
- Call sites: BumpDiary, MemoriesTab, BookCover, StorybookWizard, PregnancyHome, BumpCard, ScrapbookBuilder, LayoutRenderer

## Verification
1. `npm run test` green.
2. Manual: photo crop+upload works on all 5 surfaces; PDF export still renders; pregnancy size icons show.

---

# Research (2026-06-20) — current-state findings

Read-only pass to de-risk implementation. Exact `file:line` anchors below were accurate as of this
date on branch `pregnancy-updates`; re-confirm before editing. Note files are `.js`/`.jsx` (the s7
header's `storybookText.js` / `bookCanvas.jsx` names are proposals, not existing files).

## HIGH-1 · `toTiptapDoc` duplication — LOW RISK
- **Canonical:** `lib/tiptap.js:77` `toTiptapDoc(content)` → `isTiptapDoc(content) ? content : stringToTiptapDoc(content)`.
  `stringToTiptapDoc` at `tiptap.js:59`. Already imported & used by `RichTextEditor.jsx:3,14`,
  `ScrapbookBuilder.jsx:18` (and `contentToPlainText`).
- **Private copy:** `lib/storybookGrouping.js:162` `function toTiptapDoc(text)` — used only at
  `storybookGrouping.js:198` inside `buildGroupedLayoutData` as `toTiptapDoc(extractPieceText(content, piece))`.
- **Only behavioural delta = empty-paragraph shape:**
  - grouping copy (empty): `{type:'doc',content:[{type:'paragraph',content:[]}]}`
  - tiptap copy (empty, via stringToTiptapDoc): `{type:'doc',content:[{type:'paragraph'}]}` (no `content` key)
  - Non-empty paragraphs are identical (`{type:'paragraph',content:[{type:'text',text:p.trim()}]}`).
  - `extractPieceText` always returns a **string**, so the canonical `toTiptapDoc` takes the
    `stringToTiptapDoc` branch — safe swap. Both render identically through
    `renderContentHTML`/`generateHTML`. **Action:** delete private copy, add `toTiptapDoc` to the
    existing `import { ... } from './tiptap'` (currently grouping imports `contentToPlainText` in the
    test only; the lib file does not yet import from tiptap — add the import).
- Existing tests already lock the canonical shape: `test/tiptap.test.js` (toTiptapDoc/stringToTiptapDoc)
  and `test/storybookGrouping.test.js` (buildGroupedLayoutData with `[PHOTO:x]` body). Run both.

## HIGH-2 · `cleanBodyText` — confirms the PDF divergence bug
Three copies of the body-cleanup regex; the canonical form is
`(s||'').replace(/\[PHOTO:[^\]]+\]/g,'').replace(/\n{3,}/g,'\n\n').trim()`:
- `ScrapbookBuilder.jsx:35-37` `cleanBody(body)` — **canonical** (has blank-line collapse). Call sites:
  `:641` (`aiBody`), `:746`, `:761` (fallback `cleanBody(mem?.rawText||'')`).
- `storybookGrouping.js:159` inside `extractPieceText` body branch — **canonical** (has collapse).
- `storybookPdf.js:273` `(chapter.body||'').replace(/\[PHOTO:[^\]]+\]/g,'').trim()` — **BUG: missing
  `.replace(/\n{3,}/g,'\n\n')`** → classic (non-v2) PDF chapters keep 3+ blank lines, then
  `.split(/\n{2,}/)` at `:275` makes extra empty `<p>` tags. Extracting the shared helper fixes this.
- **Action:** new `cleanBodyText(s)` (proposed `lib/storybookText.js`, or add to `tiptap.js`). Repoint
  all three. Keep `extractPieceText`'s piece routing (title/caption/pullQuote pass through untouched —
  only the `body` branch calls the helper). Test lands in s8 but `storybookGrouping.test.js:83-85`
  already asserts the collapse for `extractPieceText`.

## HIGH-3 · Photo pick→crop→upload — two helpers, ~7 call sites
The cluster is really **two** concerns; extract both:
1. **Pick→crop button** `<PhotoPickerButton onPicked={({blob,orientation})=>…}>` — generalise
   `BumpDiary.jsx:17-57` `PhotoPicker` (native `pickPhoto()` → fallback hidden `<input accept="image/*">`
   → `openCropModal` → `onCropped({blob,orientation})`, with `cancelCropRef` cleanup). Note S5 added the
   non-image guard inside `openCropModal`, so the button stays thin. The BumpDiary version takes
   `cancelCropRef` + `children` (button label) — keep that API, optionally manage the ref internally.
2. **Crop→upload** `uploadCroppedPhoto(onUpload, blob) → url` — every site does the same 4 lines:
   `const form=new FormData(); form.append('file', blob, 'photo.jpg'); const res=await onUpload(form); return res.url;`
   (see `BumpDiary.jsx:95-100`).
- **Call sites to switch (7, not 5):**
  - `BumpDiary.jsx` AddBumpForm (`:60`, upload `:95-100`) + BumpEntry (`:175`, upload `:219`)
  - `MemoriesTab.jsx` — inline pick+crop at `:209-211`, `:226-230`, `:299-301`, `:316-320`, `:509-511`,
    `:526-530`, `:684-686`, `:701-705` (journal + first-times, add + edit → ~4 logical surfaces, 8 raw
    inlines); upload via `apiUpload('/upload?context=journal'…)` at `:143` and `onUpload` props.
  - `BookCover.jsx:63` (`apiUpload('/baby-profile/cover-photo', form)`)
  - `StorybookWizard.jsx:126` (`onUpload(form)`)
  - `PhotoTray.jsx:28` (`apiUpload('/storybook/${chapterId}/chapter-photos', form)`) — not in the s7
    header's list but identical shape; consider including.
- **Watch:** upload endpoints differ per site (`onUpload` prop vs direct `apiUpload(path)`), so
  `uploadCroppedPhoto` must take the upload fn, not a path. Orientation handling: most sites store
  `cropped.orientation || 'portrait'`.

## MED-4 · `CANVAS_W`/`CANVAS_H` re-declare — trivial
- Source of truth: `lib/bookCanvas.jsx:32-33` (`export const CANVAS_W=600; CANVAS_H=800;`), also
  `BASE_FONT`. Consumers already import: `LayoutRenderer.jsx:3`, `ScrapbookBuilder.jsx:20`,
  `test/bookCanvas.test.js:6-7`.
- Local re-declare: `storybookPdf.js:9-10`. **Action:** `import { CANVAS_W, CANVAS_H } from '@/lib/bookCanvas'`,
  delete the two `const`s. (storybookPdf is a `.js` importing a `.jsx` — already done for other libs, fine.)

## MED-5 · `captureElement(el, bgColor)` — fold 3 html2canvas calls
All in `storybookPdf.js`. Shared `html2canvas` options:
`{ useCORS:true, allowTaint:false, scale:2, width:CANVAS_W, height:CANVAS_H, backgroundColor, logging:false, x:0, y:0 }`
then `canvas.toDataURL('image/jpeg', 0.92)`.
- `captureComponent` `:67` — full options; **preceded by** a 400ms ResizeObserver settle + `document.fonts.ready`
  + per-`<img>` load wait + 100ms (`:51-65`).
- `captureCoverElement` `:173` — same options; preceded by `fonts.ready` + img wait + 100ms (no 400ms).
- classic-chapter inline `:283` — `{useCORS:true, scale:2, width, height, backgroundColor, logging:false, x:0, y:0}`
  (omits explicit `allowTaint:false`; default is false → equivalent); preceded by `fonts.ready` + 100ms (no img wait).
- **Action:** `captureElement(el, bgColor)` = (img-load wait + 100ms settle + html2canvas with the shared
  options + return jpeg dataURL), assuming `el` already in DOM. Leave the **React-specific 400ms + render**
  in `captureComponent` before it calls the helper. Adding the img-wait to the classic path is harmless.
  `FONT_CLASS_MAP` (`:18-26`) is **out of scope (s10)** — leave it.

## MED-6 · `useCanvasScale(ref)` — effect is byte-identical
- `LayoutRenderer.jsx:7-22` and `ScrapbookBuilder.jsx:581-615` both have:
  `const [containerSize,setContainerSize]=useState(0); useEffect(()=>{ ResizeObserver → setContainerSize(entries[0].contentRect.width); observe(ref); return disconnect },[]); const scale = containerSize>0 ? containerSize/CANVAS_W : 1;`
- **Action:** `useCanvasScale(ref) → { containerSize, scale }` (proposed `lib/bookCanvas.jsx` so it can
  read CANVAS_W locally; it'd make bookCanvas a hook-exporting `.jsx`, already is). Both components keep
  their own `containerRef`. Test setup already stubs ResizeObserver (`test/setup.js:7-15`, reports
  width 600), so render-smoke stays green.

## MED-7 · Date formatters — ✅ IMPLEMENTED 2026-06-20 (done ahead of the rest of s7)
**Decision:** noon anchor + `formatDate(value, { style:'long'|'short', withYear:true })`, locale fixed to
`'en-US'`. Scope widened per request to **every** display-date formatter app-wide (not just
storybook/pregnancy). What shipped:
- `lib/formatting.js`: added `toLocalDate` (date-only `YYYY-MM-DD` → `T12:00:00` anchor; timestamps/Date
  pass through), `formatDate(value,{style,withYear})`, `formatMonthYear(value)` (grouping headers);
  `formatEntryDate` is now a thin alias → `formatDate` (fixes the `lib/pdf.js` TZ off-by-one).
- Repointed (locals deleted or reduced to one-line delegates): `BumpCard`, `PregnancyHome`, `BookCover`,
  `storybookPdf.js`, `StorybookWizard`, `MemoriesTab` (`shortDate`, month-group label → `formatMonthYear`,
  `fmtDate`), `AppointmentTab`, `DashboardTab`, `SleepTab`, `DiaperTab`, `FeedingTab`, `StorybookTab`.
- Verified: only `toLocaleDateString` left in the codebase is inside `formatting.js`. `toLocaleTimeString`
  (time-of-day) and date arithmetic deliberately untouched. New `test/formatting.test.js` (12 cases) +
  full suite green (208) + `vite build` clean. **Note:** s8's planned `formatDate` test now exists here —
  s8 can skip it.

### (original notes) consolidate + fix `formatEntryDate` TZ bug
- **THE BUG:** `lib/formatting.js:2` `formatEntryDate` = `new Date(date).toLocaleDateString('en-US',{month:long,day:numeric,year:numeric})`.
  For a date-only string (`'2026-04-01'`) `new Date()` parses as **UTC midnight** → renders the previous
  day in any UTC-negative zone. Used by `lib/pdf.js:122,142,203,236` (journal entry dates on the PDF).
  Fix = anchor date-only strings to local noon before formatting.
- **The ~6 storybook/pregnancy display copies** (all already anchor, mostly to `T12:00:00`, so they're the
  *correct* behaviour to centralise):
  - `BumpCard.jsx:21-25` `formatDate` — `+'T12:00:00'`, `undefined` locale, long month, withYear.
  - `PregnancyHome.jsx:128` — `+'T00:00:00'`, `'en-US'`, long, withYear.
  - `BookCover.jsx:15` — `+'T12:00:00'`, `'en-US'`, long, withYear (the "Born …" subtitle).
  - `storybookPdf.js:95` — duplicate of BookCover's subtitle (same string).
  - `StorybookWizard.jsx:19-21` — `+'T12:00:00'`, `'en-US'`, **short** month, withYear.
  - `MemoriesTab.jsx:591` `fmtDate` — `+'T12:00:00'`, `undefined`, long, withYear.
  - `MemoriesTab.jsx:88-90` `fmtMonthDay` (`new Date(raw)`, short, **no year**) and `:102-104`
    (long month + year only) — these use **bare `new Date(raw)`** → same TZ bug as formatEntryDate.
- **Inconsistencies to decide:** locale `'en-US'` vs `undefined` (device locale); noon vs midnight anchor
  (noon is safest — survives ±12h zones). Proposed `formatDate(value, { style:'long'|'short', withYear:true })`:
  detect date-only (`/^\d{4}-\d{2}-\d{2}$/`) → append `T12:00:00`; pass-through full timestamps; pick
  Intl opts from `style`/`withYear`. **Out of scope:** the tracking tabs (Feeding/Sleep/Diaper/Appointment/
  Dashboard) format real timestamps *with* time and are a different concern — leave them.
- Test for `formatDate` lands in s8; `formatEntryDate` currently has no direct test — add one when fixed.

## MED-8 · `<TwemojiImage>` — two near-identical copies
- `lib/twemoji.js` already exports `twemojiCode` + `twemojiSrc(emoji)` (with tests, `test/twemoji.test.js`
  referenced in s8). The duplication is the **fallback `<img onError→native glyph>` wrapper**:
  - `PregnancyHome.jsx:17-30` `SizeIcon({emoji,label})` — `className="mx-auto mb-4 h-28 w-28"`, big native
    fallback (`text-7xl`), `alt={label}`.
  - `BumpCard.jsx:7-19` `SizeEmoji({emoji,label})` — `className="inline-block w-5 h-5 align-text-bottom"`,
    `aria-hidden`, inline native fallback.
- **Action:** `<TwemojiImage emoji label className />` (new `components/ui/TwemojiImage.jsx`) carrying the
  `useState(failed)` + `onError` fallback; the two sites differ only by `className` and the native
  fallback wrapper — pass `className` and keep a sensible default span fallback. Minor a11y divergence
  (`alt` vs `aria-hidden`) — standardise on `alt=""`+`aria-hidden` for decorative inline, `alt={label}`
  for the hero; expose via prop.

## Suggested order (land + smoke in two passes)
1. **Pass A (HIGH):** HIGH-1, HIGH-2 (carries the PDF bug fix), HIGH-3. Smoke: crop+upload on all
   surfaces, publish a chapter, export PDF (check classic-chapter spacing specifically).
2. **Pass B (MED):** MED-4→8. Smoke: book builder drag/scale, LayoutRenderer page view, PDF export again,
   pregnancy home + bump card icons, bump/wizard/memories date strings.

Run `npm run test` after each pass (existing suites guard tiptap, grouping, bookCanvas, pregnancy,
renderSmoke). New unit tests for `cleanBodyText`/`formatDate` are deferred to **s8**.
