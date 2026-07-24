# SV2 Pre-launch prep — front-loadable work (no deploy, no real money)

**Status:** Not started — **written 2026-07-22**
**Purpose:** collect everything that can be done *ahead of* the cutover sessions so those sessions get shorter
and less risky. **Nothing in this plan deploys the branch, moves real money, prints a real book, or changes the
behaviour of the live site.** It is staging + de-risking only.
**Feeds:** `sv2-deploy-0-first-prod-deploy.md` → `payments/p12-live-cutover.md` → `print/pr10-live-cutover.md`
(run those, in that order, when the actual cutover happens — this plan just front-loads pieces of them).

> Why this exists: the three cutover plans each bundle "first-ever prod work" with "flip the switch." A lot of
> what they list is inert prep — creating live Stripe products, drafting the ToS, provisioning SMTP, rehearsing
> the migration — that can be finished early with zero effect on the running app. Doing it here means cutover
> day is mostly verification, not first-time setup.

## Ownership legend
- **[OWNER]** — LLC owner's task (vendor accounts are LLC-owned; Michael may not have direct access). Kick these
  off first; they have human latency.
- **[MICHAEL]** — Michael can do directly.
- **[REPO]** — a change on the `payments-v1` branch; no prod contact at all.

Each task notes which cutover step it satisfies. The cutover session still **re-confirms** every item — finishing
it here just means the check passes immediately instead of being first-time work.

---

## Group A — Vendor / owner-gated external setup

