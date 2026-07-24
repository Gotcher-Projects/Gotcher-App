# SV2-S14 — Combined live verification (a-1 + a-2 + c)

**Status:** ✅ **RUN 2026-07-21 with Michael — all three plans now Complete.** The one gap found during the run
(`refund_id` never stored) was fixed and re-verified the same day. **s14a-1 ✅ · s14a-2 ✅ · s14c ✅.**
Orders #8–#11 on the local DB are the artefacts. Full results below, then **six open items for pr10**.
**Est:** ~1 hour · **Depends on:** `sv2-s14a-1` ✅, `sv2-s14a-2` ✅, `sv2-s14c` ✅ — all built, all *Needs Verification*
**Blocks:** print **pr10** — this is the evidence that the failure path actually works before real money moves.
**Launch prompt:** `print/session-prompts.md` → s14 — combined verification
**Read first:** `sv2-s14a-1-failure-detection.md` "As built" + "Still to verify"

> **This is a verification session, not a build slice.** It is deliberately NOT `s14d` — that slot is the
> estimate/actual tolerance + written refund/reserve policy, a pr10 ToS gate item.

Three plans share one failure path, and standing up the print harness is the expensive part — not the checking.
So verify them in a single pass. The key economy: **a-1's forced rejection produces exactly the fixture a-2 and
s14c need** — a paid order sitting at `failed` with a `stripe_payment_intent` on it. That is the row you refund
from the Stripe dashboard to exercise a-2, and the row that gives s14c's list something real to render.

---

## Harness (once, at the top)

Same recipe as the pr9 verification. In order:

1. `PRINT_ENABLED=true` in `Backend/.env`.
2. `./start-services.sh` — **at the repo ROOT**, not `Backend/` (CLAUDE.md is wrong about this). It auto-starts
   Docker, auto-stops the `taverntales-*` containers (the shared-5432 gotcha), then brings up api/frontend/sidecar.
3. `cloudflared tunnel --url http://localhost:3001` → put the public URL in `BACKEND_URL` in `Backend/.env`.
4. `stripe listen --forward-to http://localhost:3001/billing/webhook`.
5. Test card **4242 4242 4242 4242**, any future expiry/CVC.

⚠ **Restart the API after touching `BACKEND_URL`.** The running process holds the old value; a stale tunnel URL
means Lulu fetches a dead PDF link. This bit us before.
⚠ `./stop-services.sh` does **not** reliably kill the API — check `netstat -ano | grep :3001` and kill the java
pid by hand if the port is still held.
⚠ Local SMTP **auth fails**, so every operator/customer email throws and is swallowed by design. Verify the
**log line**, never an inbox. (Real delivery is a pr10 step.)

## The walk — five orders

