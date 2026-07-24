# Lulu Print-on-Demand — Setup Hand-off

**Status: Partially resolved (2026-07-11) — renderer + PDF spec answered from Lulu's public docs; the
account-level items (product/trim SKU, credentials, sandbox) still need an owner.** BLOCKS `sv2-print`.
**Audience:** whoever owns the Lulu account / vendor relationship (likely Michael, or a delegate).
**Created:** 2026-06-22
**Companion:** detailed spec in `plans/storybook-v2/print/print-full-plan.md`; placement in `../planning.md` §6;
**account-setup hand-offs in `plans/storybook-v2/handoffs/`**.

---

## ✅ RESOLVED 2026-07-11 — renderer decision + PDF spec (from Lulu's public docs)

**Renderer = headless Chrome, server-side (`page.pdf()`)**, not OpenPDF. It renders the real React canvas
components (no reimplementation of the eleven canvases — that whole "big lift" evaporates), emitting vector
text + native-res images. OpenPDF (the old plan) is dropped. See `print-full-plan.md` "Page types" box.

Lulu's documented file spec, which makes this clean:

| Spec | Answer | Consequence |
|---|---|---|
| **Color (Q10)** | **sRGB accepted** — printers prefer sRGB and convert to CMYK themselves | **No CMYK step / no Ghostscript.** Chrome outputs sRGB natively. |
| **Resolution (Q14)** | 300 PPI min (≤600) | Render at 300 |
| **Bleed (Q9)** | **0.125"/side** (page = trim + 0.25"); NO trim/bleed marks; 0.5" safety margin | CSS `@page` |
| **Fonts (Q11)** | Must be embedded or outlined | Chrome embeds automatically |
| **Cover (Q13)** | **Separate PDF** from interior; spine width depends on page count | Generate interior + a separate cover PDF |
| Other | Flatten transparency; single-page layout (no spreads) | Renderer notes |

Sources: Lulu "PDF Creation Settings" (help.lulu.com), Lulu API Getting-Started guide, api.lulu.com/docs.

**Still needs an owner with a Lulu account (account-level, not knowable from docs):**
- **Trim size / product → `pod_package_id` (Q8):** pick the product in Lulu's **Pricing Calculator** and
  **download the "Product Sheet"** (lists every option + its `pod_package_id`). Format is
  `[TrimSize].[Color].[Quality].[Binding].[Paper].[CoverFinish]`, e.g. `0800X1000.FC.STD.PB…` = 8×10"
  full-color perfect-bound. Photo baby book → **FC (full color)**; trim (8×10 / 8.5×8.5) is a cost/feel call.
- **Credentials + sandbox** (client id/secret; developers.lulu.com), **min/max page count (Q12)**, cover
  dimension/spine calc, white-label (Q15), and API terms (Q16).

---

## Why this doc exists

CradleHQ wants paid users to order a **physical printed copy** of their baby's storybook. We've
chosen **Lulu (lulu.com)** as the print-on-demand vendor — they print, ship, and take payment; we
assemble a print-quality PDF and submit the order.

Before any engineering session (`sv2-print-s1/s2`) can start, **a set of account- and policy-level
questions must be answered by a human with access to a Lulu account.** These can't be resolved by
reading our codebase — they depend on Lulu's current API, pricing, and terms. **This is an external
dependency: the implementing engineer is blocked until these answers come back.**

Treat this as a research + setup task to be **handed to someone who can create the Lulu account and
read their developer docs / terms.** It does not require touching CradleHQ code.

---

## What we need back (the deliverable)

A short written answer to each question below, plus credentials stored somewhere the backend can
reach them (env vars — see "Hand-back format"). Once these land, we unblock `sv2-print-plan`.

### A. Account & API access
1. **Create/confirm a Lulu account** and locate the **Print API** (Lulu has a developer/print API,
   sometimes branded "Lulu Direct" / "Print API"). Confirm it's available for our use case.
2. **Auth model:** Is it OAuth client-credentials, or a static API key? What are the token lifetimes?
   Is there a **sandbox / test environment** separate from production? (We want to integrate against
   sandbox first.)
3. **Credentials:** obtain client id/secret (or API key) for **both sandbox and production**.

### B. Checkout & payment flow (this decides our whole UX)

