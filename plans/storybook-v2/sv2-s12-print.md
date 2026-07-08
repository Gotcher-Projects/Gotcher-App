# Deferred — Print-on-Demand (Lulu)

> **PROMOTED INTO STORYBOOK V2 (2026-06-22).** This is the "LULU work." It's now the `sv2-print`
> workstream — see `plans/storybook-v2/planning.md` §6 (placement + scope changes) and
> `plans/storybook-v2/lulu-print-handoff.md` (the external Lulu account/API/spec setup that BLOCKS
> implementation). This file remains the detailed spec; the decisions below are still valid. Scope
> grew: the print renderer must now reproduce **all v2 page types** (Letter/BirthDay/People/
> MomentHero/Gallery/ChapterDivider/Bump) at 300 DPI server-side, not just legacy scrapbook layouts.

**Status:** Not started (deferred → folded into v2 as `sv2-print`, still blocked on external setup)
**Branch:** `storybook-print`
**Depends on:** the scrapbook builder rewrite (S7–S10), shareable link (deferred), Payments S1 (tier check)

## Goal
Allow paid users to order a physical printed copy of their storybook via Lulu's API.
Lulu handles printing, shipping, and payment — we handle PDF assembly and order submission.

---

## Decisions Made (Storybook S0)
- **Vendor:** Lulu (lulu.com) — print-on-demand, no inventory
- **Who can order:** `plus` and `pro` users only
- **Multi-copy ordering:** Users must be able to order multiple copies (e.g., for grandparents)
- **Lulu handles checkout:** User is redirected to Lulu's hosted checkout — no Stripe charge on our side for print orders
- **Physical book is separate from AI credits** — ordering a print doesn't consume credits

---

## Open Questions (resolve in S8 planning session before implementation)

### Lulu API
- [ ] Does Lulu's API support a redirect-to-checkout flow, or does it require us to collect payment and POST an order?
- [ ] What are the API authentication requirements? (OAuth? API key?)
- [ ] Does Lulu support white-labeling so the package doesn't arrive branded "Lulu"?
- [ ] Review Lulu API terms — restrictions on reselling or subscription-model apps?

### PDF Spec
- [ ] What trim size does Lulu require? (6×9 is assumed but needs confirmation)
- [ ] Bleed requirements? (typically 0.125" for print)
- [ ] Embedded fonts required? (jsPDF may need adjustment)
- [ ] Color profile — RGB or CMYK? jsPDF outputs RGB; Lulu may require conversion
- [ ] Minimum page count? A user with 2 chapters may fall below the minimum
- [ ] Does jsPDF produce print-quality output, or do we need a different PDF library?

### UX / Order Flow
- [ ] How does multi-copy selection work? (quantity picker before redirect)
- [ ] Cover design — fixed template with baby name, photo upload, or illustrated options?
- [ ] Do we show estimated shipping cost + delivery time before redirect?
- [ ] Optional webhook from Lulu for order status / shipped notification?

---

## Rough Integration Sketch
1. User taps "Order a Printed Book" in storybook view (paid users only)
2. User selects quantity (1, 2, 3, 5…)
3. Frontend calls backend endpoint to assemble the chapter PDF
4. Backend uploads PDF to Lulu via API, receives checkout URL
5. User is redirected to Lulu hosted checkout (payment + shipping address)
6. Lulu handles fulfillment
7. (Optional) Lulu webhook → notify user when order ships

---

## Rough Economics
| Item | Estimate |
|---|---|
| Lulu print cost (6×9 softcover, ~40 pages) | ~$8–12/copy |
| Suggested retail (Lulu sets price or we set markup) | $30–45/copy |
| Gross margin per copy | ~$20–35 |

---

## Decisions Made (S2 Planning, 2026-05-03)

### PDF Library
**OpenPDF** — open-source iText 2 fork, Apache-licensed, Spring Boot compatible.
No commercial license concerns. Replace current client-side jsPDF entirely for the print flow.
Alternative: Apache PDFBox (more low-level, more work — use only if OpenPDF falls short).

### Image handling
**Do NOT use Cloudinary URL transformations** — the free tier has monthly credit limits.
Fetch raw upload URLs server-side. Phone uploads are typically 3000+ px wide — sufficient
for 300 DPI at 8×10" print size. No transformation credits consumed.

### Chapter layout — two modes
See `plans/storybook/design-decisions.md` for full layout spec.
- **Event-anchored chapters:** title + 2-3 AI paragraphs + photo from anchor entry
- **Time-period chapters:** chronological event stitching — each event cluster (journal entry,
  first time, milestone) gets its own section with inline photos. NOT a summary + photo grid.
  Photos are central — the layout should foreground them.

### Chapter ordering in final PDF
Default: chronological (event chapters by anchor week, period chapters by period_start_weeks).
`sort_order` column overrides when set. User-controlled ordering UI is a separate future session.

### Trim size
8×10" assumed — **must be confirmed against Lulu's spec catalog in S8 planning session.**
This affects all PDF layout decisions; confirm before building the renderer.

---

## Sessions
This plan needs its own planning session before implementation to resolve the open questions above.
- **S8 Planning** — Research Lulu API checkout flow, PDF spec, white-label options; confirm trim size; make decisions
- **S8 S1** — Backend: server-side PDF assembly (OpenPDF), Lulu API integration, order submission
- **S8 S2** — Frontend: "Order a Book" UI, quantity picker, redirect, order confirmation
