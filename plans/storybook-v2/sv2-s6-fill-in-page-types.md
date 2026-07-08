# SV2-S6 — Fill-in Page Types (for the guided book)

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished).** (implemented 2026-06-27). Built as builder-pickable templates:
- **chapter_divider** → `ChapterDividerCanvas` (editable label/title/subtitle + decoratives)
- **prompts** ("All About You") → `PromptsCanvas` (fixed preset labels + editable values)
- **bump** → `BumpCanvas` (2-up, editable per-photo week → auto size tag via `sizeForWeek`, + note)
- **growth-spread** + **hands-feet** → generic-block templates (reuse `renderBlocks`, no custom renderer)
All wired into builder/read/PDF (+ TemplateSheet thumbs for the custom renderers); FE build + 248 tests pass.
Verify each in-app (add via the builder's "Change layout" picker) + a PDF export, then mark Complete.
**Depends on:** the shipped page renderers (Letter s1, Birth s2, People s3, Gallery/Moment-Hero) +
**sv2-s5 Family Tree**. Build **before sv2-s7** (the guided fill-in shell consumes these).
**Reference:** `planning.md` 2026-06-27 direction update; mockups `mockups/s6-guided-first-year-book.html`
+ `mockups/s6-guided-pregnancy-first-year-book.html` (the authoritative page list).
**Page-design mockup:** `mockups/s6-fill-in-page-types.html` — full 600×800 designs of the 5 new page
types (chapter divider, month-by-month growth, "All About You" prompts, hands & feet, bump page).
Authoritative for how each page looks.

---

## Why this exists

The guided fill-in book (sv2-s7) arranges a fixed sequence of designed pages. Most page types already
exist as scrapbook templates, but the default arc (the two mockups) needs a few **new fill-in page
types** that don't exist yet. This session builds them as renderers/templates in the book canvas (the
same pattern as Letter/BirthDay/People), so the shell can just place them.

---

## Post-baseline fixes & follow-ups (2026-06-27, from first in-app test)
- ✅ **Bump week field couldn't be edited** — `BumpCanvas` defined its photo column as a *nested
  component* (`<PhotoColumn/>`), so each render gave it a new identity → React remounted the subtree →
  the week field's Tiptap editor lost focus. Fixed: call it as a plain function (`renderPhotoColumn`).
- ✅ **"All About You" fields weren't discoverable** — empty prompt slots were a bare underline; now
  the builder shows a dashed "+ Tap to add" field (highlight colour). Published/PDF keeps a clean underline.
- ✅ **Bump page redesign** — the on-photo size **pill** kept clipping in the PDF (html2canvas mis-places
  absolute `bottom` inside `flex:1` heights). Removed it. Photos now have a **fixed height** (`PHOTO_H`,
  `object-fit:cover`) and the size comparison is a **plain caption under each photo**: "Week N" (editable) +
  *"you were the size of a … 🍈"* (auto). No overlay → nothing to clip. See [[feedback_html2canvas_limitations]].
- ✅ **Generic templates renamed** — "Months 0–3" → **"Trio + Note"**, "Hands & Feet" → **"Pair + Caption"**
  (ids unchanged). They read as neutral reusable layouts in the scrapbook picker; the guided book (sv2-s7)
  applies the specific "Months 0–3 / Hands & Feet" framing as arc config, not the template.
- ✅ **Drop-cap on fill templates** — short title/caption text was getting the journal drop-cap (giant first
  letter). Suppressed at **render time** keyed on templateId (`DROP_CAP_FREE_TEMPLATES` in `bookCanvas.jsx`),
  so it fixes already-saved pages too (per-block flags only fix newly-added pages).
- 📝 **FOLLOW-UP (chapter divider icon):** users want to **change the chapter-divider icon** (currently a
  fixed 🌿). Defer to a follow-up session — likely a small icon picker on the divider page (and feeds the
  guided-book arc config in sv2-s7). Not built yet.
- 📝 **FOLLOW-UP (s7 framing):** the specific page labels/prompts ("Months 0–3", "Hands & Feet", prompt
  labels, chapter titles) should live in the **guided-book arc config (sv2-s7)**, with these page types
  staying generic.

## Scope — the page types to build

1. **Chapter-divider page** (`ChapterDividerPage.jsx`) — "CHAPTER N" label, icon badge, title, italic
   subtitle, html2canvas-safe floating decoratives (absolutely-positioned spans, no pseudo-elements).
2. **"Month-by-Month" growth spread** — a quarterly spread (Months 0–3 / 3–6 / 6–9 / 9–12) with ~3
   larger photos + a note. **May reuse the existing photo-grid template** with a caption zone rather
   than a net-new renderer — evaluate at build.
3. **Prompt / fill-in pages** — simple labeled text pages: "All About You" (nickname, favourites, what
   makes you laugh…) and "Your Hands & Feet". Likely a light text-template variant with preset labels.
4. **Bump page** — a 600×800 wrapper around a bump photo + caption, with the **auto week→size tag**
   layered on the photo (uses the shipped 37-row size dataset). Feeds the sv2-s8 pregnancy chapter.

Each follows the data-driven / fill pattern already established: a template in `storybookTemplates.js`
+ a renderer dispatched in ScrapbookBuilder / LayoutRenderer / storybookPdf (+ a TemplateSheet thumb).

---

## Out of scope
- The guided book shell / arc config (sv2-s7).
- Any auto-derivation (dropped — the book is pre-designed fill-in).

---

## Decisions locked (2026-06-27)
1. **Growth spread:** ✅ **reuse the photo-grid template** + a caption/note zone (not a purpose-built renderer).
2. **Prompt pages:** ✅ **fixed preset labels** (we choose & lock them); configurable slots deferred to scrapbook.
3. **Bump page:** ✅ **2-up** — one reusable template holding **two bump photos + a note**, each photo carrying
   a small **auto week→size tag** (light pill, bottom-left; shows only when the photo has a `week`). This
   matches what the 30-page default already commits to: the guided book uses this template **twice** —
   "The Bump — Early Days" (e.g. wk 14/22) and "The Bump — Full Bloom" (e.g. wk 30/38) — so a normal book
   curates to **~4 bump photos**. **Not** a single full-bleed hero and **not** a 6-up grid. The earlier
   standalone hero mock was reconciled to this 2-up.

---

## Verification
1. Each new page type renders on screen and in PDF (html2canvas-clean) at 600×800.
2. The growth spread holds 3 photos + a note without overflow.
3. The bump page shows the size tag only when the photo has an associated week.
4. Frontend build + tests green.
