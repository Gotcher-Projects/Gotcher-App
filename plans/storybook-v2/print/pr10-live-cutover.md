# Print pr10 — Lulu live cutover

**Status:** Not started
**Est:** ~1.5–2 hours · **Depends on:** pr1–pr9 complete **+ Payments P12 (Stripe live)** **+ Lulu prod readiness
(company card on file, prod creds)** **+ `sv2-s14` s14a (rejection→refund path)** · **Blocks:** the first real printed order
**Launch prompt:** `session-prompts.md` → pr10
**Sibling reference:** payments `p12-live-cutover.md` (same shape, for Stripe).

Go live with print. Swap Lulu **sandbox → production** credentials, confirm the company card auto-charge, do
print's **first-ever prod deploy** (the headless-Chrome renderer has never run on the VPS), and clear the
ToS go-live gate (privacy disclosure + physical-order refund policy).

> **⚠️ First time any print code reaches production.** Like payments (deferred entirely to P12), print stays
> local/sandbox until done — `cradlehq.app` is live with real users. This session carries both "first deploy"
> *and* "flip to real money + real print jobs" at once.

---

## Credential lifecycle (the thing this session closes)
- **Sandbox** creds: acquired in **pr0**, used from **pr5** onward. `LULU_API_BASE=https://api.sandbox.lulu.com`.
- **Production** creds: already verified live (`lulu-verify.sh prod`, 2026-07-16). **This session swaps them onto
  the VPS** — `LULU_API_BASE=https://api.lulu.com` + prod `LULU_CLIENT_ID`/`LULU_CLIENT_SECRET`. Sandbox and
  prod are **separate universes** (separate registration, separate keys), same as Stripe test vs live.

## Steps
0. **First-deploy infra check — print has never been on prod.** Deploy the branch to the VPS and confirm the
   **headless-Chrome renderer actually runs in the prod Docker image** (the pr1 mechanism — Puppeteer sidecar
   or Playwright-Java + Chromium layer — must be baked into `docker-compose.prod.yml`/`Dockerfile`). Render one
   real book → PDF on the server and inspect it. **This is the biggest prod-specific risk** (fonts, Chromium
   deps, memory), not the Lulu call.
1. **Swap Lulu env to prod on the VPS:** `LULU_API_BASE=https://api.lulu.com`, prod `LULU_CLIENT_ID` /
   `LULU_CLIENT_SECRET`, confirm `LULU_POD_PACKAGE_ID` unchanged. Redeploy. Run `lulu-verify.sh` on the server.
2. **Confirm the Lulu company card is on file** for prod auto-charge (owner task — `../handoffs/`). A **paid**
   prod print job auto-charges this card; without it, submission fails.
3. **Print's variable-amount Stripe checkout in live mode** — reuses P12's live keys/webhook (pr7 builds the
   amount dynamically, so confirm whether it needs any live Price object or is pure `price_data`). No new
   fixed SKU if it's dynamic.
4. **(If in scope) register Lulu's prod order-status/shipped webhook** (pr9's optional half) against the prod URL.
5. **⛔ ToS go-live gate (from pr0 review of Lulu's terms):**
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
   - **⛔ s14a landed** — the print-job-rejection **refund path** (`../sv2-s14-print-hardening.md` → s14a) is the
     minimum failure-handling bar before real money moves; a Lulu rejection after a real charge must not strand
     a paying customer.
6. **Real end-to-end smoke test:** order one real book to a real address (owner's), smallest that clears the
   32-page min, confirm Lulu prints + ships. Decide what to do with the test copy.
7. **Leave the kill switch OFF at deploy; flip it ON deliberately.** The `app.print.enabled` flag (defined
   pr5, default `false`) means print ships **dormant** — the code is live but no order can be placed or
   submitted. Do the smoke test with `PRINT_ENABLED=true`, then **decide whether to leave it on**: if Michael
   is heading into the post-launch vacation, **turn it back OFF** and flip it on only when back and watching.
   Flip = edit `PRINT_ENABLED` in the VPS `.env`, `docker compose -f docker-compose.prod.yml up -d api`
   (~10s restart, no rebuild). Off is a "no new orders" guarantee, not a recall of in-flight jobs (s14a).

## Done when
- [ ] Print code deployed to prod; headless-Chrome renderer produces a valid PDF **on the VPS**.
- [ ] Lulu prod env vars live on the VPS; `lulu-verify.sh` green against `api.lulu.com` there.
- [ ] Company card on file confirmed; a real paid print job submitted and accepted by Lulu.
- [ ] Privacy/ToS disclosure of third-party printing is live; physical-order refund policy written down.
- [ ] One real-address smoke order printed and shipped.
- [ ] `PRINT_ENABLED` set deliberately after the smoke test (OFF if heading into vacation; flip on when watching).

## Not this session
Refunds / cancellation / print-job-rejection recovery → **`../sv2-s14`** (hardening). This is the happy-path
go-live only.
