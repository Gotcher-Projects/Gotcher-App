# Payments & Print — Context Primer

> **Purpose:** one accurate briefing on how CradleHQ takes money (Stripe) and ships physical books
> (Lulu print-on-demand), end to end. Paste into a new AI session before payments/print work so the
> assistant has correct context without re-deriving it from eleven plan files.
>
> **Last verified against branch `payments-v1`, 2026-07-22** (the REVIEW-0 5-pass branch review).
> Sibling primer: `plans/storybook/storybook-context.md` (the memory-book feature this all sits on top of).

---

## 0. The things that surprise people

1. **Print needs a FOURTH runtime process.** Besides frontend (3000), API (3001) and Postgres (5432), the
   print PDF pipeline needs a **headless-Chrome PDF sidecar** (dev: `localhost:4000`; prod: a `pdf-sidecar`
   Compose service — **not yet in `docker-compose.prod.yml`**, added by DEPLOY-0 step 6). The API POSTs a URL to
   the sidecar, which loads it in Chrome and returns PDF bytes. No sidecar → no print PDFs.
2. **The whole print feature ships LIVE but DORMANT behind one flag.** `app.print.enabled` (env `PRINT_ENABLED`)
   defaults **false**. Prod ships with print off; `LuluClient` hard-refuses to submit a paid job when it's
   false. It's a pure kill switch — "refuse NEW submissions", it does **not** cancel in-flight jobs.
3. **A webhook is the ONLY thing that grants anything.** Neither a digital purchase nor a print order is
   fulfilled by the checkout call. Checkout just opens a Stripe session; the **signed webhook** grants credits /
   unlocks a book / submits the Lulu job. The return-from-Stripe screens are confirmation-only and never claim
   success without a real signal.
4. **Every money branch is idempotent because Stripe WILL redeliver.** Digital grants key on the Stripe
   `event_id` (`ON CONFLICT DO NOTHING`); print fulfilment uses an atomic `pending→paid` claim (a redelivery
   flips 0 rows → no second physical book). Design for "this runs twice."
5. **Credit amounts are NOT in the code.** The four SKUs are an enum (`Sku.java`), but how many credits each
   grants lives on the **Stripe price's metadata** (set in the dashboard, read by the webhook) so the dollar
   amount and the credits can't drift apart in two places.
6. **There are two independent Lulu status feeds, and they share ONE interpreter.** The signed webhook (fast)
   and the reconciliation sweep (safety net) both run every payload through `LuluJobStatusMapper` — because two
   feeds interpreting a rejection differently is exactly the bug that strands a paying customer.
7. **`/print/**` is `permitAll`.** Anything under it is unauthenticated by definition. The authenticated print
   endpoints deliberately live under `/books/{bookId}/print/**` and `/print-orders` instead. (This trap was hit
   twice — pr9, s14c.)

---

## 1. Runtime shape

```
                                   ┌───────────────────────────── Stripe (hosted checkout + webhooks) ─┐
Browser ──/billing/checkout──▶ API ─┤                                                                  │
   ▲                                └──/billing/webhook (signed)──▶ GrantService / PrintOrderFulfilment ┘
   │                                                                        │
   └── return ?upgrade=success / ?print=success (confirmation only)         │ (print orders)
                                                                            ▼
                                              LuluClient ──create-print-job──▶ Lulu POD API
   PDF pipeline (print):                                                     │  (fetches source_url PDFs
   API ──POST /render──▶ pdf-sidecar (headless Chrome)                       │   server-side, async)
        loads https://…/print/book/{token} + /print/cover/{token}           │
        ◀── PDF bytes ── stored in print_pdfs, served at /print/pdf/{token} ─┘
                                                                            ▼
                              status feeds:  /print/lulu-webhook (signed)  ──┐
                                             reconcile() hourly sweep      ──┴─▶ LuluJobStatusMapper ─▶ print_orders
```

---

## 2. Data model (PostgreSQL, JdbcTemplate — no ORM)

| Table / column | Migration | Meaning |
|---|---|---|
| `users.ai_credits_remaining`, `users.tier`, `users.stripe_customer_id` | V47 | credit balance + Stripe customer (lazily created on first purchase) |
| `stripe_events_applied` (`event_id` PK, `user_id`, `sku`, `credits`, `unlocked_book_id`) | V47 | the digital-purchase idempotency ledger — one row per applied Stripe event |
| `books.share_unlocked_at` | V42/V47 | non-null = the book's public share link is unlocked (share SKUs) |
| `print_pdfs` (`token` PK, `book_id`, `kind`, `bytes`, `content_type`, `expires_at`) | V50 | rendered interior/cover PDF bytes, keyed by an unguessable token, **24h TTL** |
| `print_orders` | V51 (+V52 failure, +V53 refunds) | one physical order — status, quantity, page_count, amount, ship address, `stripe_session_id`/`stripe_payment_intent`, `lulu_job_id`/`lulu_status`, `parked_reason`/`submit_attempts`, `failure_reason`, tracking, `refunded_at`/`refund_id`, `pdf_expires_at`, `last_checked_at` |

