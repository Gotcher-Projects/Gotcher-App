# SV2 Launch Night — Web go-live runbook (DEPLOY-0 + P12)

**Status:** Not started — **written 2026-07-23**, for the launch run **2026-07-24 evening**
**Scope:** Web launch only — get the merged code running in prod (DEPLOY-0) **and** flip Stripe to real money (P12),
in one night. **Print stays dormant** (`PRINT_ENABLED=false`). **Mobile app submission is NOT in this runbook** —
it can't go live same-night anyway (store review latency) and is gated on the Apple owner/certs.
**Est:** ~3.5–5 hours with buffer.
**Source plans (this file tightens + sequences them):** `sv2-deploy-0-first-prod-deploy.md` → `payments/p12-live-cutover.md`.
Read those if a step needs more detail; this file is the night-of checklist.

> **How to use this:** work top to bottom, one checkbox at a time. Do **not** start a phase until the prior
> phase's gate (⛔) is green. If walking through with a Claude session, paste each command's output back before
> moving on.

---

## Current state (as of 2026-07-23, so you don't re-derive it)
- ✅ Code is **merged to `main`** — tomorrow's deploy is `git pull origin main`, not a branch checkout.
- ✅ **D1 done:** `docker-compose.prod.yml` now has the `pdf-sidecar` service + `PRINT_SIDECAR_URL` /
  `PRINT_FRONTEND_BASE` / `PRINT_OPERATOR_EMAIL`. Already on `main`.
- ✅ **Live Stripe products/prices created** (prep A2) and **live webhook registered** (prep A3) at
  `https://cradlehq.app/api/billing/webhook`, events: `checkout.session.completed`, `charge.refunded`,
  `refund.created`, `refund.failed`.
- ✅ SMTP + DKIM DNS **configured** (prep C1) — but **delivery is unproven in prod** (hard gate in Phase 1).
- ⚠️ **Migration rehearsal NOT completed.** On 2026-07-23 the dump + restore + baseline counts were done
  (27 users / 18 journal / 124 milestones, Flyway v22), but the actual **V23→V53 rehearsal (0c/0d) never ran.**
  Phase 0 below does it fresh.

## ⛔ Pre-flight — have these IN HAND before you start (5 min)
Missing one of these strands you mid-cutover.
- [ ] **VPS SSH access:** `ssh deploy@87.99.153.7`, repo at `~/gotcherapp`.
- [ ] **Owner confirmation** that the **live Stripe account is fully activated** and can accept live charges (prep A1).
- [ ] **`sk_live_…`** Stripe secret key (from Stripe dashboard — NOT in the repo).
- [ ] **Live `whsec_…`** webhook signing secret (you stashed it privately during prep A3 — find it now).
- [ ] **Four live price IDs** (from `sv2-prelaunch-prep.md` A2 table):
  - `STRIPE_PRICE_CREDITS_50` = `price_1TwDZMPES2YeEB5J6sjwEWi2`
  - `STRIPE_PRICE_CREDITS_125` = `price_1TwDfGPES2YeEB5J9Klnorl5`
  - `STRIPE_PRICE_BUNDLE_SHARE_150` = `price_1TwDgWPES2YeEB5JbNJsLwRB`
  - `STRIPE_PRICE_SHARE_ONLY` = `price_1TwDhoPES2YeEB5Jh4U2cGXM`