### A1. Confirm the live Stripe account is activated  **[OWNER]**  → P12 blocker
Live mode needs the LLC account activated (business details, EIN, bank, identity — P0.5 #1). P12 says it
*appears* activated but requires a **definitive yes**. This gates A2/A3.
- [ ] Owner confirms the live Stripe account is fully activated and can accept live charges.

### A2. Create the four live-mode Products/Prices  **[OWNER]** (or Michael if he has dashboard access)  → P12 step 1
Creating live Products/Prices is **inert** — it charges no one and the deployed app ignores them until the P12
env swap points `stripe.price.*` at these IDs. Use `stripe-add-products-guide.html` (repo root; same four SKUs).
- [x] Recreate all four Products in **live** mode with **matching `sku` + `credits` metadata** (must match the
      grant/webhook logic — the guide specifies it). **Done 2026-07-22.** (Metadata added to both Price and Product;
      only the **Price** copy is read by the code — the Product copy is harmless but a drift risk.)
- [x] **Record the four live price IDs** for the P12 env swap:

  | env var | live price ID | sku / credits |
  |---|---|---|
  | `STRIPE_PRICE_CREDITS_50` | `price_1TwDZMPES2YeEB5J6sjwEWi2` | `credits_50` / 50 |
  | `STRIPE_PRICE_CREDITS_125` | `price_1TwDfGPES2YeEB5J9Klnorl5` | `credits_125` / 125 |
  | `STRIPE_PRICE_BUNDLE_SHARE_150` | `price_1TwDgWPES2YeEB5JbNJsLwRB` | `bundle_share_150` / 150 |
  | `STRIPE_PRICE_SHARE_ONLY` | `price_1TwDhoPES2YeEB5Jh4U2cGXM` | `share_only` / 0 |

  (Price IDs are not secret — safe to keep here. The `sk_live_…` secret key is NOT recorded anywhere in the repo.)
- ℹ Print checkout is variable-amount `price_data` — it needs **no** live Price object, so nothing to create for print.

### A3. Register the live Stripe webhook (optional-early)  **[OWNER]**  → P12 step 2
Also inert — Stripe has no live events to deliver until a live charge exists. Doing it now just captures the
`whsec_` early.
- [x] Register live endpoint `https://cradlehq.app/api/billing/webhook`; **record the live `whsec_`** for P12.
      **Done 2026-07-22** (Workbench → Webhooks, CradleHQ LLC live). Events subscribed: `checkout.session.completed`,
      `charge.refunded`, `refund.created`, `refund.failed`. ⚠ **`whsec_` is NOT recorded in the repo** — Michael
      stashed it privately; P12 pulls it into `STRIPE_WEBHOOK_SECRET` on the VPS. Endpoint will show failed/no
      deliveries until DEPLOY-0 ships the branch (expected — the route doesn't exist in prod yet).

### A4. Confirm the live Radar US-only rule is active  **[OWNER/MICHAEL]**  → P12 step 4
✅ Already **added in live** during P8 (2026-07-12). This is a confirm, not a create.
- [~] Treated as good 2026-07-22, but **deliberately NOT closed here** — reconfirm `Block if :card_country: != 'US'`
      is active in **live** Radar **at P12 cutover** (Michael's call: verify it alongside everything else on the day).

### A5. Confirm the Lulu company card is on file for prod auto-charge  **[OWNER]**  → pr10 step 2
A paid prod print job auto-charges this card; without it, submission fails. Lulu prod creds themselves are
already verified (`lulu-verify.sh prod`, 2026-07-16) — nothing to do there but hold them.
- [ ] Owner confirms a company card is on file in the **prod** Lulu account.

> **⏸ Deferred by Michael 2026-07-22 — not needed yet, and that's fine.** Launch ships with **all Lulu/print work
> OFF** (`PRINT_ENABLED=false`, dormant), so no real print job — and therefore no Lulu card charge — can happen
> until print is deliberately flipped on well after cutover. **Action when ready: email the owner** to confirm the
> card. pr10 step 2 re-confirms it before the first smoke order regardless, so this is only an early heads-up.
>
> Ready-to-send blurb for that email:
> *"Quick Lulu check for when we turn on physical books: can you confirm the LLC's Lulu account has a valid,
> non-expired company card on file as the payment method for Print API orders? Lulu auto-charges that card for
> each real print job (printing + shipping), so it needs to be there before we accept any live print orders.
> No rush — print is launching switched off, so this isn't blocking anything yet."*

---

## Group B — Content / legal → **MOVED INTO pr10 (2026-07-22, Michael)**

> **All of B is now tracked in `print/pr10-live-cutover.md` step 6 (the ToS go-live gate), not here.** Decision:
> since launch ships **print OFF/dormant**, no baby photos or shipping addresses reach Lulu and no physical charge
> happens until print is deliberately enabled — so these are **print-on gates**, the same slack as A5, and belong
> with the rest of the pr10 print-go-live work. Nothing in B blocks DEPLOY-0 or P12.

The three items (kept here only as an index; pr10 step 6 is the source of truth):
- **B1 — Privacy/ToS third-party-printing disclosure.** Current `Frontend/public/privacy.html` is v1.1 and its
  §4 "How We Share" lists only cloud/payment/email providers — **no printer, and §2 omits shipping address**.
  Needs: §2 add shipping address (print orders only); §4 add the print-on-demand fulfilment provider that
  receives selected photos + shipping address; bump version. Open choice: name **Lulu** vs generic
  "third-party print-on-demand provider" (lean generic). `terms.html` has **no** print/refund content today.
- **B2 — Physical-order refund policy.** Needs Michael's **business decisions** first (trigger events, reprint
  vs refund, reporting window, cancellation-once-submitted, return required). Economics: full-retail refund,
  Lulu reimburses only print cost, ~$1.32 Stripe fee not returned. Write-up = s14d (deferred/unwritten).
- **B3 — Physical-goods sales-tax handoff.** Already drafted in `handoffs/tax-note-for-owner.md` ("Physical
  printed book" section, added 2026-07-16); just needs to reach the owner before the first live print charge —
  bundle with the A5 email. (Digital tax note already sent 2026-07-21.)

---

## Group C — Infra lead-time (start now for propagation)

### C1. SMTP provider + domain auth DNS  **[MICHAEL/OWNER]**  → DEPLOY-0 step 4
DEPLOY-0 makes "prove SMTP delivers" a **hard gate**, and `EmailService` silently no-ops when SMTP isn't
configured (the quietest failure in the system). DNS (SPF/DKIM) propagation has real lead time, so provision
ahead — the deploy then just consumes ready credentials.
- [~] SMTP provider account created (Resend / Gmail / etc. per `Backend/.env.example`).
- [~] SPF + DKIM DNS records for `cradlehq.app` published and verified.
- [~] Confirm **`print@cradlehq.app`** (the operator-alert / `PRINT_OPERATOR_EMAIL` mailbox) is real and monitored.
> **Michael confirms C is done 2026-07-22** — SMTP + DNS + mailbox in place. **Reconfirm at DEPLOY-0** by actually
> sending one operator alert + one customer email and seeing them arrive (DEPLOY-0 step 4 hard gate; the mailer
> silently no-ops if misconfigured, so a live send is the only real proof).

---

## Group D — Repo prep (stageable on the branch, no prod contact)

### D1. Add the `pdf-sidecar` service to `docker-compose.prod.yml`  **[REPO]**  → DEPLOY-0 step 6
Confirmed gap (2026-07-22): prod compose has only `caddy`/`api`/`postgres` — **no `pdf-sidecar`**, and neither
`PRINT_SIDECAR_URL` nor `PRINT_FRONTEND_BASE` is set, so the renderer would fall back to `localhost` inside the
api container and silently not work. Compose-only change, **no app-code risk** — prepping it here takes it off the
cutover critical path (a working renderer nothing calls is harmless).
- [ ] Add `pdf-sidecar` service (mirror `Backend/docker-compose.yml` / `start-services.sh`).
- [ ] Set `PRINT_SIDECAR_URL: http://pdf-sidecar:4000` and `PRINT_FRONTEND_BASE: https://${APP_DOMAIN}`.
- [ ] Add a `PRINT_OPERATOR_EMAIL` compose entry (currently none — it can only take its default otherwise).
- ℹ Committing this now is safe: it only takes effect on the next prod deploy, which is DEPLOY-0 itself.

---

## Group E — Offline de-risking (highest-value; touches prod read-only)

### E1. Rehearse the V23→V53 migration on a restored copy  **[MICHAEL]**  → DEPLOY-0 step 0
The single riskiest step of the whole launch (31 migrations, four destructive) is **fully rehearsable offline**:
a read-only `pg_dump` of prod + a throwaway container. Doing it ahead means deploy day re-runs something already
proven green. Full command sequence is in `sv2-deploy-0-first-prod-deploy.md` → Step 0.
- [ ] `pg_dump` of production taken (read-only) and **proven restorable** (restore + row counts).
- [ ] Full V23→V53 run rehearsed against the restored copy; app boots against the result; Flyway reaches **v53**.
- [ ] Spot-check: existing users / journal entries / milestones / photos all still present (counts unchanged).
- ⚠ This does **not** replace re-taking a fresh dump immediately before the real DEPLOY-0 run — prod keeps
      changing. It de-risks the *procedure*, not the specific bytes.

---

## Suggested order
1. **Kick off owner-latency items first:** A1→A2 (Stripe products) and A5 (Lulu card). These wait on a human.
2. **In parallel, the content/legal (B1–B3)** — no dependencies, just writing.
3. **C1 (SMTP + DNS)** early, for propagation lead time.
4. **D1 (repo sidecar block)** whenever — it's a small branch commit.
5. **E1 (migration rehearsal)** — the best thing Michael can finish solo; do it once the branch is deploy-ready.

## What this plan explicitly does NOT do
Deploy the branch · run migrations against real prod · swap any live env vars · flip `PRINT_ENABLED` · move real
money · print a real book. All of that stays in **DEPLOY-0 → P12 → pr10**, in that order.
