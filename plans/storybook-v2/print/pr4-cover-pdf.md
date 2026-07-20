# Print pr4 — Cover PDF

**Status:** Complete — built + verified 2026-07-17 (Michael confirmed the rendered wrap PDF; live render of
book 5 = 17.377×11.25in, correct spine, blank-spine-under-threshold). Cover photo crop standardized on 4:3
in the same session (see follow-up).
**Est:** ~1.5–2 hours · **Depends on:** pr3, **pr0** (real SKU) · **Blocks:** pr5
**Launch prompt:** `session-prompts.md` → pr4
**Read first:** `lulu-spec-handoff.md` (cover spec, Q13)

Lulu wants the **cover as a separate PDF** from the interior. Its dimensions depend on the page count (spine
width) and the product (`pod_package_id`), so this needs pr0's real SKU.

---

## What you're building

- A **cover PDF** generated the same way as the interior (headless Chrome over a print-view cover route, or
  an extension of the pr2 route) — front cover, back cover, and **spine**.
- **Spine width** = a function of page count + paper (Lulu provides a **cover-dimension calculation** given
  `pod_package_id` + page count; call it or use their published formula). Get the full wrap + bleed dims from
  the same source.
- Reuse the existing cover content: `storybookPdf.js` builds the cover as **raw DOM** (title, subtitle, cover
  photo) — render that into the cover route.

## ⚠️ Notes
- **Blocked on pr0** for the real `pod_package_id` and thus the exact spine/wrap math — don't hardcode dims.
- Spine text only makes sense above a page-count threshold; below it, spine may be blank (Lulu spec dependent).

## Decisions from pr0.5 (2026-07-16) — back cover + spine content (gap #11)
`storybookPdf.js` only builds the **front** cover (title, subtitle, cover photo). The wrap PDF also needs a
**back cover** and **spine text**, which no source currently provides. For v1:
- **Back cover** — no user-authored back-cover content exists; use a **simple branded/solid back** derived from
  the cover theme (e.g. background color/pattern, optional small CradleHQ mark). **Do not** invent a
  user-facing back-cover editor (unrequested feature — flag if we ever want one).
- **Spine text** — use the **book title** (same source as the front cover), rendered only **above Lulu's
  spine-text page-count threshold**; below it, leave the spine blank. Pull the threshold from Lulu's
  cover-dimension calc alongside the spine-width math.

## Done when
- [x] A separate cover PDF generates with correct front/back/spine at the SKU's wrap+bleed dims.
- [x] Spine width is computed from the actual page count (via Lulu's published formula), not hardcoded.

## Not this session
The interior (pr3) · uploading either file to Lulu (pr5). Cover file only.

## Build result (2026-07-17)

**Spine dims via Option A (pr4 planning, 2026-07-17):** Lulu's published softcover perfect-bound formula —
`spine = pages/444 + 0.06"` — where **444 is our SKU's paper PPI** (the `444` in `…080CW444G`; source:
help.api.lulu.com "How is spine width calculated?"). `PAPER_PPI`, `SPINE_PAD_IN`, and the 80-page
`SPINE_TEXT_MIN_PAGES` threshold are **named constants flagged to cross-check against Lulu's authoritative
cover-dimensions API in pr5** before real orders.

**Files:**
- `Frontend/src/components/PrintCoverPage.jsx` (new) — the `/print/cover/{token}` wrap route: one sheet,
  `back | spine | front` at wrap+bleed dims (`2·bleed + 2·trim + spine` wide × `trim + 2·bleed` tall). Front
  mirrors `BookCover.jsx` (3:4 cover canvas FIT to trim height, theme bg bleeds to the edge — same aspect
  handling as `PrintBookPage`). Back = branded solid from the theme (CradleHQ wordmark, pr0.5 gap #11). Spine
  = book title above the 80-page threshold, else blank. Reuses the interior's render token + `/print/payload/`
  endpoint; counts pages from `Σ chapter.pages`. Sets `data-print-ready` after fonts + cover image settle.
- `Frontend/src/App.jsx` — added the `/print/cover/{token}` pathname branch (mirrors `/print/book/{token}`).
- `PrintRenderService.java` — extracted a shared `render(...)` and added `renderCover` (kind `"cover"`).
- `PrintController.java` — added `POST /books/{bookId}/print/cover`.

**Geometry sanity check (deterministic):** pages 32→800 give spine 0.132"→1.862", wrap 17.38"→19.11" × 11.25";
canvas scale = 8.25·96/600 = 1.32 → 792×1056px = 8.25×11" exactly.

**To verify live:** `./start-services.sh` (brings up Docker/API/frontend/**sidecar**), then trigger a render for
an owned book: `POST /books/{bookId}/print/cover` with a session JWT → open the returned `pdfUrl`. Confirm the
wrap is one wide page, front matches the app cover, back is branded, and (≥80 pages) the spine shows the title.

**Live render done (2026-07-17):** book 5 (30 pages, midnight) → PDF MediaBox 1251.12×810pt = **17.377×11.25in**,
matching `spine = 30/444 + 0.06 = 0.128in` exactly; single wide page; spine blank (30 < 80, correct). Michael
eyeballed the wrap.

**Decisions from that review (2026-07-17):**
- **Spine-text threshold KEPT** (blank on thin books, title only when the spine is thick enough to be safe).
- **Cover photo crop = standardized on 4:3** → `pr4-followup-cover-photo-crop.md` (built same day, Needs
  Verification). Crop modal now locks to 4:3 for covers; on-screen hero + print slot both exactly 4:3.
