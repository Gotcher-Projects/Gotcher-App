# Payments P2 — `POST /billing/checkout`

**Status:** ✅ **Complete** — implemented 2026-07-10. Compiles, `./gradlew test` green, and verified
live against the demo account (real `cs_test_` sessions created). Awaiting Michael's sign-off.
**Est:** ~2–3 hours (most likely to spill — split rather than rush) · **Depends on:** P1 · **Blocks:** P3, P6
**Launch prompt:** `session-prompts.md` → P2

> **Build notes (2026-07-10):** package `com.gotcherapp.api.billing` — `Sku` enum (wireName +
> requiresBookId, with a comment to revisit toward a config map if it grows), `CheckoutRequest`/
> `CheckoutResponse` records, `BillingService`, `BillingController`. Decisions from the design chat:
> enum SKU model; placeholder `successUrl` (`${FRONTEND_URL}/upgrade-success?session_id={CHECKOUT_SESSION_ID}`,
> P7 builds the page); **derived** idempotency key (`checkout_{user}_{sku}_{book}_{60s-bucket}`) so a
> double-click collapses to one session. IDOR → 404 (not 403) so we don't confirm a book exists.
> `Stripe.apiKey` set once in `BillingService.@PostConstruct`. No SecurityConfig change — /billing/checkout
> is covered by `anyRequest().authenticated()`; the /billing/webhook permitAll is P3.
>
> **Verified (live, demo account user 2, books 5/7):** unknown sku→400, credit-pack+bookId→400,
> share-no-bookId→400, foreign book→404, credits_50→200 URL, share_only+book5→200 URL. Idempotency:
> two rapid identical calls returned the SAME session (deduped). `stripe_customer_id` stored
> (`cus_…`). Session on Stripe: `amount_total=1000`, `mode=payment`, `client_reference_id="2"`,
> `metadata={sku, bookId}` — the exact inputs P3 consumes.

Build the endpoint that turns "I want to buy SKU X (for book Y)" into a Stripe-hosted checkout URL. JWT-
protected. It creates the Checkout Session and hands back a URL — it does **not** grant anything. Granting
is P3's job, and only the webhook's.

---

## What you're actually doing, in one paragraph

Our server asks Stripe to open one payment attempt for one person: "charge for this price, remember it was
user 42 buying `bundle_share_150` for book 42, and send them back here when done." Stripe returns a hosted
URL; the browser goes there; Stripe collects the card. We never see a card number. The tricky parts are
all validation: rejecting nonsense SKUs, requiring a `bookId` for exactly the two share SKUs, and — the one
that actually costs money if skipped — proving the book belongs to the person paying.

---

## The package

`com.gotcherapp.api.billing`: `BillingController` · `BillingService` · `dto/CheckoutRequest` ·
`dto/CheckoutResponse`.

Request `{ "sku": "bundle_share_150", "bookId": 42 }` → Response `{ "url": "https://checkout.stripe.com/..." }`.

## Steps

1. **Reject an unknown `sku`.** Only the four real ones are valid.
2. **`bookId` rules:** **required** for `share_only` and `bundle_share_150`; **rejected** (must be absent)
   for the credit-only packs. A credit pack has nothing to attach to a book.
3. **⚠️ IDOR — validate the book belongs to the caller.** This is the load-bearing check.

   > `books` has **no `user_id`**. Ownership is a two-hop join: `books.baby_profile_id →
   > baby_profiles.user_id`. Skip this and a user pays $10 to unlock **a stranger's book**. This is a
   > security defect, not an edge case. Reuse the existing ownership pattern — see `BookService.java` /
   > `StorybookService.java:215`.
4. **Ensure a Stripe customer.** If `users.stripe_customer_id` is null, `Customer.create()` and store it.
5. **`Session.create()`** with:
   - `mode: 'payment'` (**never** `subscription`)
   - the **price id** for the SKU (from config — never a hardcoded amount)
   - `clientReferenceId = userId` (this is how P3 resolves the buyer)
   - `metadata = { sku, bookId }` (this is how P3 knows what to grant, and to which book)
   - a `successUrl` carrying `{CHECKOUT_SESSION_ID}`, and a `cancelUrl`
6. **Send an `Idempotency-Key`** so a double-clicked Buy button can't create two sessions.

---

## ⚠️ The 401 trap

Per `CLAUDE.md`: an uncaught `RuntimeException` in a controller re-dispatches to `/error` **unauthenticated**
and surfaces as **401, not 500** — which will send you debugging auth when the real problem was a null SKU
or a Stripe error. **Catch `Exception`** (not just `IOException`) in the controller and return a mapped
`ApiError`.

---

## Verify by hand

`curl` the endpoint with a valid JWT and a real SKU/bookId, open the returned URL, and confirm you see the
Stripe page with the **right amount** and, for a share SKU, the **right book name**. Also confirm:

- Unknown SKU → 4xx, not 500.
- `share_only` with no `bookId` → rejected. Credit pack *with* a `bookId` → rejected.
- A `bookId` belonging to **another user** → rejected (the IDOR check).

**Do NOT pay yet.** Nothing handles the result until P3 — a payment now would take money and grant nothing.

## Done when

- [ ] `POST /billing/checkout` returns a working Stripe URL for all four SKUs.
- [ ] The three validation rules (unknown SKU, bookId presence, **book ownership**) all reject correctly.
- [ ] `stripe_customer_id` is created once and reused on the second purchase.
- [ ] Controller catches `Exception`; no path surfaces as a spurious 401.

## Not this session

The webhook / any fulfilment (P3) · adding `/billing/webhook` to `SecurityConfig` (P3) · the frontend modal
(P6) · the Radar rule (P8). This session ends at "Stripe shows the right page." Resist paying.

## Closing note

Record the actual duration. P2 is flagged as one of the sessions most likely to spill (the IDOR join and
Stripe SDK ergonomics eat time) — if it ran past 3h, **stop and split** rather than pushing into P3.
