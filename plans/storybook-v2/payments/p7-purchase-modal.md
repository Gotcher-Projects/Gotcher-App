# Payments P7 — Purchase modal

**Status:** Not started
**Est:** ~2–3 hours (may spill — split rather than rush) · **Depends on:** P2, P6 · **Blocks:** P8, P9
**Launch prompt:** `session-prompts.md` → P7
**Read first:** `stripe-full-plan.md` Session 2 → purchase modal

The buy UI. A modal showing the four real SKUs, wired to the `onGetCredits` seam, that turns a click into a
`POST /billing/checkout` and a redirect to Stripe. No card fields — Stripe hosts those.

---

## What you're actually doing, in one paragraph

When a user hits ✨ at zero credits, `AiCreditsContext` fires an `onGetCredits` callback that's currently
left undefined on purpose. This session builds the modal that callback opens: four SKU cards, a clear
"recommended" on the bundle, and — critically — the **name of the book** being unlocked for the share SKUs.
Clicking a card calls the P2 endpoint and sends the browser to the returned Stripe URL.

---

## ⚠️ Ground truth

- **`PaidGate.jsx` does not exist** — it was deleted as dead code 2026-06-19. **Build fresh.**
- **The real seam is `onGetCredits`** in `Frontend/src/contexts/AiCreditsContext.jsx`, left undefined on
  purpose by `sv2-s10b`. Wiring it is this session's whole job.

## The four SKUs (and nothing else)

`$5 / 50cr` · `$10 / 125cr` · **`$15 / 150cr + share` ⭐ recommended** · `$10 / share-only`.

**NO** `$4.99/mo` card. **NO** tier comparison table. **Nothing recurring.** If a card mentions a
subscription, it's from before 2026-07-09.

## ⚠️ The share SKUs must NAME THE BOOK being unlocked

A parent with two books who unlocks the **wrong** one is the refund request we invented for ourselves — and
per P0.5, our policy is to *move the unlock*, not refund, precisely because Stripe keeps its fee and a
chargeback costs ~$15 on top of the lost sale. **Making the book name unmissable at checkout is cheaper
than any refund flow.** The book being unlocked must be visually unambiguous in the modal.

## The flow

Card click → `POST /billing/checkout { sku, bookId? }` → `window.location.href = data.url`. Show a **loading
state while in flight**. Handle the **US-only decline** with the human message from P5 (share the component
if it exists).

## Done when

- [ ] The modal opens from the `onGetCredits` seam and shows exactly the four SKUs, bundle marked recommended.
- [ ] Share SKUs display the **specific book** being unlocked, unmissably.
- [ ] Clicking a SKU hits `/billing/checkout` and redirects to Stripe with a loading state in between.
- [ ] No subscription/tier UI anywhere.
- [ ] Routed per the **P6** decision.

## Not this session

The return-from-Stripe success screen (P8) · the native gate (P9 — build the modal for web first) · balance
display (P10). This session ends at "clicking a SKU sends me to Stripe."

## Closing note

Record the actual duration. P7 is flagged as spill-prone (four cards, the book-naming UX, the decline
state). If it ran past 3h, **stop and split** rather than pushing into P8.
