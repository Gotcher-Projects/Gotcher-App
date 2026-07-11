# SV2-S12 — Print-on-Demand (Lulu)

> **PROMOTED INTO STORYBOOK V2 (2026-06-22).** This is the "LULU work." See `../planning.md` §6 and
> `lulu-spec-handoff.md` (the external Lulu account/API/spec setup that BLOCKS implementation).
>
> **RECONCILED 2026-07-09 (`sv2-s9.6`).** Two things changed since this was written: **print is now
> pay-per-order with no tier gate**, and the **page-type list below is stale**. Header wins where the
> body disagrees.

**Status:** Not started — blocked on external Lulu setup
**Depends on:** v2 page types stable ✅ · Payments (Stripe merchant-of-record) · Lulu handoff answers

> ## ⚠️ Renderer DECIDED (2026-07-11); slicing in progress
>
> The 15-vs-70h spread was one undecided question — **the renderer — and it's now decided: headless
> Chrome, server-side (`page.pdf()`).** It renders the **real React canvas components** (no reimplementation
> of the eleven canvases — the old "big lift" is gone), emitting vector text + native-res images.
> **OpenPDF is dropped.** Lulu's public docs also settled the PDF spec favorably: **sRGB accepted** (no
> CMYK step), 300 PPI, 0.125" bleed via CSS `@page`, fonts auto-embedded, separate cover PDF. Full detail +
> sources in `lulu-spec-handoff.md` → "✅ RESOLVED 2026-07-11".
>
> That collapses the estimate toward the **12–25h** end. Remaining before build: **(a)** the owner gets the
> Lulu account items (product/`pod_package_id`, credentials, sandbox, min page count — see the handoff),
> and **(b)** this plan gets **sliced into ≤2h sessions** (in progress — being moved to `print/` and split
> like the payments plans).
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
  a *paid* print job and Lulu auto-charges a company card. Print depends on Payments/Stripe. See `../handoffs/`.**
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
- [ ] What trim size does Lulu require? Still open — **owner picks the product** (`pod_package_id`) from
      Lulu's Pricing Calculator Product Sheet (`lulu-spec-handoff.md` Q8). Don't hardcode until then.
- [x] Bleed — **0.125"/side** (page = trim + 0.25"), no marks, 0.5" safety margin. *(Answered 2026-07-11.)*
- [x] Embedded fonts — **required**; headless Chrome embeds automatically. *(Answered 2026-07-11.)*
- [x] Color profile — **sRGB accepted** (Lulu converts to CMYK). No CMYK work on our side. *(Answered 2026-07-11.)*
- [ ] Minimum page count? Owner-dependent (per product) — a user with 2 chapters may fall below it.
- [x] ~~Does jsPDF produce print-quality output?~~ **Renderer = headless Chrome, server-side** (renders the
      real React components; vector text, native-res images, sRGB, bleed via CSS). OpenPDF dropped. See below.

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

### PDF renderer — DECIDED: headless Chrome, server-side (2026-07-11)
**Render the real React canvas components in headless Chrome and `page.pdf()`.** This reuses 100% of the
existing components (no fidelity gap by construction) and emits **vector text + images at native
resolution** — strictly better than any raster path, and better than reimplementing in a Java PDF library.
- **~~OpenPDF~~ — DROPPED.** The old plan (redraw eleven canvases + freeform + cover as Java draw calls,
  pixel-faithful at 300 DPI) was 40–70h and unnecessary once Chrome renders the components directly.
- **Output:** sRGB (Lulu accepts; Chrome native), 300 PPI, 0.125" bleed via CSS `@page`, fonts embedded
  automatically, transparency flattened, single-page layout, separate cover PDF.
- **Sub-decision deferred to build:** how Java drives Chrome — a **Node/Puppeteer sidecar** vs
  **Playwright-Java + a Chromium layer in the Docker image**. Decide when slicing L1.

