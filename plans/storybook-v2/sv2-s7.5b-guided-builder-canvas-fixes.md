# SV2-S7.5b — Guided builder & canvas fixes

**Status: Complete — all four fixes verified in-app by Michael (2026-07-01).** Frontend 331 tests + build
green. One separate issue surfaced during verification (Midnight dark-theme edit text is near-black) →
split into **sv2-s7.5e**, not part of this plan.
A bundle of **four small, independent** fixes found in s7b verification
(`sv2-s7b-verification-notes.md`), all in the builder / canvas render layer — efficient as one pass, but
**each can be split into its own plan** if preferred.
**Depends on:** sv2-s7b. No backend changes; all frontend.

---

## Fix 1 — Moment Hero doesn't fill the page (🟡 sizing) — ✅ DONE
Root cause (confirmed by Michael): the note card was `flex: 1`, so it ballooned to fill leftover height
while its text stayed put — a short note left a big empty cream box. Fix: note card now `flex: '0 1 auto'`
(hugs content, shrinks/clips only for very long notes), and two equal flexible spacers bracket the whole
composition so short content centres vertically instead of ballooning. Spacers collapse to 0 when content
is tall, so the header is never clipped. Shared canvas → applies in builder + LayoutRenderer + PDF.
**Verify:** a short-note pick page + "Happy First Birthday" look balanced (no empty box); a long note
still clips gracefully; check the PDF export matches.
**Problem:** the moment_hero (polaroid + note card) doesn't scale to fill the page; leaves dead space /
doesn't fit cleanly. Affects the 4 **pick** pages **and** the **Happy First Birthday** fill page.
**Cause:** `MomentHeroCanvas.jsx` uses fixed-px `photoW/photoH` + a flex column on the 600×800 virtual
canvas, so it doesn't adapt to the full page height.
**Approach:** make the layout fill the canvas height (relative/flex sizing for the polaroid + note card;
let the note card take remaining height). Verify against both portrait orientation and the PDF/read-only
path (MomentHeroCanvas is shared by builder + LayoutRenderer + storybookPdf).
**Files:** `MomentHeroCanvas.jsx`.

## Fix 2 — Double crop when uploading into a fixed-aspect slot (🔴 bug) — ✅ DONE (lean a)
PhotoTray now uploads the raw file (no orientation crop); the slot crop in `assignPhotoToSlot` shapes it
once. Removed the unused `openCropModal` import/ref. Improves freeform slot uploads too.
**Problem:** uploading a new photo into a slot (e.g. the square Trio+Note "Months 6–9" slot) first asks
for landscape/portrait, then re-crops to the slot shape anyway — pointless + confusing.
**Cause:** `PhotoTray.jsx:19` always runs `openCropModal` (orientation toggle) to make the upload blob;
then `ScrapbookBuilder.assignPhotoToSlot` runs `openSlotCropModal(url, slotAR)` — a second crop.
**Approach (lean a):** upload the **raw file** from the tray (skip the orientation crop) and let the
single slot crop (`openSlotCropModal`) shape it. (Alt b: pass the slot's `slotAR` into PhotoTray and crop
once there.) Confirm the upload endpoint accepts the raw file. Improves freeform slot uploads too.
**Files:** `PhotoTray.jsx` (`handleFileChange`); verify `ScrapbookBuilder.assignPhotoToSlot`.

## Fix 3 — Remove the per-page "Page bg" picker (🟡 cleanup) — ✅ DONE
Removed the Page-bg UI block + `setCurrentPageBg`. Render still reads `page.backgroundColor` as a
fallback so old data is honoured; nothing writes it anymore.
**Problem:** the Page-bg color picker is a no-op on almost all pages and Michael isn't a fan.
**Cause:** every custom canvas (letter, moment_hero, gallery, chapter_divider, bump, people,
family_tree, milestones, birth_day) paints its own `theme.bg`; only the generic Slot templates
(classic/spotlight/growth-spread/hands-feet/photo-*) honor `page.backgroundColor`.
**Approach:** remove the "Page bg" UI block + `setCurrentPageBg`; stop writing `backgroundColor`
(leave the field harmlessly in old data). Affects freeform too (acceptable — rarely used, mostly no-op).
**Files:** `ScrapbookBuilder.jsx` (Page-bg block ~731–753, `setCurrentPageBg`).

## Fix 4 — Letter hardcoded "A LETTER TO YOU" eyebrow (🔴 bug) — ✅ DONE
`LetterCanvas` takes an `eyebrow` prop (default "A Letter to You"). Guided pages pass their page label
via `chapter.anchorLabel` (gated on `anchorType === 'guided'`) from the builder + PDF; freeform keeps the
default. LayoutRenderer forwards an optional `letterEyebrow` (unused by freeform callers → default).
**Problem:** every `letter` page shows the fixed eyebrow "A LETTER TO YOU" — wrong on **"One Year of
You"** (confirmed) and the pregnancy **"A Letter Before You Arrived."**
**Cause:** `LetterCanvas.jsx:102` hardcodes the string.
**Approach:** add an `eyebrow` prop (default "A Letter to You"); pass the page's label/section from all
three call sites. In the builder pass the guided `eyebrow`/anchorLabel; in read-only/PDF pass
`chapter.anchorLabel`.
**Files:** `LetterCanvas.jsx`, `ScrapbookBuilder.jsx`, `LayoutRenderer.jsx`, `storybookPdf.js`.

---

## Testing
Per fix: moment_hero fills the canvas in builder + PDF; tray upload → single crop to the slot;
no Page-bg UI; letter eyebrow reflects the page on all three render paths. Run the full frontend suite +
a Vite build.