### Order A — the sweep path (a-1)
Point `BACKEND_URL` at a host Lulu cannot fetch, register **no** Lulu webhook, place an order. Lulu accepts the
POST and rejects during normalization (this is the `sandbox job 314931` fixture: *"Unexpected Http response for
source url … Status code: 404"*).

- [ ] The reconciliation sweep flips the row to **`failed`** with the **line-item** reason in `failure_reason`
      (not Lulu's job-level "One or more line-items were rejected.").
- [ ] Exactly one operator alert is logged.
- [ ] Don't wait 30 minutes — temporarily shorten `SWEEP_INTERVAL_MS` in `PrintOrderStatusService`, or invoke
      `reconcile()` directly. **Put it back afterwards.**

### Order B — the webhook path (a-1), then a-2, then s14c
`./lulu-webhooks.sh register <tunnel_url>`, then place a second order with the same broken `BACKEND_URL`.
**B must be a separate order from A:** once A is `failed`, any later delivery about it is a deliberate no-op, which
proves idempotency but would tell you nothing about the webhook path.

- [ ] The rejection lands within **seconds** (not on a sweep tick), same `failed` + line-item reason.
- [ ] `./lulu-webhooks.sh submissions <id>` shows the delivery as successful, and `is_active` is still true.
- [ ] **a-2:** refund B from the **Stripe dashboard** → `charge.refunded` arrives → `refund_id` / `refunded_at` /
      amount land on the row; the customer "refund on its way" email fires exactly once.
- [ ] **a-2:** redeliver the refund event from the Stripe CLI → nothing changes, no second email.
- [ ] **s14c:** B appears in "your print orders" reading like an apology — **no raw Lulu text at a parent**, no
      street address, no internal ids.

### Order C — the kill-switch resume (a-1, D3)
Never touches Lulu. Place an order with `PRINT_ENABLED=false`.

- [ ] It parks at **`paid`** with `parked_reason = print_disabled` and is **NOT** marked `failed` — a parked order
      is not a failed order, and must never be refunded for being parked.
- [ ] No operator alert (this is an expected state, not an incident).
- [ ] Flip `PRINT_ENABLED=true`, restart the API → the sweep resubmits it and it reaches `submitted`.

### Order D — the clean happy path (s14c)
One ordinary successful order with a working `BACKEND_URL`, to confirm the failure work didn't regress pr7–pr9.

- [ ] pr9's confirmation still appears; the order shows in s14c's list as "Being printed".
- [ ] A user with **no** orders sees no section at all.
- [ ] Another user's token cannot see these orders (`/print-orders` is user-scoped — probe it, as in pr9).

### Order E — the failing refund (a-2)
Place a normal successful order, but pay with **`4000000000005126`** instead of 4242. Then refund it from the
dashboard. Stripe reports the refund as **succeeded first** (so `charge.refunded` fires and the customer is told
their money is coming) and flips it to **failed** a moment later.

- [ ] The "refund on its way" email goes out on the first (optimistic) event — that's correct behaviour, not a bug.
- [ ] `refund.failed` then **undoes** it: `refunded_at` and `refunded_amount_cents` cleared, `refund_failed_at`
      + `refund_failure_reason` set, and **`refund_notified_at` reset**.
- [ ] Exactly one operator alert, and it says the customer has already been promised the money.
- [ ] Refund an order again afterwards and confirm the customer **is** re-notified (the reset actually works —
      otherwise a successful retry reaches them in silence).
- [ ] **s14c:** this order must NOT read as refunded in the customer's list while the refund is failed.

### Results — run of 2026-07-21 (COMPLETE)

**The headline pair (decision D1 justified in one sitting):** order #10 was caught by the **sweep with no
webhook registered at all**; order #11 was caught by a **live webhook in 9 seconds** (thread `io-3001-exec-12`,
created 22:35:08 → failed 22:35:17; the only sweep in the whole log ran at 22:32:46, before it existed). Both
stored the **line-item** reason, not Lulu's useless job-level text.

- ✅ **Order C — kill switch (order #10 reused).** ⚠ **Method changed during the run:** with
  `PRINT_ENABLED=false` you *cannot place* a paid order — `/auth/me` reports `print_enabled: false` and
  checkout returns **409 with no Stripe session**. Both gates work, but that means the parked state is only
  reachable via the real race: mid-checkout when the switch flips. Reproduced deterministically by resetting a
  dead order to `pending` and resending its `checkout.session.completed` with print off. Result: `status=paid`
  (**not** `failed`), `parked_reason=print_disabled`, no Lulu job, **no operator alert and no customer email**.
  Then `PRINT_ENABLED=true` + restart → sweep logged *"parked by the kill switch and print is enabled again —
  resuming"* → submitted as job 316104, `submit_attempts` 1→2, `parked_reason` cleared.
- ✅ **SHIPPED + tracking** — sandbox never ships, so a **synthetic but signed** `SHIPPED` payload was sent
  through the real webhook for order #8's real Lulu job (316100). The receiver, signature check, mapper and
  tracking extraction are all the real path; only the payload is hand-made. Row got
  `tracking_id=1Z999AA10123456784`, `carrier_name=UPS`, the url, and `shipped_at`.
- ✅ **"Only move forward"** — a stale `IN_PRODUCTION` delivery sent *after* #8 shipped left `status=shipped`
  untouched (only informational `lulu_status` moved). A replay cannot walk an order backwards.
- ✅ **Refund idempotency** — `stripe events resend` of the refund event logged *"already recorded on print
  order 11 (redelivery) — no second email"* and `refunded_at` stayed byte-identical at `03:38:32.895432`.
- ✅ **s14c UI confirmed by eye** — all four states on one screen: #11 Refunded, #10 "There was a problem" +
  apology, #8 Shipped + working Track package (UPS) link, rest "Being printed". Michael quoted the failed copy
  back and it contained no `example.com`, no `REJECTED`, nothing Lulu-shaped.

### Earlier in the same run
- ✅ **Order D** (order #8): `submitted`, Lulu job 316100 line item **ACCEPTED** (so the tunnel round-trip works),
  **`stripe_payment_intent` captured on a real order** — the a-1 gap fix proven. pr9 confirmation + the s14c
  section both confirmed by eye. `/print-orders` newest-first, abandoned `pending` rows hidden.
- ✅ **Plumbing**: no header / bogus sig / tampered body → **400**; valid **hex** and valid **base64** → 200;
  a signed but unactionable payload → **200** (must not burn one of Lulu's five strikes).
- ✅ **Order E** (order #9, card `4000000000005126`): the async failure reproduced exactly —
  `charge.refunded` at 22:27:32 recorded the refund and emailed the customer, `refund.failed` at 22:27:34
  undid it. Final row: `refunded_at`/`refunded_amount_cents` **cleared**, `refund_notified_at` **reset**,
  `refund_failed_at` + `refund_failure_reason = expired_or_canceled_card` set, and `/print-orders` reports
  `refunded=false`. **Two seconds** separated the optimistic success from the failure.
- 🐞 **Gap found:** `refund_id` is never stored (see s14a-2's "KNOWN GAP"). Fix deferred by Michael until the
  remaining failure paths are walked.
- ⚠ **Stripe dashboard access:** the sandbox is `acct_1TqaSvAc9G3kJl6y` ("CradleHQ LLC sandbox", registered to
  kevin@cradlehq.app), NOT Michael's own account or classic test mode. A plain `dashboard.stripe.com/test/…`
  link shows nothing; the account-scoped `dashboard.stripe.com/acct_1TqaSvAc9G3kJl6y/test/…` form works.
  **This is a pr10 question too** — D2 has Michael refunding by hand, so his login needs standing access to
  whichever account is live.

### Plumbing checks (no order needed)
- [x] ~~`./lulu-webhooks.sh test <id>`~~ — **not possible: `POST /webhooks/{id}/test/` 404s on our sandbox**
      (verified 2026-07-21; the a-track research record has been corrected). The property it was meant to prove
      — an unactionable payload must answer **200**, since five consecutive *failures* deactivate the webhook —
      is covered by POSTing a signed dummy at our own receiver directly, below.
- [ ] Unsigned / tampered / bogus-signature POSTs to `/print/lulu-webhook` → **400**.
- [ ] **Pin the signature encoding.** a-1 accepts hex OR base64 because Lulu's docs don't say and our sandbox had
      never delivered one. Read the real header off the first live delivery and **record which it is here** — then
      decide whether to narrow the check.

## Cannot be verified in this session (carry to pr10)

1. **SHIPPED + tracking.** Lulu sandbox jobs stop at `UNPAID` and never ship, so the mapper's tracking extraction
   stays fixture-tested until pr10's real smoke order. To eyeball s14c's shipped row + "Track package" link,
   hand-write `status='shipped'` + `tracking_urls` on a row in Postgres — and say so in the notes, so nobody later
   mistakes it for a live pass.
2. ~~**`refund.failed`.**~~ **SOLVED 2026-07-21 — it moves INTO the walk as order E.** Pay with card
   **`4000000000005126`** ([Stripe testing docs](https://docs.stripe.com/testing)): the charge succeeds, and a
   refund reports `succeeded` first, then flips to `failed` and fires `refund.failed`. See order E below.
3. **Mail actually arriving.** Local SMTP auth fails by design of the environment. pr10 step 5 owns proving real
   outbound delivery — until then, "the alert fired" means "the log line is there".

## ⛔ Carried out of this session (all pr10 gates)

1. ~~**🐞 `refund_id` is never stored**~~ — ✅ **FIXED + RE-VERIFIED the same day.** New `refund.created` branch
   stores the id; `refundFailed` persists it too; and `charge.refunded` now uses
   `refund_id = COALESCE(?, refund_id)` because `refund.created` fires first and a plain assignment would wipe
   what it stored. Re-verified by resending the real Stripe events, including deliberately clearing the
   redelivery guard to force the COALESCE path. See s14a-2. **s14a-2 → Complete.**
2. **📧 The failure email/copy points customers at `privacy@cradlehq.app`.** Correct per the support-channel
   note, but a customer told to email *privacy* about a printing problem reads as a misdirect at exactly the
   wrong moment. Pick a support-shaped address before launch.
3. **📮 Is `print@cradlehq.app` a real, monitored mailbox?** Every operator alert goes there
   (`app.print.operator-email`) and it's the Lulu contact. If it isn't provisioned, alerts vanish even once
   SMTP works.
4. **🔑 Stripe dashboard access.** The sandbox is `acct_1TqaSvAc9G3kJl6y` ("CradleHQ LLC sandbox", registered to
   kevin@cradlehq.app) — **not** Michael's account, and not classic test mode. D2 has Michael refunding by hand,
   so he needs standing access to whichever account is live. Discovered mid-run when the dashboard showed no
   transactions.
5. **🔍 Signature encoding still unpinned.** We accept hex **or** base64 and don't log the header, so a real
   delivery didn't reveal which Lulu sends. Harmless (both work); needs a one-line debug log if ever wanted.
6. **📉 No vendor-side delivery audit.** `GET /webhooks/{id}/submissions/` 404s on our account, so if the
   webhook silently deactivates we cannot ask Lulu why. Our logs + `GET /webhooks/` (`is_active`) are the only
   signal — which makes the sweep more load-bearing than D1 assumed and pr10's "check `is_active` after every
   deploy" a real task.
7. **Mail actually arriving** — local SMTP auth fails by design of this environment; every alert and customer
   email in this run threw and was swallowed (correctly). pr10 owns proving real delivery.

## Local DB artefacts left behind
Orders **#8–#11** on the local database are test data from this run. **#8 is marked `shipped` with fabricated
UPS tracking** (synthetic payload — see above); don't mistake it for a real shipment. #10's stored PDF urls
point at `example.com` from the phase-2 setup, so it will keep failing if ever resubmitted.

## Teardown
- [ ] `./lulu-webhooks.sh delete <id>` — a dead tunnel URL left registered will rack up failures and deactivate.
- [ ] Restore `BACKEND_URL` to `http://localhost:3001` (diff `.env` against the backup before deleting it).
- [ ] Kill cloudflared + `stripe listen`; remove any throwaway cloudflared binary.
- [ ] Revert any temporary `SWEEP_INTERVAL_MS` change.
- [ ] Decide what `PRINT_ENABLED` should be left at locally.

## Done when
- [ ] All five orders behave as above, and each of the three plans is moved from **Needs Verification** →
      **Complete** (per CLAUDE.md, only after Michael confirms).
- [ ] The three carve-outs above are written into pr10's checklist rather than quietly forgotten.
