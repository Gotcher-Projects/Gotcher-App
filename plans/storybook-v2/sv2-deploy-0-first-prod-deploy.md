# DEPLOY-0 — First production deploy (dormant: no real money, no real printing)

**Status:** Not started — **written 2026-07-21**
**Est:** ~3–4 hours (grew 2026-07-22: step 0's backup + migration rehearsal, and wiring the PDF sidecar which
turned out to be missing from prod entirely) · **Depends on:** ⛔ **`sv2-review-0-branch-review.md` — the 5-pass review, with every
ship-blocker closed.** Nothing left to *build*: payments P1–P11, share s13a–e, print pr0–pr9 and s14a-1/a-2/s14c
are all Complete · **Blocks:** **Payments P12** and **print pr10** (both should run only
after this is green)
**Read first:** `payments/p12-live-cutover.md` step 0, `print/pr10-live-cutover.md` steps 0 and 5,
`sv2-s14-verification.md` → "Carried out of this session"

Get the `payments-v1` branch onto production **without turning anything on**. Stripe stays on **test** keys,
print stays **dormant** (`PRINT_ENABLED=false`). Nothing here can move real money or print a real book.

---

## Why this exists as its own session

`main` is at **2026-04-28** and stops at migration **V22**. `payments-v1` carries **~3 months of work** that has
never run in production — mobile v1, journal updates, the whole of storybook-v2, pregnancy, first-times,
payments, share links and print. **258 code files, ~24.8k insertions, 31 migrations.** `cradlehq.app` is live
with real users the whole time.

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

## Step 0 — Backup + migration rehearsal (do this FIRST, on its own)

⚠ Commands below are written from `docker-compose.prod.yml` (service `postgres`, db `gotcherapp`, user
`gotcherapp_app`) but have **not been run against the real VPS** — confirm names/paths on the box before trusting.

```bash
# ── 0a. Back up production, BEFORE pulling the branch ──────────────────────────
ssh deploy@87.99.153.7
cd ~/gotcherapp && mkdir -p ~/backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U gotcherapp_app -d gotcherapp -Fc > ~/backups/prod-$(date +%Y%m%d-%H%M).dump
ls -lh ~/backups/                       # sanity: must be a non-trivial size
DUMP=~/backups/prod-XXXXXXXX-XXXX.dump  # fill in the real filename

# ── 0b. Prove the dump RESTORES (an unverified backup is not a backup) ────────
docker network create rehearsal 2>/dev/null || true
docker run -d --name rehearsal-db --network rehearsal \
  -e POSTGRES_DB=gotcherapp -e POSTGRES_USER=gotcherapp_app -e POSTGRES_PASSWORD=rehearsal postgres:16
sleep 10
docker cp "$DUMP" rehearsal-db:/tmp/prod.dump
docker exec rehearsal-db pg_restore -U gotcherapp_app -d gotcherapp --clean --if-exists /tmp/prod.dump

# baseline BEFORE migrating — write these numbers down
docker exec rehearsal-db psql -U gotcherapp_app -d gotcherapp -c \
 "SELECT 'users' t, count(*) FROM users
  UNION ALL SELECT 'journal_entries', count(*) FROM journal_entries
  UNION ALL SELECT 'milestones', count(*) FROM milestones;"
docker exec rehearsal-db psql -U gotcherapp_app -d gotcherapp -tAc \
 "SELECT max(version::numeric) FROM flyway_schema_history;"   # expect 22

# ── 0c. Rehearse V23→V53 against the restored COPY ────────────────────────────
git fetch && git checkout payments-v1 && git pull
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml config --images   # get the api image name
docker run --rm --network rehearsal \
  -e PGHOST=rehearsal-db -e PGUSER=gotcherapp_app -e PGPASSWORD=rehearsal -e PGDATABASE=gotcherapp \
  -e JWT_SECRET=rehearsal-only -e PRINT_ENABLED=false \
  <api-image-name>

# ── 0d. Confirm nothing was lost ──────────────────────────────────────────────
docker exec rehearsal-db psql -U gotcherapp_app -d gotcherapp -tAc \
 "SELECT max(version::numeric) FROM flyway_schema_history;"   # expect 53
# re-run the 0b counts — users / journal_entries / milestones must be UNCHANGED
# then tear down:
docker rm -f rehearsal-db && docker network rm rehearsal
```

**Only proceed past here if the counts match and Flyway reached v53.**

## Steps

1. **Merge/deploy the branch.** `git pull origin main && docker compose -f docker-compose.prod.yml up -d --build`
   on the Hetzner VPS (`deploy@87.99.153.7`, repo `~/gotcherapp`). Runbook: `deployment-guide.html`.
2. **Confirm env before it boots.** On the VPS `.env`: `PRINT_ENABLED=false`, Stripe still **test** keys,
   `LULU_API_BASE` still sandbox, `BACKEND_URL`/`PRINT_FRONTEND_BASE` pointed at `cradlehq.app`.
   ⚠ **`app.print.operator-email`** — set it deliberately (default `print@cradlehq.app`).
