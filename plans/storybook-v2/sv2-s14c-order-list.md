# SV2-S14c — "Your print orders" (minimal list)

**Status:** ✅ **COMPLETE** — built + **verified with Michael 2026-07-21**. All four states confirmed on one
screen: Refunded, "There was a problem" + apology, Shipped + a working Track package link, Being printed.
Michael quoted the failed-order copy back — no `example.com`, no `REJECTED`, nothing Lulu-shaped.
Earlier: **promoted to pre-launch 2026-07-21** (was a deferred candidate; see `sv2-s14a-rejection-refund.md` D4)
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

---

## As built (2026-07-21)

**Backend** — `PrintOrdersController` → `GET /print-orders` (top-level path, so it falls under
`anyRequest().authenticated()`; there is no path parameter to tamper with at all). `PrintOrderService.listOrders`
scopes `WHERE po.user_id = ? AND po.status <> 'pending' ORDER BY po.id DESC`. pr9's `findOrderBySession` and this
now share ONE `ORDER_SELECT` projection and one row mapper, so the confirmation and the list can never disagree
about an order.

**`OrderSummary` gained** `trackingUrl`, `carrierName`, `shippedAt`, `refunded` — extended rather than
duplicated, as the plan asked.

**Frontend** — `PrintOrdersSection.jsx`, mounted in `StorybookTab` between the print CTA and `ShareSection`.
Hidden when there are no orders (and when the fetch fails). Status copy: `paid`/`submitted` → "Being printed",
`shipped` → "Shipped" + a **Track package** link, `failed` → "There was a problem" + an apology and a contact
line, `refunded` → "Refunded". Dates via `formatDate`, money via `formatCents`.

### Three deviations from the plan, each deliberate
1. **`luluStatus` and `failureReason` are NOT in the DTO.** The plan said to add them and then warned never to
   render them at a parent. The surest way to never render something is to never send it — a future edit to
   this component can't leak a field the API doesn't return. Support reads both from the DB and the alert email.
   There's a unit test asserting the SQL selects neither (nor `stripe_*`, `ship_street`, or `pdf_url`).
2. **The section is NOT gated on `usePrintEnabled()`.** The plan said to gate it like the order button, but the
   kill switch means "no NEW orders", not "hide the ones already in flight" — and print being off is *exactly*
   when someone wants to check on a book they already paid for. The empty-list check is the real gate for
   almost everyone. (The order **button** stays gated, unchanged.)
3. **`refunded` is a derived boolean, not a date.** It reads `refunded_at IS NOT NULL`, which s14a-2 **clears**
   when a refund later fails — so a bounced refund correctly stops showing as refunded.

### Verified locally 2026-07-21
- `GET /print-orders`: **401** with no token, **200** with one, newest-first, and the three `pending` rows from
  abandoned checkouts absent. Payload confirmed to carry no Lulu/Stripe internals.
- Frontend: 8 new tests — empty → renders nothing, failed fetch → renders nothing (not an error box),
  "Being printed" instead of the internal status, `1 copy` vs `2 copies`, tracking link with `rel=noopener`,
  the failed copy reading as an apology with nothing vendor-shaped in the DOM, and refunded overriding failed.

### Still to verify (→ `../sv2-s14-verification.md`)
- A human actually looking at the section with real failed / shipped / refunded orders in it.
- The shipped row + tracking link need a **hand-written DB row** (Lulu sandbox never ships) — note it as such.