- [ ] A **real card** for the P12 smoke test (you'll refund yourself).
- [ ] Confirm **`privacy@cradlehq.app`** is a real, monitored mailbox (operator alerts + the SMTP proof land there).
      Set `PRINT_OPERATOR_EMAIL=privacy@cradlehq.app` in the VPS `.env` (overrides the compose default of `print@cradlehq.app`).

---

## Phase 0 — Backup + migration rehearsal ⛔ THE RISKIEST STEP (45–75 min)
31 migrations run at once; four are destructive (V42 TRUNCATE, V43 DELETE, V45/V48 DROP). Rollback = restore the
dump. Prove it works on a throwaway copy **before** touching prod.

### 0a — Fresh backup (read-only against prod)
```bash
ssh deploy@87.99.153.7
cd ~/gotcherapp                                  # NOTE the slash — `cd ~gotcherapp` fails
mkdir -p ~/backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U gotcherapp_app -d gotcherapp -Fc > ~/backups/prod-$(date +%Y%m%d-%H%M).dump
ls -lh ~/backups/                                # ⛔ MUST be non-trivial size, NOT 0 bytes
DUMP=$(ls -t ~/backups/*.dump | head -1)         # set from the real file — don't hand-type the name
echo "$DUMP" && ls -lh "$DUMP"
```
- [ ] Dump file exists and is **non-zero** (today it was ~87K — small is fine, photos live in Cloudinary).

### 0b — Prove it restores + baseline counts
```bash
docker network create rehearsal 2>/dev/null || true
docker run -d --name rehearsal-db --network rehearsal \
  -e POSTGRES_DB=gotcherapp -e POSTGRES_USER=gotcherapp_app -e POSTGRES_PASSWORD=rehearsal postgres:16
sleep 10
docker cp "$DUMP" rehearsal-db:/tmp/prod.dump
docker exec rehearsal-db pg_restore -U gotcherapp_app -d gotcherapp --clean --if-exists /tmp/prod.dump

# baseline — WRITE THESE DOWN (tomorrow's numbers, may differ from today's 27/18/124)
docker exec rehearsal-db psql -U gotcherapp_app -d gotcherapp -c \
 "SELECT 'users' t, count(*) FROM users
  UNION ALL SELECT 'journal_entries', count(*) FROM journal_entries
  UNION ALL SELECT 'milestones', count(*) FROM milestones;"
docker exec rehearsal-db psql -U gotcherapp_app -d gotcherapp -tAc \
 "SELECT max(version::numeric) FROM flyway_schema_history;"   # expect 22
```
- [ ] Restore succeeded (harmless `--if-exists` NOTICEs are fine); baseline counts recorded; Flyway = **22**.

### 0c — Rehearse V23→V53 against the copy
```bash
git fetch && git checkout main && git pull
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml config --images     # find the api image (likely gotcherapp-api)
docker run --rm --network rehearsal \
  -e PGHOST=rehearsal-db -e PGUSER=gotcherapp_app -e PGPASSWORD=rehearsal -e PGDATABASE=gotcherapp \
  -e JWT_SECRET=rehearsal-only-not-a-real-secret-0123456789abcdef -e PRINT_ENABLED=false \
  <api-image-name>
```
Watch for `Successfully applied … now at version v53`, then Spring `Started …`. **Ctrl-C** once booted.
(Ignore missing Cloudinary/Stripe/SMTP errors — they don't affect migrations.)
⚠️ **`JWT_SECRET` must be ≥ 32 bytes** — JJWT rejects shorter keys with a `WeakKeyException` in `JwtUtil`'s
constructor, which crashes the boot *before Flyway runs* (web-server/security beans init first). A crash with
no Flyway lines in the log = key too short, migrations never ran; the copy is still at v22, just re-run.

### 0d — Confirm nothing lost, tear down
```bash
docker exec rehearsal-db psql -U gotcherapp_app -d gotcherapp -tAc \
 "SELECT max(version::numeric) FROM flyway_schema_history;"   # expect 53
# re-run the 0b counts — users / journal_entries / milestones must be UNCHANGED
docker rm -f rehearsal-db && docker network rm rehearsal
```
- [ ] ⛔ **Gate:** Flyway reached **v53** and the three counts are **unchanged**. If not, STOP — do not deploy.

---

## Phase 1 — DEPLOY-0: deploy dormant, on TEST keys (1.5–2.5 hr)
The app reaches prod for the first time. Stripe stays **test**, print stays **dormant**. No real money yet.

### 1a — Confirm env BEFORE it boots
On the VPS `.env`, verify:
- [ ] `PRINT_ENABLED=false`
- [ ] Stripe still **TEST** keys (`sk_test_…`, test `whsec_…`, test/blank price ids)
- [ ] `LULU_API_BASE` still sandbox (or blank)
- [ ] `APP_DOMAIN=cradlehq.app` (drives `PRINT_FRONTEND_BASE=https://cradlehq.app`)

### 1b — Deploy
```bash
cd ~/gotcherapp && git pull origin main
docker compose -f docker-compose.prod.yml up -d --build      # now also builds pdf-sidecar
docker compose -f docker-compose.prod.yml ps                 # caddy, api, postgres, pdf-sidecar all up
```

### 1c — ⛔ Watch Flyway apply V23→V53 on real prod
```bash
docker compose -f docker-compose.prod.yml logs -f api | grep -iE "flyway|migrat|version|started|cycle|error"
```
- [ ] `Successfully applied … now at version v53`
- [ ] Print beans construct (no cycle): `PrintOperatorAlert`, `PrintCustomerEmail`, `PrintRefundService`,
      `PrintOrderStatusService`, `LuluWebhookController`.

### 1d — ⛔ Prove SMTP actually delivers (the quietest failure in the system)
`EmailService` silently no-ops if SMTP is misconfigured. Send one real operator alert + one customer email and
**see them arrive** in a real inbox. (Ask the walking-through session for the exact trigger — likely a test
endpoint or a throwaway action. A failed send burns the one-shot notify guard, so this must be a live send.)
- [ ] Operator alert arrived at `privacy@cradlehq.app` (via `PRINT_OPERATOR_EMAIL` in `.env`).
- [ ] A customer email arrived in a real inbox.

### 1e — Caddy passes the raw webhook body + `Stripe-Signature`
Register a **test-mode** Stripe webhook against prod and send a real Stripe-originated event; confirm signature
verifies (not just a CLI event).
- [ ] A test-mode Stripe event verified through Caddy in prod.

### 1f — Render a book → PDF on the VPS (proves the sidecar wiring from D1)
- [ ] A real book renders to PDF **on the server** and opens (watch for Chromium/font/memory errors).

### 1g — Share links work in prod (never exercised there)
- [ ] Open a book share link logged-out: public page renders, WIP gate behaves, revoke works.

### 1h — Payments smoke on TEST keys
- [ ] One 4242 purchase against the deployed app grants credits via the **prod** webhook path.

### 1i — Confirm print is genuinely dormant
- [ ] `/auth/me` returns `print_enabled: false`; print checkout returns **409** (no Stripe session); no print UI entry point.

- [ ] ⛔ **Gate:** everything in Phase 1 green before touching live keys.

---

## Phase 2 — P12: flip fake money → real money (1–1.5 hr)
The only thing that changes: test → live. **All six env vars change, not just the secret.**

### 2a — Confirm you're clear to flip
- [ ] Prod on `main`, Flyway **v53**, the Phase 1h test purchase granted credits.
- [ ] Owner's definitive "live Stripe account activated" (from pre-flight).

### 2b — Swap all six live env vars on the VPS `.env`, then redeploy
- [ ] `STRIPE_SECRET_KEY=sk_live_…`
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_…` (the **live** one)
- [ ] `STRIPE_PRICE_CREDITS_50` / `_125` / `_BUNDLE_SHARE_150` / `_SHARE_ONLY` = the four `price_1…` ids above
```bash
docker compose -f docker-compose.prod.yml up -d api           # picks up new env; ~10s, no full rebuild needed
```

### 2c — Confirm the live Radar US-only rule is active
- [ ] `Block if :card_country: != 'US'` active in **live** Radar (added in P8; this is a confirm, not a create).

### 2d — Real-card smoke test + refund
- [ ] Buy the **smallest SKU** with a real card → credits granted.
- [ ] **Refund yourself** in the Stripe dashboard.

### 2e — Watch the first real webhook + verify the refund path
- [ ] The live `checkout.session.completed` event lands in the Stripe event log and the grant is recorded.
- [ ] The refund (`charge.refunded` / `refund.created`) is **ignored cleanly** by the print refund path
      (no print order matches the PaymentIntent — the s14a-2 guard doing its job).

### 2f — Confirm print STILL dormant after the live redeploy
- [ ] `/auth/me` → `print_enabled: false`; print checkout still **409**.

---

## ✅ Done when
- [ ] Phase 0 gate green (v53 on the copy, counts unchanged).
- [ ] App live on `main`, Flyway **v53** in prod, all four containers up.
- [ ] A real email arrived in a real inbox (operator + customer).
- [ ] A Stripe-originated webhook verified through Caddy.
- [ ] A book rendered to PDF on the VPS.
- [ ] Share links work in prod.
- [ ] Live keys deployed; a real-card purchase granted and was refunded; live webhook verified.
- [ ] Live Radar US-only rule confirmed.
- [ ] Print is dormant and provably un-orderable (`print_enabled: false`, checkout 409).

## ⚠️ Rollback — read before Phase 1c
**A rollback is a database restore, not a redeploy.** Once V53 has run there is no scripted way back to V22.
If the deploy corrupts data: restore the Phase 0a dump onto prod Postgres. This is why Phase 0's rehearsal is
mandatory — if it was clean on a real-data copy, the live run is very likely clean too.

## NOT tonight
Lulu prod credentials / flipping `PRINT_ENABLED` on (that's **pr10**, print stays dormant) · the ToS print
disclosure · mobile app submission (separate session; store review is 24–48h regardless).
