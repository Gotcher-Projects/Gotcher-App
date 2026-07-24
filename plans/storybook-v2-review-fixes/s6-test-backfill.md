# s6 — Test backfill (F8, F9)

**Status:** Not started · **Tier:** 2 (eventually) · **Independent:** yes
**Findings:** `plans/storybook-v2-review/findings.md` → **F8, F9**

Both cover code that is **correct today but has nothing guarding a regression** on a money/auth path.

## F8 — the print render token + PDF store (auth for two *unauthenticated* endpoints)
`JwtUtil.getPrintRenderBookId` + `PrintPdfStore` are the entire authorization for `GET /print/payload/{token}`
(returns the full book payload — names, photo URLs) and `GET /print/pdf/{token}` (returns the PDF bytes), both
`permitAll`. `AuthServiceTest` **mocks** `JwtUtil`, so its real logic never runs.

- **`JwtUtilTest`** (no DB needed): valid render token → bookId; an ordinary **access token → rejected** (the
  `purpose` claim check at `JwtUtil.java:74`); expired → rejected; tampered signature → rejected.
- **`PrintPdfStoreTest`**: `fetch` of an expired row returns empty (the `expires_at > NOW()` filter).

The negative cases are the point — none has ever run, by a test or by the s14 live run (happy path only). If
the purpose check were dropped in a refactor, every current test would still pass.

## F9 — the three unrouted Stripe refund branches
`BillingWebhookServiceTest` covers `checkout.session.completed`, print routing, unhandled-type and
bad-signature, but **not** `charge.refunded`, `refund.created`, or `refund.failed`
(`BillingWebhookService.java:73–83`). `PrintRefundService` itself is well-covered (13 tests); the untested part
is the **wiring** — event type → cast (`(Charge)`/`(Refund)` obj) → the right `PrintRefundService` method.

Add three routing tests mirroring `printOrder_routesToPrintFulfilment_notGrant`: build the event, assert the
right method is called with the right type. `refund.failed` matters most — it's exercised by neither a test nor
live, and a bad cast there means the "we owe a customer money" operator alert silently never fires.

## Done when
- [ ] `JwtUtilTest` + `PrintPdfStoreTest` exist with the negative cases above.
- [ ] Three refund-routing tests added to `BillingWebhookServiceTest`.
- [ ] `./gradlew test` green (baseline was 423).

## Not this session
The permitAll shape test (s3) · new production code · raising coverage for its own sake.
