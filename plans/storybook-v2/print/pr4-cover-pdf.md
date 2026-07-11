# Print pr4 — Cover PDF

**Status:** Not started
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

## Done when
- [ ] A separate cover PDF generates with correct front/back/spine at the SKU's wrap+bleed dims.
- [ ] Spine width is computed from the actual page count (via Lulu's calc), not hardcoded.

## Not this session
The interior (pr3) · uploading either file to Lulu (pr5). Cover file only.
