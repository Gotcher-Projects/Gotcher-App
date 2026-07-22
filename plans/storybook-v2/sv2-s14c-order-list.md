# SV2-S14c — "Your print orders" (minimal list)

**Status:** Not started — **promoted to pre-launch 2026-07-21** (was a deferred candidate; see
`sv2-s14a-rejection-refund.md` D4)
**Est:** ~1 hour · **Depends on:** `sv2-s14a-1` (nothing to list until status + tracking are being recorded)
**Blocks:** nothing, but it's the difference between "email us" and "look it up"
**Launch prompt:** `print/session-prompts.md` → s14c
**Read first:** `print/pr9-order-confirmation.md` "As built" (the DTO + the endpoint-placement gotcha),
`Frontend/src/components/storybook/ShareSection.jsx` (the sibling section in `StorybookTab`)

## Why this is pre-launch now

It was deferred on the reasoning that pr9's confirmation covers the happy path. The research changed that:

- Once a-1 lands we hold **`tracking_urls` / `carrier_name`** for every shipped order and have **nowhere to show
  them**. *"Where's my book?"* is the likeliest support email Michael will get, and it's self-serve.
- pr9's confirmation is a one-shot overlay that vanishes on dismiss. A **`failed`** order currently has no
  in-app existence at all — the customer's only signal is an email that may not land (SMTP is optional!) or may
  go to spam. A list gives failure a visible home.
- The data and the endpoint shape already exist from pr9; this is mostly a read-only view.

## What you're building

### Backend — `GET /print-orders`
- **New top-level path, NOT under `/print/**`** — that namespace is `permitAll` (pr9 hit this exact trap). Any
  other path falls under `anyRequest().authenticated()`, so `/print-orders` is protected by default.
- Returns the caller's orders, newest first, scoped `WHERE user_id = ?` (the IDOR boundary, as in pr9).
- Reuse/extend pr9's `PrintOrderService.OrderSummary` record rather than inventing a second DTO — add
  `luluStatus`, `trackingUrls`, `carrierName`, `shippedAt`, `failureReason`. Keep it **narrow**: still no street
  address, no PDF token URLs, no Stripe/Lulu internal ids.
- ⚠ `failure_reason` holds **raw Lulu text** ("Upload Error: We detected an error in your PDF…"). Do NOT show it
  to the customer verbatim — it's operator/support text. Either omit it from this DTO or map it to friendly copy.

### Frontend — a section in `StorybookTab`
- Sits near the print entry point / `ShareSection`, gated on `usePrintEnabled()` like the order button, and
  **hidden entirely when the user has no orders** (no empty-state clutter for the vast majority).
- Per row: order #, date (`formatDate`), copies, total (`formatCents` — now shared in `lib/formatting.js`),
  and a status chip.
- **Status copy is customer-facing, not our enum:** `submitted`/production → "Being printed";
  `shipped` → "Shipped" + a **Track package** link (`tracking_urls[0]`); `failed` → "There was a problem —
  we're sorting this out" + a contact line. Never render `IN_PRODUCTION` or a raw Lulu message at a parent.
- Pending/abandoned orders (user bailed at Stripe, never paid) **must not appear** — filter them out server-side.

## ⚠️ Notes
- **Read-only.** No cancel button (that's s14b, deferred), no reorder, no address editing.
- This is the *customer's* view. A support/admin lookup over all orders is still deferred (s14d-ish) — Michael
  has DB access and the operator alert emails carry the order id.

## Done when
- [ ] A user with orders sees them newest-first with the right status copy; a user with none sees no section.
- [ ] A shipped order offers a working tracking link.
- [ ] A failed order is visible and reads like an apology, not a stack trace.
- [ ] Another user's orders are unreachable (`/print-orders` is user-scoped).
- [ ] Unpaid/abandoned checkouts never appear.
