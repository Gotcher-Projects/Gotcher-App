# Lulu Print-on-Demand — Setup Hand-off

**Status: Hand-off — needs an owner. BLOCKS `sv2-print` (see `planning.md` §6).**
**Audience:** whoever owns the Lulu account / vendor relationship (likely Michael, or a delegate).
**Created:** 2026-06-22
**Companion:** detailed spec in `plans/storybook/sDeferred-print.md`; placement in `planning.md` §6.

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
4. Does Lulu support a **redirect-to-hosted-checkout** flow (user pays Lulu directly), **or** does the
   API require *us* to collect payment and POST a paid order? — Our plan assumes **redirect; no Stripe
   charge on our side for the print.** Confirm this is possible. *If Lulu requires us to collect
   payment, that's a significant scope change — flag immediately.*
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
9. **Bleed:** required bleed margin (commonly 0.125")?
10. **Color profile:** does Lulu require **CMYK**, or accept **RGB**? (Our PDF tooling outputs RGB by
    default; CMYK conversion is extra work — need to know up front.)
11. **Fonts:** must fonts be **embedded** in the PDF? (Affects our script/display fonts.)
12. **Minimum & maximum page count** for the chosen product. (A user with only a couple of chapters may
    fall *below* the minimum — we may need filler/blank pages or a "not enough content yet" gate.)
13. **Cover spec:** separate cover PDF vs interior PDF? Spine-width formula (depends on page count +
    paper)? Wrap/bleed dims for the cover?
14. **Resolution:** confirm **300 DPI** is the target for images at the chosen trim size.

### D. Business / legal
15. **White-labeling:** does the shipped package arrive **unbranded** (not "Lulu")? Is a packing-slip /
    branding customization available? (We don't want the keepsake to feel third-party.)
16. **Terms of service:** any restrictions on **reselling**, on **subscription-model apps**, or on
    automated order submission via API? Confirm our use case is permitted.
17. **Economics sanity-check** (informational — see `sDeferred-print.md` "Rough Economics"): confirm the
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

## Dependency note (for `planning.md` / status tracking)

- **`sv2-print` is BLOCKED on this hand-off.** Engineering cannot finalize the print PDF renderer
  (trim size, bleed, color) or the order flow (redirect vs POST) without these answers.
- It is **also** gated on **Payments S1** (`plans/payments/`, currently *Not started*) for real
  paid-tier gating — the `tier` column exists, but there's no upgrade path for users yet.
- **Owner: TBD** — assign someone with Lulu account access. Until assigned, print stays the last,
  blocked v2 workstream. Re-evaluate the rest of `planning.md` §4 Q8 once answers return.