### Image handling
**Do NOT use Cloudinary URL transformations** — the free tier has monthly credit limits.
Fetch raw upload URLs server-side. Phone uploads are typically 3000+ px wide — sufficient for 300 DPI at
the chosen trim size. **Under headless Chrome this argument holds** (images embed at native resolution);
the old raster pipeline would have defeated it by compositing photos into a low-res page image first.

### Page types — NO LONGER a reimplementation (headless Chrome renders the real components)
~~Chapter layout — two modes (event-anchored / time-period, AI paragraphs)~~ **DEAD.** Period chapters
were retired (migration V43) and AI paragraph generation was deleted (`sv2-s11`). A v2 book is an
ordered list of `layout_data` v2 **pages**, not chapters with `body` text.

**Under the headless-Chrome renderer we do NOT reproduce these page types — Chrome renders the actual React
components.** The old OpenPDF plan's "reproduce every canvas server-side" was the 40–70h risk; it's gone.
The client dispatch (`Frontend/src/lib/storybookPdf.js`, as of 2026-07-09) is still the reference for *what
pages exist*:

| | |
|---|---|
| Named templates (10) | `moment-hero` (portrait + landscape), `letter`, `gallery`, `birth-day`, `people`, `family-tree`, `chapter_divider`, `prompts`, `bump`, `milestones` |
| Plus | a **`LayoutRenderer` fallback** for freeform pages (arbitrary block layout) |
| Plus | the **Cover**, which `storybookPdf.js` builds as **raw DOM**, not a canvas |

**The real work now** is a **print-view route** that renders a full book (all pages, in order, at
trim+bleed dimensions) for Chrome to load — feeding the data-driven pages (`birth-day`, `people`,
`family-tree`, `milestones`) the same `pageData` (live DB state) they already take, and including the
cover. `LayoutRenderer` already dispatches every template + the freeform fallback and has no auth/edit
coupling, so the route is assembly, not reimplementation. The Lulu API call at the end is comparatively
trivial. **The main risk shifts to the headless-Chrome infra** (sidecar vs Playwright-Java) and print
conformance (bleed/DPI/fonts), not canvas fidelity.

### Page ordering in final PDF
The book's page order (guided arc or freeform list). Chapter-era `sort_order` / anchor-week sorting
no longer applies.

### Trim size — OPEN, resolved by the Lulu handoff (Q8)
This doc contradicts itself: **6×9" in the cost table below, 8×10" in Image handling and here.**
Do **not** hardcode either. It is an open question answered by `lulu-spec-handoff.md` Q8 against
Lulu's spec catalog. It affects every PDF layout decision — confirm before building the renderer.

---

## Sessions
Being sliced into ≤2h per-session files and moved to `print/` (like the payments plans). The old
L0/L1/L2 shape, updated for the headless-Chrome renderer:

*(Renamed 2026-07-09 — these were "S8 Planning / S8 S1 / S8 S2", from before print was renumbered to
sv2-s12. The session map in `../planning.md` §3 and `sv2-s9.6` both call them L0/L1/L2.)*

- **L0 Planning** — mostly resolved: renderer = headless Chrome, PDF spec answered (see above). Remaining is
  **owner-side**: create the Lulu account, pick the product/`pod_package_id` (Q8), get credentials + sandbox,
  confirm min page count / white-label / terms (`lulu-spec-handoff.md`).
- **L1 Backend** — (a) **headless-Chrome renderer** (sidecar vs Playwright-Java) + a **print-view route** that
  assembles the full book at trim+bleed from the real React components; (b) interior + separate **cover PDF**;
  (c) **Lulu OAuth + paid print-job submission**; (d) a **second, variable-amount Stripe checkout** with a
  shipping address (the fixed-price digital SKUs don't provide one). The canvas reimplementation is gone.
- **L2 Frontend** — "Order a Book" UI, quantity picker, address + checkout, order confirmation, min-page gate.
