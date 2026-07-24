# Print pr10 — Lulu live cutover

**Status:** Not started
**Est:** ~1.5–2 hours · **Depends on:** pr1–pr9 complete **+ Payments P12 (Stripe live)** **+ Lulu prod readiness
(company card on file, prod creds)** **+ `sv2-s14` a-1 + a-2 ✅ (failure detection → refund/notify, both verified 2026-07-21)** **+ `../sv2-deploy-0-first-prod-deploy.md` (run it FIRST)** · **Blocks:** the first real printed order
**Launch prompt:** `session-prompts.md` → pr10
**Sibling reference:** payments `p12-live-cutover.md` (same shape, for Stripe).

Go live with print. Swap Lulu **sandbox → production** credentials, confirm the company card auto-charge, do
print's **first-ever prod deploy** (the headless-Chrome renderer has never run on the VPS), and clear the
ToS go-live gate (privacy disclosure + physical-order refund policy).

> **⚠️ RESCOPED 2026-07-22 — the first-deploy half moved out.** This originally carried "first deploy" *and*
> "flip to real money + real print jobs" at once. **`../sv2-deploy-0-first-prod-deploy.md`** now owns the
> deploy, the 31 migrations (V23→V53), SMTP, and — critically — **wiring the PDF sidecar into
> `docker-compose.prod.yml` and proving headless Chrome renders on the VPS.** By the time you're here the
> renderer already works in prod; this session swaps Lulu sandbox→prod and clears the ToS gate.

---

## Credential lifecycle (the thing this session closes)
- **Sandbox** creds: acquired in **pr0**, used from **pr5** onward. `LULU_API_BASE=https://api.sandbox.lulu.com`.
- **Production** creds: already verified live (`lulu-verify.sh prod`, 2026-07-16). **This session swaps them onto
  the VPS** — `LULU_API_BASE=https://api.lulu.com` + prod `LULU_CLIENT_ID`/`LULU_CLIENT_SECRET`. Sandbox and
  prod are **separate universes** (separate registration, separate keys), same as Stripe test vs live.

## Steps
0. **✅ First-deploy infra — OWNED BY `../sv2-deploy-0-first-prod-deploy.md`. Do not repeat it here.**
   That session deploys the branch, runs V23→V53 (after a rehearsal on restored prod data), proves SMTP, and
   **wires the PDF sidecar into prod and renders a real book on the VPS.**

   ⚠ **The sidecar gap was real and is worth knowing about:** as of 2026-07-22 `docker-compose.prod.yml`
   contained only `caddy`, `api`, `postgres` — **no `pdf-sidecar` service and no `PRINT_SIDECAR_URL` /
   `PRINT_FRONTEND_BASE`**, so the renderer would have fallen back to `localhost:4000`/`localhost:3000` inside
   the api container and simply not worked. pr1 proved headless Chrome in Docker; it was never added to the
   prod compose. **Confirm DEPLOY-0 actually closed this before starting** — a book must already render to PDF
   on the VPS, or step 7's smoke order cannot possibly succeed.

   **Do not start this session until DEPLOY-0 is green.** Confirm: prod on `payments-v1`, Flyway at **v53**,
   a PDF rendered on the server, SMTP delivering, and P12 complete (live Stripe keys in place).
1. **Swap Lulu env to prod on the VPS:** `LULU_API_BASE=https://api.lulu.com`, prod `LULU_CLIENT_ID` /
   `LULU_CLIENT_SECRET`, confirm `LULU_POD_PACKAGE_ID` unchanged. Redeploy. Run `lulu-verify.sh` on the server.
2. **Confirm the Lulu company card is on file** for prod auto-charge (owner task — `../handoffs/`). A **paid**
   prod print job auto-charges this card; without it, submission fails.
3. **Print's variable-amount Stripe checkout in live mode** — reuses P12's live keys/webhook (pr7 builds the
   amount dynamically, so confirm whether it needs any live Price object or is pure `price_data`). No new
   fixed SKU if it's dynamic.
