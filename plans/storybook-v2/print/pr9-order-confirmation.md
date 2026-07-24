# Print pr9 — Order confirmation + status

**Status:** ✅ **Complete** — built + **verified end-to-end with Michael 2026-07-21** (local tunnel harness,
4242, 2 copies of book 27 → **order #6, $70.00, `submitted`, Lulu sandbox job 316095, line item ACCEPTED**).
Michael confirmed the confirmation card (order #, "2 copies", amount, ship-to San Antonio TX), the status line
flipping "We're preparing it now." → **"Sent to the printer."** inside the poll window, the URL stripping to
`/`, and the cancel path returning quietly. Authorization boundaries verified by probe: another user's token,
a mismatched `book_id`, no token, and a bogus session id → **404 / 404 / 401 / 404**.
Backend suite + 336 frontend tests + `npm run build` all green.
**Status (original):** Not started — **scope LOCKED + build-ready (2026-07-21, with Michael)**
**Est:** ~1.5 hours · **Depends on:** pr7, pr8 (both Complete) · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → pr9
**Read first:** `Frontend/src/components/UpgradeConfirm.jsx` (the model), `App.jsx` `boot()` (`?upgrade=success` handling),
`PrintOrderService` (success_url), `PrintController` (existing owner-scoped print endpoints), `PrintInteriorService.requireOwnedBook` (IDOR pattern)

Close the loop after a successful print order: confirm it. (Shipped-notification is out of scope — see below.)

---

## ✅ Locked 2026-07-21 — build spec (pure build tomorrow, no re-deciding)

**The seam that already exists:** print checkout redirects to `frontendUrl + "/?print=success&session_id={CHECKOUT_SESSION_ID}"`
(`PrintOrderService.setSuccessUrl`). `App.jsx` only handles `?upgrade=success` → `?print=` is ignored → the user lands
on the base screen. The `print_orders` row already exists (`pending` from checkout-create, flipped `paid`→`submitted`
by the webhook). Confirmation just needs to READ it and show it.

**⚠ Security gotcha (drove the endpoint placement):** `SecurityConfig` has **`/print/**` in the `permitAll` list**
(the token-based PDF routes). So the order-lookup endpoint must **NOT** live under `/print/...` — that would expose a
shipping address by session id with no auth. It goes under **`/books/{bookId}/print/...`** (that namespace is
`anyRequest().authenticated()`), which is why we add `book_id` to the success URL below.

### Backend
1. **success_url gains book_id** (`PrintOrderService`): `/?print=success&book_id={bookId}&session_id={CHECKOUT_SESSION_ID}`.
   (cancel_url unchanged: `/?print=cancelled`.)
2. **New endpoint** `GET /books/{bookId}/print/order?session_id={sid}` in `PrintController` (JWT, owner-scoped).
   - Lookup: `SELECT ... FROM print_orders WHERE stripe_session_id = ? AND user_id = ?` — the `user_id` scope IS the
     IDOR boundary (mirrors `PrintInteriorService.requireOwnedBook`'s stance). 404 if not found/owned. Catch `Exception`
     → `ApiError` (CLAUDE.md 401 trap).
   - Returns a small DTO (new `record`): `{ orderId, status, quantity, pageCount, amountCents, currency, shipName,
     shipCity, shipStateCode, bookTitle, createdAt }`. `bookTitle` via join to `books.title` (may be null — fine).
3. Unit test the endpoint: happy path (own order by session) + IDOR (another user's session → 404) + missing session → 404.

### Frontend
4. **`App.jsx` `boot()`** — handle `?print=success` parallel to `?upgrade=success`: read `book_id` + `session_id`,
   `replaceState` to strip the params, set `printConfirm = { bookId, sessionId }` → render `<PrintOrderConfirm>`.
   Swallow `?print=cancelled` silently (clear params, no UI — same as `upgrade=cancelled`).
   - **Native:** on native the return pathname is `/` (no query), so this is a natural no-op — no explicit gate needed.
     Print DOES show on native (physical good), but the web return flow is web-only for v1; note, don't build for it.
5. **New `Frontend/src/components/PrintOrderConfirm.jsx`** — modeled on `UpgradeConfirm`'s overlay (fixed inset,
   centered card), print-shaped:
   - On mount, `GET /books/{bookId}/print/order?session_id={sid}`.
   - Header **"Your book is on its way!"** + a `📖`/`CheckCircle2`. Show: **Order #{orderId}**, **{quantity} cop(y/ies)**,
     **{amount} paid**, **Ship to: {shipName}, {shipCity} {shipStateCode}**, and the delivery copy (D-EST below).
   - **Soft status line, never a failure** (confirmation ≠ fulfilment): `submitted` → "Sent to the printer.";
     `pending`/`paid` → "We're preparing it now." Brief poll (mirror `UpgradeConfirm`: ~12s at 1.5s intervals) to
     upgrade the line to `submitted`; degrade to the "preparing" copy, never an error. Reaching the success URL already
     proves payment, so we confirm optimistically regardless of webhook lag.
   - "Done" button → `onDismiss`. Prices/dates through the shared formatters (`lib/formatting.js`); money as
     `(cents/100).toLocaleString('en-US', {style:'currency', currency})` (matches `PrintOrderModal`).

### Decisions locked
- **D-EST (delivery estimate) = static range copy** (Michael, 2026-07-21). Show: *"Printed and shipped within a few
  days — most books usually arrive in about 2–3 weeks."* NO live Lulu call (sandbox returns `estimated_shipping_dates:
  null`; MAIL = production ~3–5 business days + ship ~4–8, so 2–3 weeks is a safe conservative range). pr6's **live**
  Lulu delivery estimate stays deferred — a later enhancement, not pr9.
- **New component, not an extension of `UpgradeConfirm`** — that one is digital-shaped (credits/share, boolean signal);
  print shows real order details (address, copies, delivery), so a sibling `PrintOrderConfirm` is cleaner.
- **Order # = `print_orders.id`** (also the human-facing support reference).

### Done when
- [ ] After a paid print order, the user sees a confirmation (order #, copies, total, ship-to, delivery range) instead
      of the base screen.
- [ ] The confirmation reads the order via `GET /books/{bookId}/print/order?session_id=` (owner-scoped; another user's
      session → 404).
- [ ] Status line is soft (submitted vs preparing), never a false failure; brief poll upgrades it.
- [ ] `?print=cancelled` returns quietly to the app with no error.

---

## As built (2026-07-21)

**Backend**
- `PrintOrderService.setSuccessUrl` → `/?print=success&book_id={bookId}&session_id={CHECKOUT_SESSION_ID}`.
- `PrintOrderService.findOrderBySession(userId, bookId, sessionId)` → `OrderSummary` record (or `null` → 404).
  Query is scoped `stripe_session_id = ? AND user_id = ? AND book_id = ?` — **both** the user and the book are
  in the WHERE clause, so a wrong user, a wrong book, or a tampered link all look identical to "no such order".
  The DTO is deliberately narrow: no street address, no PDF token URLs, no Stripe/Lulu ids — city/state only.
  A blank/absent session id short-circuits to `null` without querying.
- `PrintController GET /books/{bookId}/print/order?session_id=` — under `/books/**` (authenticated), NOT
  `/print/**` (permitAll), per the security note above. Catches `Exception` → `ApiError` (the 401 trap).
- `PrintOrderServiceTest` +3: row mapping, empty result → null (the IDOR miss), missing session id → null with
  `verifyNoInteractions(jdbc)`. (The existing helper now passes a mock `JdbcTemplate` instead of `null`.)

**Frontend**
- `App.jsx` — `printConfirm` state; `boot()` handles `?print=success` (reads `book_id`+`session_id`, strips the
  params, opens the confirmation) and swallows `?print=cancelled`. Also fixed pr8's off-by-one `PrintProvider`
  indentation while in the file.
- `PrintOrderConfirm.jsx` (new, top-level next to `UpgradeConfirm`) — overlay card: "Your book is on its way!",
  order #, copies, paid, ship-to (name · city, state), the static delivery range, and the soft status line
  (`submitted`/`shipped` → "Sent to the printer." else "We're preparing it now."). Polls 1.5s × 12s to upgrade
  the line. **A failed lookup is NOT an error state** — it degrades to "Your payment went through and we're
  getting your book ready", since landing on this screen already proves Stripe took the money.
- `formatCents` moved out of `PrintOrderModal` into `lib/formatting.js` and imported by both, so a total reads
  identically before and after checkout.

**Left as-is:** the optional Lulu shipped-notification half (still nice-to-have, not built) and pr6's live
delivery estimate (D-EST locked to static copy).

## What you're building

- A **confirmation screen** after the pr7 checkout returns — order placed, copies, estimated delivery,
  shipping address. Like the credit success screen (Payments P7), it **confirms**, it doesn't fulfil —
  the Lulu job was submitted by the webhook (pr7), not the redirect.
- **(Optional) order status / shipped notification** — if Lulu offers an order-status / shipped **webhook**
  (`lulu-spec-handoff.md` Q7), subscribe and notify the user when their book ships.

## ⚠️ Notes
- **Confirmation ≠ fulfilment** — same rule as the credit flow: the browser landing here proves nothing;
  the paid Lulu job was triggered by the signed Stripe webhook in pr7.
- The shipped-webhook is a **nice-to-have** — scope it out if Lulu's status API is thin; the confirmation
  screen is the required part.

## Done when
- [ ] A successful order shows a confirmation with order details + estimated delivery.
- [ ] (If in scope) a Lulu shipped event notifies the user.

## Not this session
Refunds / order-cancellation / print-job-rejection recovery **and the persistent "my orders" history list** →
**`../sv2-s14-print-hardening.md`** (order-history is s14c). pr9 is only the single post-checkout confirmation
(+ optional shipped ping); it reads the `print_orders` row (table from pr7) but doesn't build a list view.
