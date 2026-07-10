# SV2-S12 — Print-on-Demand (Lulu)

> **PROMOTED INTO STORYBOOK V2 (2026-06-22).** This is the "LULU work." See `planning.md` §6 and
> `lulu-print-handoff.md` (the external Lulu account/API/spec setup that BLOCKS implementation).
>
> **RECONCILED 2026-07-09 (`sv2-s9.6`).** Two things changed since this was written: **print is now
> pay-per-order with no tier gate**, and the **page-type list below is stale**. Header wins where the
> body disagrees.

**Status:** Not started — blocked on external Lulu setup
**Depends on:** v2 page types stable ✅ · Payments (Stripe merchant-of-record) · Lulu handoff answers
*(The old "scrapbook builder rewrite (S7–S10), shareable link, Payments S1 tier check" line is dead:
the rewrite shipped, share is independent, and there is no tier to check.)*

## Goal
Allow **any** user to order a physical printed copy of their storybook. We assemble the PDF, collect
payment via our own Stripe checkout, and POST a paid print job to Lulu.

---

## Decisions Made (Storybook S0, revised 2026-07-09)
- **Vendor:** Lulu (lulu.com) — print-on-demand, no inventory
- **Who can order:** ~~`plus` and `pro` users only~~ → **anyone. Pay-per-order, no tier gate**
  (decided 2026-07-09). There is no subscription; `users.tier` is vestigial and must not be read.
  A per-order charge already prices the product — a tier above it would buy the user nothing.
- **Multi-copy ordering:** Users must be able to order multiple copies (e.g., for grandparents)
- **Checkout:** ~~Lulu handles checkout (redirect, no Stripe on our side)~~ **→ CORRECTED (2026-07-01):
  Lulu's Print API checkout is *external* — the customer pays via our own **Stripe** checkout; we then POST
  a *paid* print job and Lulu auto-charges a company card. Print depends on Payments/Stripe. See `handoffs/`.**
- **Physical book is separate from AI credits** — ordering a print doesn't consume credits

> ⚠️ **Print needs its own Stripe checkout flow, distinct from the credit-pack one.** A print order is a
> **variable amount** (copies × unit price + shipping) and needs a **shipping address**; the credit/share
> SKUs are fixed-price digital goods with no address. Dropping the subscription made Payments S1/S2
> smaller but it did **not** hand print a reusable checkout — budget for a second `mode: 'payment'`
> flow here. Order value (~$30–40) puts the Stripe cut around 3.5–4%.

---

## Open Questions (resolve in S8 planning session before implementation)

### Lulu API
- [x] ~~Does Lulu's API support a redirect-to-checkout flow?~~ **ANSWERED 2026-07-01: no.** The Print API
      checkout is *external*. We collect payment via our own Stripe checkout and POST a **paid** print
      job; Lulu auto-charges our company card. This is why print depends on Payments. (Duplicate of the
      "Checkout" decision above — it was left open here by mistake.)
- [ ] What are the API authentication requirements? (OAuth? API key?)
- [ ] Does Lulu support white-labeling so the package doesn't arrive branded "Lulu"?
- [ ] Review Lulu API terms — restrictions on reselling or subscription-model apps?

### PDF Spec
- [ ] What trim size does Lulu require? **This doc says 6×9 here and 8×10 below — both are guesses.**
      Resolve via `lulu-print-handoff.md` Q8; don't hardcode until then.
- [ ] Bleed requirements? (typically 0.125" for print)
- [ ] Embedded fonts required? (jsPDF may need adjustment)
- [ ] Color profile — RGB or CMYK? jsPDF outputs RGB; Lulu may require conversion
- [ ] Minimum page count? A user with 2 chapters may fall below the minimum
- [x] ~~Does jsPDF produce print-quality output?~~ **Settled: OpenPDF, server-side.** See PDF Library below.

### UX / Order Flow
- [ ] How does multi-copy selection work? (quantity picker before redirect)
- [ ] Cover design — fixed template with baby name, photo upload, or illustrated options?
- [ ] Do we show estimated shipping cost + delivery time before redirect?
- [ ] Optional webhook from Lulu for order status / shipped notification?

---

## Rough Integration Sketch
1. User taps "Order a Printed Book" in storybook view — **any user; there is no tier gate** (2026-07-09)
2. User selects quantity (1, 2, 3, 5…)
3. Frontend calls backend endpoint to assemble the chapter PDF
4. User pays through **our own Stripe checkout** (payment + shipping address collected on our side)
5. Backend uploads the PDF to Lulu and **POSTs a paid print job** (Lulu auto-charges our company card)
6. Lulu prints + drop-ships to the customer
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

### ⚠️ Page types — THE BIG LIFT, and this list was stale
~~Chapter layout — two modes (event-anchored / time-period, AI paragraphs)~~ **DEAD.** Period chapters
were retired (migration V43) and AI paragraph generation was deleted (`sv2-s11`). A v2 book is an
ordered list of `layout_data` v2 **pages**, not chapters with `body` text.

**The server-side OpenPDF renderer must reproduce every page type the client already renders.** As of
2026-07-09 the dispatch in `Frontend/src/lib/storybookPdf.js` is:

| | |
|---|---|
| Named templates (10) | `moment-hero` (portrait + landscape), `letter`, `gallery`, `birth-day`, `people`, `family-tree`, `chapter_divider`, `prompts`, `bump`, `milestones` |
| Plus | a **`LayoutRenderer` fallback** for freeform pages (arbitrary block layout) |
| Plus | the **Cover**, which `storybookPdf.js` builds as **raw DOM**, not a canvas |

Do not hardcode from this table — **read the dispatch in `storybookPdf.js` at build time and match it.**
It has already drifted twice. The data-driven pages (`birth-day`, `people`, `family-tree`, `milestones`)
read live DB state via a `pageData` prop; the server renderer needs the same data.

**This is the main risk of the whole session.** Reproducing eleven client-side React canvases plus a
DOM-built cover as pixel-faithful 300 DPI server-side PDF is the bulk of the work — the Lulu API call
at the end is comparatively trivial. Scope L1 accordingly.

### Page ordering in final PDF
The book's page order (guided arc or freeform list). Chapter-era `sort_order` / anchor-week sorting
no longer applies.

### Trim size — OPEN, resolved by the Lulu handoff (Q8)
This doc contradicts itself: **6×9" in the cost table below, 8×10" in Image handling and here.**
Do **not** hardcode either. It is an open question answered by `lulu-print-handoff.md` Q8 against
Lulu's spec catalog. It affects every PDF layout decision — confirm before building the renderer.

---

## Sessions
This plan needs its own planning session before implementation to resolve the open questions above.
*(Renamed 2026-07-09 — these were "S8 Planning / S8 S1 / S8 S2", from before print was renumbered to
sv2-s12. The session map in `planning.md` §3 and `sv2-s9.6` both call them L0/L1/L2.)*

- **L0 Planning** — Research Lulu API auth, PDF spec, white-label; **confirm trim size** (`lulu-print-handoff.md`
  Q8); answer the open questions above. Blocked on the Lulu account existing.
- **L1 Backend** — Server-side PDF assembly (OpenPDF) + Lulu API integration + order submission, **plus a
  second variable-amount Stripe checkout** with a shipping address (the digital SKUs don't provide one).
  The eleven-canvas server-side render is the bulk of the work, not the Lulu call.
- **L2 Frontend** — "Order a Book" UI, quantity picker, checkout redirect, order confirmation.