4. **Register the Lulu PROD webhook** — no longer optional, and no longer pr9's: s14a-1 makes
   `PRINT_JOB_STATUS_CHANGED` our primary failure detector. `POST /webhooks/ {topics:[…], url}` against the
   **prod** base with the prod `cradlehq.app` URL (sandbox and prod registrations are separate, like the keys).
   Use `Backend/lulu-webhooks.sh register <base_url>`, then confirm with `GET /webhooks/` (`is_active: true`).
   ⚠ **`POST /webhooks/{id}/test/` and `GET /webhooks/{id}/submissions/` both 404 on our account** (verified
   2026-07-21) — there is **no dummy-fire and no vendor-side delivery audit**, so if the webhook ever
   deactivates you cannot ask Lulu why. ⚠ Lulu **auto-deactivates after 5 consecutive failed deliveries**, so
   **checking `is_active` after every deploy is a real operational task**, and the s14a-1 reconciliation sweep
   is the only backstop when it flips off.
5. **✅ Outbound mail — proven in DEPLOY-0 step 4.** Just re-confirm it's still working and that
   `PRINT_OPERATOR_EMAIL` / `app.print.operator-email` points at a **real, monitored** mailbox — every operator
   alert goes there, and a failed send permanently burns the one-shot notify guard rather than retrying.
6. **⛔ ToS go-live gate (from pr0 review of Lulu's terms):**
   - **Privacy/ToS updated** to disclose that baby photos + shipping address are sent to a third-party printer
     (Lulu §2/§8). Privacy-sensitive — infant photos.
   - **Physical-order refund/reserve policy defined** — §13 caps Lulu's liability to us at the print cost, but
     we're merchant of record for the full retail price; a defective/lost book means we refund the customer and
     absorb the gap. Distinct from the digital "move the share unlock" policy. (Written up in
     `../sv2-s14-print-hardening.md` → s14d.)
   - **Physical-goods sales tax handed to the owner** — the print book is a separate, US destination-based
     sales-tax question from the digital goods; must be in the owner's hands before the first live print charge
     (see `../handoffs/tax-note-for-owner.md` → "Physical printed book" section, added pr0.5). Not a build
     blocker, but a first-live-charge gate.
   - **⛔ s14a-1 + s14a-2 landed** — failure detection (`../sv2-s14a-1-failure-detection.md`) and the
     refund/notify path (`../sv2-s14a-2-refund-and-notify.md`) are the minimum failure-handling bar before real
     money moves; a Lulu rejection after a real charge must not strand a paying customer. s14c (the order list)
     is strongly recommended alongside them but is not a hard gate.
7. **Real end-to-end smoke test:** order one real book to a real address (owner's), smallest that clears the
   32-page min, confirm Lulu prints + ships. Decide what to do with the test copy.
8. **Leave the kill switch OFF at deploy; flip it ON deliberately.** ✅ **DECIDED 2026-07-21 (Michael): print
   ships DORMANT at go-live and stays off while he's away.** That is now a firm plan, not a judgement call at
   deploy time — which also means the smoke test in step 7 is the *only* print traffic prod sees initially.
   ⛔ **Gate on flipping it ON later:** a failed order currently has no recovery path but a refund (24h PDF TTL,
   no admin re-render, customer promised a refund immediately) — see **s14e** in `../sv2-s14-print-hardening.md`
   and `plans/storybook/tech-debt.md` §5. Not a blocker for deploying dormant; is a blocker for accepting real
   orders unattended. The `app.print.enabled` flag (defined
   pr5, default `false`) means print ships **dormant** — the code is live but no order can be placed or
   submitted. Do the smoke test with `PRINT_ENABLED=true`, then **decide whether to leave it on**: if Michael
   is heading into the post-launch vacation, **turn it back OFF** and flip it on only when back and watching.
   Flip = edit `PRINT_ENABLED` in the VPS `.env`, `docker compose -f docker-compose.prod.yml up -d api`
   (~10s restart, no rebuild). Off is a "no new orders" guarantee, not a recall of in-flight jobs (s14a).

## Done when
- [ ] DEPLOY-0 green first: branch deployed, Flyway **v53**, sidecar wired, a PDF rendered **on the VPS**,
      SMTP delivering — and P12 complete (live Stripe keys).
- [ ] Lulu prod env vars live on the VPS; `lulu-verify.sh` green against `api.lulu.com` there.
- [ ] Company card on file confirmed; a real paid print job submitted and accepted by Lulu.
- [ ] Privacy/ToS disclosure of third-party printing is live; physical-order refund policy written down.
- [ ] One real-address smoke order printed and shipped.
- [ ] `PRINT_ENABLED` set deliberately after the smoke test (OFF if heading into vacation; flip on when watching).

## Not this session
Refunds / cancellation / print-job-rejection recovery → **`../sv2-s14`** (hardening). This is the happy-path
go-live only.