**`print_orders.status` vocabulary:** `pending` → `paid` → `submitted` → `shipped`; plus terminal `failed`.
Only-move-forward rules are enforced in SQL WHERE clauses (a replayed event can't un-ship an order).

---

## 3. Payments (digital SKUs)

### The four SKUs (`billing/Sku.java`)
| wireName | requiresBookId | grants |
|---|---|---|
| `credits_50` | no | credits only (amount from Stripe metadata) |
| `credits_125` | no | credits only |
| `bundle_share_150` | **yes** | credits **and** unlocks the book's share link |
| `share_only` | **yes** | share unlock only (credits = 0) |

### Flow
1. **Checkout** — `POST /billing/checkout` (JWT; `BillingController` → `BillingService.createCheckout`). Validates
   the SKU, enforces `requiresBookId` (and that the book is owned — the IDOR check), opens a Stripe Checkout
   Session with `metadata.type`/sku/bookId, keyed by a per-(user,sku,book) idempotency key. Returns the hosted URL.
2. **Return** — Stripe redirects to `?upgrade=success|cancelled`. `App.jsx confirmUpgrade()` polls `/auth/me`
   (credits grew) and/or `/books` (`shareUnlocked` flipped) for ≤12s, then shows done/"on its way" — **never** a
   false failure (being on the page already means Stripe took the money).
3. **Grant** — `POST /billing/webhook` (signature-verified) → `BillingWebhookService` routes
   `checkout.session.completed` → `GrantService.apply(eventId, …)`. The `event_id` PK + "grant only if the
   INSERT added a row" makes a redelivery a no-op. Credits and the book unlock are independent writes in one
   `@Transactional` (in its **own bean** so the proxy actually applies the transaction).

### Refunds (issued BY HAND from the Stripe dashboard — no auto-refund, decision D2)
`BillingWebhookService` also routes three refund events → `PrintRefundService`:
`charge.refunded` (record), `refund.created` (the only event that reliably carries the refund id —
`COALESCE(?, refund_id)` so it's never wiped), `refund.failed` (undo the recording + alert a human).
Non-print (digital) refunds are filtered out downstream.

---

## 4. Print (physical books via Lulu)

**SKU** `0850X1100FCPREPB080CW444GXX` (8.5×11, full-colour), **MAIL** shipping (a GROUND job is rejected —
verified), flat all-in price table. **Page gate (`PrintInteriorService`, the single source of truth, D5):**
- floor **32** filled interior pages (the SKU's hard minimum); freeform capped at **50** (the price table's
  range), guided rides the SKU ceiling **800** (its fixed arcs never approach it).
- "filled interior pages" = Σ filtered chapter pages = exactly what the PDF prints, so the count can't drift
  from what's produced.

### Order flow (all under `/books/{bookId}/print/**`, JWT-owner-scoped)
1. `GET …/orderability` and `GET …/price` — the gate + the price for `quantity`.
2. `POST …/checkout?quantity=N` (`PrintOrderService.createCheckout`):
   kill-switch check **first** (no charge for a dormant feature) → re-check orderability (also the IDOR check) →
   **recompute the amount server-side** (never trust the client) → **render + persist** the interior & cover
   PDFs now (behind token URLs) → insert a `pending` `print_orders` row → open a variable-amount Checkout
   Session (collects US shipping address + phone; `metadata.type=print_order`, `printOrderId`) with a per-order
   idempotency key. Returns the hosted URL.
3. **Return** — `?print=success&book_id=&session_id=` → `PrintOrderConfirm` polls `GET …/print/order?session_id=`
   (owner + book + session in the WHERE clause = the IDOR boundary) and shows order #, copies, total, ship-to.
4. **Fulfilment** — `/billing/webhook` sees `metadata.type=print_order` → `PrintOrderFulfilmentService.fulfil`:
   the **atomic claim** `UPDATE … SET status='paid', stripe_payment_intent=?, ship_*=? WHERE id=? AND
   status='pending'`. A redelivery claims 0 rows → **no second Lulu job**. The PaymentIntent is captured here
   (needed for any later refund). Then `LuluClient.createPrintJob` (refuses if the kill switch is off) → status
   `submitted`. If print is off or Lulu errors, the order **parks** (`parked_reason`) and an operator is emailed
   — the customer is never told; the payment already succeeded.

### The PDF pipeline
- `PrintRenderService` mints a **render token** (short-lived JWT, `purpose=print-render`, scoped to one bookId)
  and asks `PrintSidecarClient` to render `…/print/book/{token}` (interior) and `…/print/cover/{token}` (cover
  wrap) — served OUTSIDE the auth gate in `App.jsx` so headless Chrome doesn't wait on session boot.
- `PrintPublicController` serves `GET /print/payload/{token}` (the content-filtered book payload the print route
  reads — filled pages only) and `GET /print/pdf/{token}` (the persisted bytes Lulu fetches server-side).
- `PrintPdfStore` keys bytes by a 32-byte `SecureRandom` token with a 24h TTL; `sweepExpired()` deletes expired
  rows hourly (`@EnableScheduling` on the app class).

### The two status feeds → one interpreter
- `POST /print/lulu-webhook` (HMAC-SHA256 over the raw body; fail-closed when the secret is blank) — the fast path.
- `PrintOrderStatusService.reconcile()` — an hourly sweep (safety net: Lulu **deactivates a webhook after 5
  consecutive failed deliveries**, so a deploy window can silently switch off the only failure detector). Bounded
  by batch size / staleness / time horizon; one bad row can't abort the pass.
- Both call `LuluJobStatusMapper.parse(job)` — the SINGLE place that decides shipped / failed / still-in-flight
  and extracts the real rejection reason (which lives on the line-item, not the job). `PrintOrderStatusService`
  only *applies* the verdict, with only-move-forward SQL guards.

---

## 5. Token types (don't confuse them)
| token | where | authorizes |
|---|---|---|
| **render JWT** (`purpose=print-render`, ~minutes) | `/print/payload/{token}` | the filtered book payload for the sidecar (`JwtUtil.getPrintRenderBookId`) |
| **PDF token** (32-byte opaque, 24h) | `/print/pdf/{token}` | the persisted PDF bytes Lulu fetches (`PrintPdfStore`) |
| **share token** (opaque, per book) | `/book/public/{token}` | the public read of an unlocked book (`share_unlocked_at IS NOT NULL`) |

---

## 6. Config / env (`application.properties`, all with SAFE BLANK/OFF defaults so the app boots dormant)
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREDITS_50/125`,
  `STRIPE_PRICE_BUNDLE_SHARE_150`, `STRIPE_PRICE_SHARE_ONLY` (test keys locally; live values swap in at **P12**).
- **Lulu:** `LULU_API_BASE` (defaults sandbox), `LULU_CLIENT_ID`, `LULU_CLIENT_SECRET`, `LULU_POD_PACKAGE_ID`.
  ⚠ `lulu.client-secret` is **also** the HMAC key for the status webhook — rotating it invalidates in-flight
  webhook deliveries too.
- **Print:** `PRINT_ENABLED` (kill switch, default false), `PRINT_SIDECAR_URL` (dev :4000; prod
  `http://pdf-sidecar:4000`), `PRINT_FRONTEND_BASE` (the URL Chrome loads the print route from),
  `PRINT_RENDER_TIMEOUT_MS`, `PRINT_PDF_TTL_HOURS`, `PRINT_OPERATOR_EMAIL` (where "a paid order needs a human"
  mail goes — **silently no-ops until SMTP is configured**).
- **Anthropic** (the "✨ write this for me" assist, gated on credits): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
  (`claude-haiku-4-5-20251001`), `ANTHROPIC_TEMPERATURE`.

## 7. Ops scripts (repo)
- `Backend/stripe-listen.sh` — local Stripe CLI webhook forwarding (the local e2e harness: tunnel + `stripe
  listen` + test card 4242).
- `Backend/lulu-webhooks.sh` — one-time webhook registration per environment.
- `Backend/lulu-verify.sh`, `Backend/lulu-pr5-verify.sh` — Lulu creds / cover-dimension checks.
- `Backend/run-migrations.sh` — Flyway run helper.
- Deploy for this branch: follow **`plans/storybook-v2/sv2-deploy-0-first-prod-deploy.md`** (backup + migration
  rehearsal + sidecar wiring), NOT the steady-state `deployment-guide.html` alone.

## 8. Security notes
- **permitAll self-authorization:** every route under `/print/**`, `/book/public/**`, `/billing/webhook`,
  `/admin/**` authorizes itself (token / signature / secret). Authenticated print endpoints live under
  `/books/**` and `/print-orders`, never `/print/**`.
- **IDOR:** owner scope is in the WHERE clause. `books` has no `user_id`; ownership is
  `books.baby_profile_id → baby_profiles.user_id`.
- **Spring 401 trap:** controllers calling Stripe/Lulu/Cloudinary/Claude/the sidecar `catch (Exception)` → mapped
  `ApiError`; an uncaught `RuntimeException` re-dispatches to `/error` and surfaces as **401, not 500**.
- **Secrets:** never logged; `failure_reason` holds raw Lulu operator text and is deliberately kept OUT of the
  customer-facing `ORDER_SELECT` projection.

## 9. Where the plans live
- **Print track:** `plans/storybook-v2/print/` (pr0–pr10 + s14; `pr10-live-cutover.md` is the go-live gate).
- **Payments track:** `plans/storybook-v2/` P-series (`p12-live-cutover.md` = Stripe live).
- **Review + fixes:** `plans/storybook-v2-review/` (the 5-pass review, findings F1–F15) and
  `plans/storybook-v2-review-fixes/` (this doc is s2/F11 of that track).
- **Ship order:** REVIEW-0 → DEPLOY-0 (dormant) → P12 (Stripe live) → pr10 (Lulu prod, print left OFF).
