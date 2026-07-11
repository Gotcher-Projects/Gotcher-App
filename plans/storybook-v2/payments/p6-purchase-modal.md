# Payments P6 — Purchase modal

**Status:** Not started (re-scoped 2026-07-11 — see decision box)
**Est:** ~1.5–2 hours (shrunk after re-scope) · **Depends on:** P2 (P5 only nominally — see note) · **Blocks:** P7, P9
**Launch prompt:** `session-prompts.md` → P6
**Read first:** `stripe-full-plan.md` Session 2 → purchase modal

The buy-**credits** UI. A modal showing the two credit packs, wired to the `onGetCredits` seam, that turns a
click into a `POST /billing/checkout` and a redirect to Stripe. No card fields — Stripe hosts those.

> **Decision (Michael, 2026-07-11): credits-only modal. The share SKUs move to sv2-s13.** `onGetCredits` is
> a *buy-credits* intent fired with **no book** (`AiAssistField.jsx:60,73,158`) — and from journal, pregnancy,
> and profile, not just the storybook — so the plan's "name the book being unlocked" requirement has no book
> to name here. Unlocking a *specific* book (`share_only`, `bundle_share_150`) is a separate intent that
> belongs to the **sv2-s13 share button**, where a concrete `bookId` exists. P6 builds the credits modal
> (`credits_50`, `credits_125`) but **parameterizes it to accept an optional `bookId` + SKU set** so s13 drops
> in the share/bundle cards (with the book named) without a rewrite.
>
> **P5 dependency is nominal:** the modal redirects via `window.location.href` to Stripe; the return
> (`?upgrade=success`) is P7. P6 never touches the `/book` route. Real dep is just P2 (the checkout endpoint).

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

## The two SKUs this session builds

`$5 / 50 credits` (`credits_50`) · `$10 / 125 credits` (`credits_125`).

**NO** `$4.99/mo` card. **NO** tier comparison table. **Nothing recurring.** If a card mentions a
subscription, it's from before 2026-07-09.

The other two SKUs (`bundle_share_150`, `share_only`) are **NOT built here** — they need a specific book and
belong to the sv2-s13 share flow (see decision box). Build the modal so a caller *can* pass a `bookId` and an
extended SKU list, but P6 ships credits-only.

**Display copy is frontend-only.** Prices/credit counts shown on the cards are cosmetic; the real charge and
credit grant come from Stripe price metadata (P2/P3). Keep the two in sync, but the card copy is not the
source of truth.

## ⚠️ Book-naming requirement — deferred to sv2-s13 (not lost)

A parent who unlocks the **wrong** book is the refund we invented for ourselves; per P0.5 the policy is to
*move the unlock*, not refund. That requirement is real — it just lives in the **share flow (sv2-s13)** where
a `bookId` exists, since this modal's trigger carries none. When s13 adds the share/bundle cards, the book
being unlocked must be visually unambiguous.

## The flow

Card click → `POST /billing/checkout { sku }` → `window.location.href = data.url`. Show a **loading state
while in flight**. (The US-only decline surfaces on Stripe's hosted page, not here — P8.)

## Done when

- [ ] The modal opens from the `onGetCredits` seam and shows exactly the two credit packs.
- [ ] Clicking a SKU hits `/billing/checkout` and redirects to Stripe with a loading state in between.
- [ ] No subscription/tier UI anywhere.
- [ ] The modal accepts an **optional `bookId` + extended SKU list** (unused this session) so sv2-s13 can add
      the share/bundle cards without a rewrite.

## Not this session

The share/bundle SKUs + book-naming (**sv2-s13**) · the return-from-Stripe success screen (P7) · the native
gate (P9 — build the modal for web first) · balance display (P10). This session ends at "clicking a credit
pack sends me to Stripe."

## Closing note

Record the actual duration. Re-scoped to credits-only, so the biggest spill risks (the book-naming UX, the
four-card layout) are gone; if it still runs long, split the checkout wiring from the card layout.