> **✅ Q4 RESOLVED (2026-07-01).** Lulu's Print API checkout is **"External to Lulu"** — **CradleHQ is the
> merchant of record.** We collect the customer's payment via **our own Stripe checkout**, then POST a paid
> print job; Lulu auto-charges a **company card on file** for print + ship (no payout bank account). This is
> the flagged "significant scope change": **print now depends on Payments/Stripe**
> (`plans/storybook-v2/payments/stripe-full-plan.md`). Evidence: Lulu's selling-tools comparison ("Checkout Experience:
> External to Lulu") + Lulu developer docs. **Account setup hand-offs: `plans/storybook-v2/handoffs/`.**

4. ~~Does Lulu support a redirect-to-hosted-checkout flow, or must we collect payment and POST a paid
   order?~~ **Resolved above — we collect via Stripe and POST paid orders.**
5. **Multi-copy orders** (e.g. 3 copies for grandparents): supported in one order? Quantity selected
   before or during Lulu checkout?
6. Can we show the user an **estimated price + shipping + delivery time before** the redirect (is there
   a pricing/shipping-cost API endpoint)?
7. Is there an **order-status / "shipped" webhook** we can subscribe to (optional, nice-to-have for
   notifying users)?

### C. Print spec (drives the PDF renderer — engineering is blocked on this)
8. **Trim size:** our drafts assumed **8×10"** (one note also says 6×9 was an earlier assumption).
   **Confirm the exact trim size from Lulu's spec catalog** and the product SKU/pod-package-id we'll
   target. Everything in the print renderer depends on this number.
9. [x] **Bleed:** **0.125"/side** (page = trim + 0.25"); no trim/bleed marks; 0.5" safety margin. *(Answered 2026-07-11.)*
10. [x] **Color profile:** **sRGB accepted** — Lulu prefers sRGB and converts to CMYK. No CMYK work on our side. *(Answered 2026-07-11.)*
11. [x] **Fonts:** **embedded or outlined.** Headless Chrome embeds fonts automatically. *(Answered 2026-07-11.)*
12. [ ] **Minimum & maximum page count** for the chosen product. (A user with only a couple of chapters may
    fall *below* the minimum — we may need filler/blank pages or a "not enough content yet" gate.) *Owner-dependent (per product).*
13. [x] **Cover spec:** **separate cover PDF** from interior; spine width depends on page count (Lulu provides
    a cover-dimension calc given `pod_package_id` + page count). *(Answered 2026-07-11; exact dims need the SKU.)*
14. [x] **Resolution:** **300 PPI min (≤600).** *(Answered 2026-07-11.)*

### D. Business / legal
15. **White-labeling:** does the shipped package arrive **unbranded** (not "Lulu")? Is a packing-slip /
    branding customization available? (We don't want the keepsake to feel third-party.)
16. **Terms of service:** any restrictions on **reselling**, on **subscription-model apps**, or on
    automated order submission via API? Confirm our use case is permitted.
17. **Economics sanity-check** (informational — see `print-full-plan.md` "Rough Economics"): confirm the
    actual print cost for the chosen product so we can set/verify any retail markup.

---

## Hand-back format (what unblocks engineering)

1. **This doc, filled in** — answers inline under each question (or a linked doc).
2. **Credentials in env**, matching how the backend reads config
   (`Backend/src/main/resources/application.properties` binds env vars; see `.env.example`). Proposed
   names (final names TBD with the engineer):
   ```
   LULU_API_BASE=...            # sandbox vs prod base URL
   LULU_CLIENT_ID=...
   LULU_CLIENT_SECRET=...       # or LULU_API_KEY=...
   LULU_POD_PACKAGE_ID=...      # the confirmed trim-size/product SKU
   ```
   Do **not** commit secrets — they go in the server `.env` / deployment secrets only.
3. A one-line **go/no-go** on the redirect-checkout assumption (Q4) and the trim size (Q8) — those two
   are the hard blockers; the rest can trickle in.

---

## Dependency note (for `../planning.md` / status tracking)

- **`sv2-print` is BLOCKED on this hand-off.** Engineering cannot finalize the print PDF renderer
  (trim size, bleed, color) or the order flow (redirect vs POST) without these answers.
- It is **also** gated on **Payments S1** (`plans/storybook-v2/payments/`, currently *Not started*) for real
  paid-tier gating — the `tier` column exists, but there's no upgrade path for users yet.
- **Owner: TBD** — assign someone with Lulu account access. Until assigned, print stays the last,
  blocked v2 workstream. Re-evaluate the rest of `../planning.md` §4 Q8 once answers return.