3. **⛔ App boots and Flyway applies THIRTY-ONE migrations.** Production is at **V22** — this deploy applies
   **V23 → V53** in one run. Check the log for `Successfully applied … now at version v53`, and that the new
   print beans construct without a cycle (`PrintOperatorAlert`, `PrintCustomerEmail`, `PrintRefundService`,
   `PrintOrderStatusService`, `LuluWebhookController`).

   ⚠ **They are NOT all additive.** Four contain destructive statements:
   | migration | statement |
   |---|---|
   | `V42__create_books.sql` | `TRUNCATE storybook_chapters`, plus `DROP COLUMN` ×3 |
   | `V43__retire_period_chapters.sql` | `DELETE FROM storybook_chapters …`, `DELETE FROM books …` |
   | `V45__drop_family_is_step.sql` | `DROP COLUMN is_step` |
   | `V48__rekey_book_share_tokens.sql` | `DROP TABLE book_share_tokens` |

   **Every one of those targets a table created earlier in this same run** (`storybook_chapters` V24, `books`
   V42, `book_share_tokens` V25, `family_members` V41), so they destroy *intermediate* state, not the live
   users/journal/milestone data that predates V22. That is reassuring but it is **not** the same as safe —
   V27 backfills `storybook_chapters` from existing journal content before V42 truncates it.

   **Therefore:** ⛔ **take a full `pg_dump` first**, and ⛔ **rehearse the whole V23→V53 run against a restored
   copy of production data** before doing it live. This is the single riskiest step of the entire launch.
4. **⛔ Prove SMTP actually delivers.** Configure prod SMTP, then send **one operator alert** and **one customer
   email** for real and confirm they arrive in a mailbox someone reads.
   - Is **`print@cradlehq.app`** a real, monitored mailbox? Every operator alert goes there.
   - Remember the one-shot guards: a failed send still burns `failure_notified_at` / `refund_notified_at`, so a
     broken mailer loses those emails permanently rather than retrying.
5. **Caddy passes signed webhooks through.** Confirm `/api/billing/webhook` receives the **raw body** and the
   `Stripe-Signature` header intact (default `reverse_proxy` behaviour — verify, don't assume). Easiest proof:
   register a **test-mode** Stripe webhook endpoint against prod and send a real Stripe-originated event.
   Same question applies to `/api/print/lulu-webhook` (HMAC over the raw body) — pr10 registers it for real.
6. **⛔ Wire the PDF sidecar into prod, then render a book on the VPS.**
   **Confirmed gap (2026-07-22): `docker-compose.prod.yml` has only `caddy`, `api`, `postgres`.** There is **no
   `pdf-sidecar` service**, and neither `PRINT_SIDECAR_URL` nor `PRINT_FRONTEND_BASE` is set — so inside the api
   container they fall back to `localhost:4000` and `localhost:3000`, where nothing is listening. **Print
   rendering cannot work in production as things stand.** pr1 proved headless Chrome works on host and in
   Docker; it was simply never added to the prod compose.

   Do it here rather than in pr10, even though print ships dormant: it's a compose change with no app-code risk,
   and discovering a Chromium/font/memory problem during pr10 — mid-cutover, with a real card and a real order —
   is far worse than discovering it now. A working renderer that nothing calls is harmless.
   - Add the `pdf-sidecar` service (mirror `Backend/docker-compose.yml` / `start-services.sh`).
   - Set `PRINT_SIDECAR_URL: http://pdf-sidecar:4000` and `PRINT_FRONTEND_BASE: https://${APP_DOMAIN}`.
   - Consider adding `PRINT_OPERATOR_EMAIL` too — it currently has no compose entry, so it can only ever take
     its default.
   - Then render one real book → PDF **on the server** and open it. Fonts, Chromium deps and memory are the
     usual failures.
7. **Share links work in prod** (never yet exercised there): open a book's share link in a logged-out browser,
   confirm the public page renders, the work-in-progress gate behaves, and revoke works.
8. **Payments smoke on TEST keys, in prod.** One 4242 purchase against the deployed app → credits granted via
   the prod webhook path. This proves the whole chain end-to-end with fake money.
9. **Confirm print is genuinely dormant.** `/auth/me` returns `print_enabled: false` and the checkout endpoint
   returns **409 with no Stripe session** (verified behaviour, s14 run). No print UI entry point renders.

## Done when
- [ ] **Step 0 done:** dump taken, dump proven restorable, V23→V53 rehearsed on the copy, row counts unchanged.
- [ ] Branch deployed; app boots; Flyway at **v53** in production.
- [ ] `pdf-sidecar` service + `PRINT_SIDECAR_URL`/`PRINT_FRONTEND_BASE` added to `docker-compose.prod.yml`.
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

## ⚠️ Rollback — read before step 3
**A rollback is a database restore, not a redeploy.** 31 migrations run at once and four of them drop, truncate
or delete. Once V53 has run there is no scripted way back to V22 — Flyway has no down-migrations here.

So the plan is: **`pg_dump` before, rehearse on a restored copy first, and treat "restore the dump" as the only
rollback.** If the rehearsal on real data is clean, the live run is very likely clean too — but do the
rehearsal, because this is the one step that can lose a real family's memories rather than just break a page.

- [ ] `pg_dump` of production taken and **verified restorable** (restore it somewhere and check row counts).
- [ ] Full V23→V53 run rehearsed against that restored copy; app boots against the result.
- [ ] Spot-check after the rehearsal: existing users, journal entries, milestones and photos all still present.
