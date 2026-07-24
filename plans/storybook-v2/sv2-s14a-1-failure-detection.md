# SV2-S14a-1 — Print failure detection (webhook + sweep + truth on the row)

**Status:** ✅ **COMPLETE** — built + **verified end-to-end with Michael 2026-07-21** (see
`../sv2-s14-verification.md` for the full run). Both detection paths proven on real Lulu rejections: the
**sweep** caught order #10 with no webhook registered, a **live webhook** caught order #11 in 9 seconds.
Kill-switch park + resume confirmed. Tracking capture and the never-rewind guard confirmed. 420 backend tests.
**Est:** ~2 hours · **Depends on:** print pr5, pr7, pr9 · **Blocks:** `sv2-s14a-2`, `sv2-s14c`, print **pr10**
**Launch prompt:** `print/session-prompts.md` → s14a-1
**Read first:** `sv2-s14a-rejection-refund.md` (the a-track overview — **its "Research findings" section has the
exact Lulu payload shapes and the decisions D1–D5; do not re-derive them**), `print/pr7-print-checkout.md`,
`Backend/.../billing/BillingWebhookController.java` (the raw-body signed-webhook pattern we're mirroring),
`Backend/.../print/PrintOrderFulfilmentService.java` (where orders get parked today)

After this session, **no paid print order can fail silently.** That is the property pr10 needs before it ships
real money; the refund itself (a-2) is a smaller problem once the truth is on the row.

Today: a Lulu rejection that arrives *after* a clean submit is completely invisible — the row says `submitted`
and we never look at that job again. And an order parked at `paid` (kill switch or a failed submit) records no
reason, so nobody knows whether it should be retried or refunded.

---

## What you're building

### 1. Migration `V52__print_orders_failure_tracking.sql`
`print_orders.status` has **no CHECK constraint** (V51 is a plain `VARCHAR(20)` + comment), so the new
`shipped`/`failed` values need no DDL — only columns:

| column | why |
|---|---|
| `stripe_payment_intent VARCHAR(120)` | **we cannot refund without it** — see below |
| `lulu_status VARCHAR(30)` + `lulu_status_at TIMESTAMPTZ` | last-seen Lulu job status, for support + the sweep |
| `failure_reason TEXT` | the **line-item** messages (job-level text is useless — see the research) |
| `parked_reason VARCHAR(40)` | D3: `print_disabled` vs `submit_failed` — retryable vs not |
| `submit_attempts INT NOT NULL DEFAULT 0` | bounds the resume path so a broken order can't retry forever |
| `tracking_id VARCHAR(120)`, `tracking_urls TEXT`, `carrier_name VARCHAR(80)`, `shipped_at TIMESTAMPTZ` | SHIPPED arrives on the same feed; s14c reads these |
| `last_checked_at TIMESTAMPTZ` | the sweep's cursor |

Index `print_orders(lulu_job_id)` (the webhook's lookup key) and a partial index on non-terminal statuses for
the sweep.

### 2. Capture the PaymentIntent (the gap that blocks all refunds)
In `PrintOrderFulfilmentService.fulfil`, add `stripe_payment_intent = ?` to the **existing** atomic
`pending→paid` claim UPDATE — the `Session` is already in hand (`session.getPaymentIntent()`), so this costs one
bind parameter and no new call. Do NOT add a separate write; the claim's atomicity is load-bearing.

### 3. Record WHY an order parks (D3)
The two existing catch blocks in `fulfil` already park at `paid` and log. Have each also stamp `parked_reason`:
`print_disabled` (kill switch — retryable) or `submit_failed` (Lulu API error — needs a look), plus
`failure_reason` from the exception. Bump `submit_attempts`.

### 4. The signed Lulu webhook receiver
- **`POST /print/lulu-webhook`** — `/print/**` is already `permitAll` in `SecurityConfig`, which is *correct*
  here for the same reason `/billing/webhook` is: Lulu is unauthenticated to us and **the HMAC signature IS the
  authentication**. (Same self-authorizing pattern as `AdminController`'s `X-Admin-Secret`.)
- Verify `Lulu-HMAC-SHA256`: HMAC-SHA256 over the **raw body bytes**, keyed on `LULU_CLIENT_SECRET`,
  **constant-time** compare. Take the body as a raw `String` exactly like `BillingWebhookController` — parsing to
  JSON first breaks the hash (Lulu's docs call this out explicitly).
- Bad signature → 400 (never retryable). Valid signature but processing blew up → explicit 500 so Lulu retries.
- Payload is `{ topic, data }` where `data` is the print-job object → look the order up by `lulu_job_id`.
- **Registration is a one-time setup call**, not app code: `POST /webhooks/ {topics:["PRINT_JOB_STATUS_CHANGED"],
  url}`. Add it to `lulu-pr5-verify.sh` (or a sibling script) so sandbox and prod can both be pointed/repointed.
  ⚠ The URL is environment-specific — **prod registration is a pr10 step**; locally it's the cloudflared tunnel.

### 5. ONE status mapper (both feeds call it)
`LuluJobStatusMapper` (or a method on a new `PrintOrderStatusService`) — given a job payload:
- `REJECTED` / `CANCELED` / line-item `ERROR` → `failed` + `failure_reason` from
  `line_items[].status.messages.printable_normalization.*` (flatten the arrays; keep interior/cover labelled).
- `SHIPPED` → `shipped` + `tracking_id` / `tracking_urls` / `carrier_name` / `shipped_at`.
- anything else (`PRODUCTION_DELAYED`, `PRODUCTION_READY`, `IN_PRODUCTION`, `DELIVERED`, `UNPAID`) → leave our
  status alone, just record `lulu_status`. **Only ever move forward** — a redelivered older event must not walk
  a `shipped` order back to `submitted`.
- **Idempotent + alert-once:** make the transition a conditional UPDATE (`... WHERE id = ? AND status <> 'failed'`)
  and only send the operator alert when it actually affected a row.

### 6. The reconciliation sweep (safety net, D1)
`@Scheduled` alongside pr3's hourly PDF-TTL sweep. Every ~30 min:
- Orders `status IN ('paid','submitted')`, `created_at` within ~30 days, `last_checked_at` older than the
  interval (or null):
  - **has `lulu_job_id`** → `GET /print-jobs/{id}/` → same mapper. Catches a deactivated/missed webhook.
  - **no `lulu_job_id`** (parked) → if `parked_reason='print_disabled'` **and print is now enabled** and
    `submit_attempts` is under a small cap → **re-submit** (this is the "flip the switch back on after vacation
    and in-flight orders resume" path). Otherwise alert the operator once and leave it.
- Stamp `last_checked_at` regardless so a persistently weird order doesn't get hammered.

### 7. Operator alert
`EmailService.send(...)` (`auth/EmailService.java` — already optional-mail-sender, silently disabled when SMTP
isn't configured, so local dev is unaffected). New config `app.print.operator-email` (default
`print@cradlehq.app`). Subject carries the order id; body carries the reason + the Lulu job id + the amount, so
the Stripe dashboard refund (a-2) is a copy-paste away. **No customer email in this session** — that's a-2.

## ⚠️ Notes
- **Don't refund here.** Even though the PaymentIntent lands on the row this session, a-2 owns every
  money-moving and customer-facing action. a-1 is purely "know the truth and tell the operator".
- **Trust the signed payload** for status (signature = authentication, same stance as Stripe), but the sweep
  re-reads from Lulu anyway, so a malformed delivery is self-healing.
- The webhook and the sweep **must not diverge** — if you find yourself writing status logic twice, the mapper
  isn't factored right.

## Done when
- [ ] A forced rejection (see the a-track's fixture: bad `BACKEND_URL` → Lulu 404s on the source URL) flips the
      order to `failed` with the real *line-item* message stored, and emails the operator.
- [ ] The same rejection is caught **with no webhook registered** (sweep path) and **with one** (webhook path).
- [ ] A tampered body is rejected 400; a replayed valid delivery neither double-alerts nor rewinds status.
- [ ] `stripe_payment_intent` is populated on every newly paid order (a-2 depends on it).
- [ ] An order parked by the kill switch resumes when `PRINT_ENABLED` is flipped back on, and is never marked
      `failed`.
- [ ] A `SHIPPED` job records tracking id/urls/carrier (feeds s14c).

---

## As built (2026-07-21)

**Migration** `V52__print_orders_failure_tracking.sql` — as specced, plus `idx_print_orders_lulu_job` (the
webhook's only lookup key) and a partial `idx_print_orders_open` on `last_checked_at` for the sweep's working set.

**New backend classes** (all in `com.gotcherapp.api.print`):
- `LuluJobStatusMapper` — pure `JsonNode → JobUpdate`. The single interpretation both feeds share. Flattens the
  **line-item** messages with their panel label (`interior: …`), falls back to the job-level text only when the
  line items said nothing, and maps every in-flight status (incl. `DELIVERED`) to "leave our status alone".
- `LuluWebhookController` + `LuluWebhookService` — `POST /print/lulu-webhook`, raw body, HMAC-SHA256 keyed on
  `lulu.client-secret`, constant-time compare. Mirrors `BillingWebhookController` exactly: 400 only for a bad
  signature, explicit 500 otherwise.
- `PrintOrderStatusService` — `applyJobUpdate` (conditional updates + alert-once) and the `@Scheduled` sweep
  (30 min, 2 min initial delay, 25-min staleness cursor, 30-day horizon, 100/pass).
- `PrintOperatorAlert` — the operator email. **Its own bean on purpose:** the status service calls fulfilment to
  resume parked orders, so putting the alert on either would have been a constructor-injection cycle.

**Changed:** `PrintOrderFulfilmentService` (PaymentIntent in the existing claim; `park()` records
`parked_reason`+`failure_reason`; `submit()` shared by fulfil and the new `resubmitParked()`), `LuluClient`
(`getPrintJobRaw` so both feeds see the same shape), `application.properties` (`app.print.operator-email`).

**New script** `Backend/lulu-webhooks.sh` — `list | register <base_url> | test <id> | submissions <id> | delete <id>`.
Registration is a one-time per-environment setup call, not app code (pr10 step 4 does the prod one).

### Three judgment calls the plan didn't specify
1. **Signature encoding accepts hex OR base64.** Lulu's docs don't pin which the header carries and our sandbox
   has never delivered one (sandbox jobs stop at `UNPAID`). Both are the same secret-derived bytes, so accepting
   either widens nothing; the first real delivery pins it. Locally, `openssl dgst -hmac` **hex** verifies.
2. **Unrecognised payloads answer 200, not 500.** Lulu deactivates a webhook after 5 consecutive *failures*, so a
   `POST /webhooks/{id}/test/` dummy or an event about a job with no order behind it must not spend one of the
   five. Only a genuine processing error returns 500.
3. **⚠ New gap found: expired PDFs make a parked order unresumable.** pr3 gives a rendered PDF a 24h TTL, but the
   kill-switch resume path can fire days later — the `source_url`s would 404 and buy a guaranteed Lulu rejection.
   `resubmitParked` now checks `pdf_expires_at` first and parks as **`pdf_expired`** (a third `parked_reason`)
   with an operator alert instead of submitting. A re-render path is NOT built — that's a follow-up if it ever
   happens for real.

### Verified locally 2026-07-21 (not yet with Michael)
- V52 applied by **Flyway** at boot (`Successfully applied 1 migration … now at version v52`); app started clean
  in 4.5s — no bean cycle.
- `POST /print/lulu-webhook`: no header → **400**, bogus signature → **400**, tampered body with a valid
  signature → **400**, correctly signed → **200**.
- A signed `REJECTED` payload for a job with **no matching order** → 200 + "matches no print order — ignoring"
  (the deactivation-footgun behaviour above).
- A signed `REJECTED` for a real order flipped it to **`failed`** with
  `failure_reason = "interior: Unexpected Http response for source url. Status code: 404"` and
  `lulu_status = REJECTED`. **Replaying the identical delivery changed nothing and did not re-alert.**
- The operator email **threw** (`MailAuthenticationException: Authentication failed` — local SMTP is
  half-configured) and `PrintOperatorAlert` swallowed it: the webhook still returned 200 and the row still told
  the truth. That is the designed posture, and it is live evidence for **pr10 step 5** — mail can fail silently.

### Still to verify with Michael
- The **forced-rejection fixture** end to end through Lulu itself (bad `BACKEND_URL` → real REJECTED job),
  caught **both** with a registered webhook and with none (the sweep path).
- The **kill-switch resume**: park an order with `PRINT_ENABLED=false`, flip it on, watch the sweep submit it.
- A `SHIPPED` payload recording tracking (sandbox never ships, so this stays fixture-tested until prod).
