# DEPLOY-0 — First production deploy (dormant: no real money, no real printing)

**Status:** Not started — **written 2026-07-21**
**Est:** ~1.5–2 hours · **Depends on:** nothing further to build — payments P1–P11, share s13a–e, print pr0–pr9
and s14a-1/a-2/s14c are all Complete · **Blocks:** **Payments P12** and **print pr10** (both should run only
after this is green)
**Read first:** `payments/p12-live-cutover.md` step 0, `print/pr10-live-cutover.md` steps 0 and 5,
`sv2-s14-verification.md` → "Carried out of this session"

Get the `payments-v1` branch onto production **without turning anything on**. Stripe stays on **test** keys,
print stays **dormant** (`PRINT_ENABLED=false`). Nothing here can move real money or print a real book.

---

## Why this exists as its own session

`payments-v1` is **~36 commits ahead of `main`** and carries **three whole features** that have never run in
production: payments, share links, and print. `cradlehq.app` is live with real users.

Both go-live plans already admit the problem — P12 step 0 and pr10 step 0 each open with "this is the FIRST
time any of this code reaches production" — which means, as currently sliced, each of them carries *first
deploy* **and** *flip to real money* in the same session. If something breaks you won't know which half did it.

Three concrete reasons to separate them:

1. **It isolates infrastructure from money.** "Does Caddy pass the raw webhook body?" and "is a real card
   charged correctly?" are different questions and deserve different sessions.
2. **It clears the SMTP gate that both go-lives depend on.** `EmailService` wraps an **optional**
   `JavaMailSender` and **silently no-ops** when SMTP isn't configured — so a misconfigured prod swallows every
   operator alert and every customer refund email with no error at all. This was observed for real during the
   s14 run (local SMTP auth fails; every alert threw and was swallowed by design). It is the single quietest
   failure mode in the system and it must be proven before either feature is live.
3. **The share track would otherwise ship unnoticed.** s13a–s13e are Complete and verified — *locally*. They
   have never run in prod, and under the current plan they'd ride along underneath two payment cutovers with
   nobody explicitly checking them.

## What is deliberately NOT in this session
Live Stripe keys · live Stripe products/prices/webhook · Lulu prod credentials · flipping `PRINT_ENABLED` on ·
the ToS/privacy update · the tax answer. Those are **P12** and **pr10**.

---

## Steps

1. **Merge/deploy the branch.** `git pull origin main && docker compose -f docker-compose.prod.yml up -d --build`
   on the Hetzner VPS (`deploy@87.99.153.7`, repo `~/gotcherapp`). Runbook: `deployment-guide.html`.
2. **Confirm env before it boots.** On the VPS `.env`: `PRINT_ENABLED=false`, Stripe still **test** keys,
   `LULU_API_BASE` still sandbox, `BACKEND_URL`/`PRINT_FRONTEND_BASE` pointed at `cradlehq.app`.
   ⚠ **`app.print.operator-email`** — set it deliberately (default `print@cradlehq.app`).
3. **App boots with the new beans.** Flyway applies **V47–V53** cleanly; check the log for
   `Successfully applied … now at version v53`. The new print beans construct without a cycle
   (`PrintOperatorAlert`, `PrintCustomerEmail`, `PrintRefundService`, `PrintOrderStatusService`,
   `LuluWebhookController`). ⚠ **Back up the database before this** — five migrations against live user data.
4. **⛔ Prove SMTP actually delivers.** Configure prod SMTP, then send **one operator alert** and **one customer
   email** for real and confirm they arrive in a mailbox someone reads.
   - Is **`print@cradlehq.app`** a real, monitored mailbox? Every operator alert goes there.
   - Remember the one-shot guards: a failed send still burns `failure_notified_at` / `refund_notified_at`, so a
     broken mailer loses those emails permanently rather than retrying.
5. **Caddy passes signed webhooks through.** Confirm `/api/billing/webhook` receives the **raw body** and the
   `Stripe-Signature` header intact (default `reverse_proxy` behaviour — verify, don't assume). Easiest proof:
   register a **test-mode** Stripe webhook endpoint against prod and send a real Stripe-originated event.
   Same question applies to `/api/print/lulu-webhook` (HMAC over the raw body) — pr10 registers it for real.
6. **Headless Chrome renders on the VPS.** The biggest prod-specific print risk, and nothing to do with Lulu:
   confirm the sidecar/Chromium layer is in `docker-compose.prod.yml`, render one real book to PDF **on the
   server**, and open it. Fonts, Chromium deps and memory are the usual failures.
7. **Share links work in prod** (never yet exercised there): open a book's share link in a logged-out browser,
   confirm the public page renders, the work-in-progress gate behaves, and revoke works.
8. **Payments smoke on TEST keys, in prod.** One 4242 purchase against the deployed app → credits granted via
   the prod webhook path. This proves the whole chain end-to-end with fake money.
9. **Confirm print is genuinely dormant.** `/auth/me` returns `print_enabled: false` and the checkout endpoint
   returns **409 with no Stripe session** (verified behaviour, s14 run). No print UI entry point renders.

## Done when
- [ ] Branch deployed; app boots; Flyway at **v53**; DB backed up beforehand.
- [ ] **A real email arrived in a real inbox** — both an operator alert and a customer email.
- [ ] A Stripe-originated (not CLI) webhook verifies its signature through Caddy in prod.
- [ ] A book renders to PDF **on the VPS**.
- [ ] Share links work in production.
- [ ] A test-key purchase grants credits in prod.
- [ ] Print is dormant and provably un-orderable.
- [ ] No real money has moved and no book has been printed.

## Then, in order
**P12** (Stripe live) → **pr10** (Lulu prod, leaving `PRINT_ENABLED=false`) → later, once back from vacation and
**s14e** (failed-order recovery) is settled, flip print on.

## ⚠️ Rollback
The riskiest step is #3 — V47–V53 against live user data. All seven are **additive** (new tables + new columns,
no drops or rewrites), so the old app version runs fine against the new schema; a rollback is a redeploy of the
previous image, not a schema restore. Take the backup anyway.
