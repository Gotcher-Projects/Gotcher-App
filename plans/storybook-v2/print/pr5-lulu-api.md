# Print pr5 — Lulu API: OAuth + upload + print job

**Status:** Client VERIFIED end-to-end (2026-07-19, tunnel e2e with Michael) — pending his "Complete" call.
The Lulu client is proven; a **separate render-pipeline blocker** was discovered (see below), tracked in
`pr5.5-pdf-acceptance.md`.

**pr5 e2e result (2026-07-19):** cloudflared tunnel → `POST /books/5/print/lulu-test`. Proven live against
sandbox: OAuth ✓ · render interior+cover ✓ · **Lulu fetched both PDFs from the tunnel** ✓ (30-page submit
→ REJECTED with *"We found 30 pages"* = Lulu downloaded + parsed our PDF) · **cover cross-check ran live and
MATCHED** (32pp: Lulu 17.382 vs computed 17.3821) ✓ · async status + handled REJECTED (no crash) ✓ · kill
switch ✓. **⚠ NEW BLOCKER:** a padded 32-page submit (job 314960) cleared the page count but Lulu REJECTED the
interior on normalization — **unflattened transparency** (157 `/Transparency` + 51 `/SMask` from Chrome's Skia;
Lulu requires flattened). Sizes/fonts/color ruled out. Fix = a flatten pass (Ghostscript in the sidecar) —
own session, blocks pr10. Details: `pr5.5-pdf-acceptance.md`.

**What was built (2026-07-18):**
- `LuluClient` — OAuth (client-credentials, token cached to its lifetime), `coverDimensions`, `createPrintJob`,
  `getPrintJob`. Endpoints/shapes probed live against sandbox: `POST /cover-dimensions/` (unit=`inch`),
  `POST /print-jobs/` (line item carries `interior`/`cover` `{source_url}` directly + qty + SKU; top-level has
  `contact_email`, `external_id`, `shipping_level:GROUND`, `shipping_address`). POST is async → returns
  `{id,status:CREATED}`; bad `source_url`s surface as a later status, not a POST error (getPrintJob polls it).
- **Kill switch** `app.print.enabled` (default OFF) lives in `LuluClient.createPrintJob` — the deepest backstop:
  refuses (`PrintDisabledException` → 409) before any byte reaches Lulu. Read-only calls are not gated.
- **Cover cross-check** (pr4 follow-up) in `LuluPrintService.crossCheckCover` — mirrors PrintCoverPage.jsx
  constants; **CONFIRMED against sandbox**: 100 pages → Lulu `17.535×11.250"` == computed `17.5352×11.25"`
  (PAPER_PPI=444 / SPINE_PAD=0.06 / bleed / trim all correct, within 0.02" tolerance).
- **Throwaway dev triggers** `POST/GET /books/{bookId}/print/lulu-test[/{jobId}]` (owner-guarded; pr7 deletes).
- **⚠ SHIPPING: pr0.5's "GROUND" is INVALID for this SKU→US.** shipping-options / cost-calc for
  `0850X1100FCPREPB080CW444GXX`→US offer only `MAIL`/`PRIORITY_MAIL`/`GROUND_HD`/`EXPEDITED`/`EXPRESS` — a plain
  `GROUND` job is **REJECTED** (verified; sandbox job 314931). Harness now defaults to **`MAIL`** (cheapest valid,
  $5.69). **The real customer-facing level (MAIL vs GROUND_HD, cost vs speed) is a pr6/pr7 decision — needs
  Michael's call.** Sample cost: a 100-page book qty 1 + MAIL to US ≈ **$32.39 incl. tax** (print $23.64 + ship $5.69).
- **Verify script** `Backend/lulu-pr5-verify.sh` (companion to `lulu-verify.sh`): default mode = OAuth +
  cover cross-check (32/100/400pp, all MATCH) + cost-calc preview, creates NO job; `submit <interior_url>
  <cover_url> [pages]` mode does the full paid-job create + status poll for the tunnel e2e.
- Config: `lulu.*` + `app.print.enabled` bound in `application.properties`; `.env.example` + `.env`
  (PRINT_ENABLED=true local) + `docker-compose.prod.yml` blank passthrough added.
- Unit tests: `LuluClientTest` (kill switch) + `LuluPrintServiceTest` (cross-check match/mismatch) — green.

**Original plan below.**

---

**Status (original):** Not started
**Est:** ~2 hours · **Depends on:** pr3, pr4, **pr0** (credentials) · **Blocks:** pr6, pr7
**Launch prompt:** `session-prompts.md` → pr5
**Read first:** `lulu-spec-handoff.md` (auth, print job) + Lulu API docs (api.lulu.com/docs)

The Lulu client: authenticate, upload the interior + cover, and submit a **paid** print job — all against
the **sandbox** first.

---

## What you're building

`com.gotcherapp.api.print` (or similar): a Lulu client + service.
1. **OAuth** — client-credentials grant against `LULU_API_BASE` with `LULU_CLIENT_ID`/`SECRET`; cache the
   token to its lifetime.
2. **Provide the files** — Lulu fetches interior + cover from a **public `source_url`** (it does *not* take a
   binary upload in the create-job call). Per pr0.5, pr3/pr4 render **pre-checkout** and persist each PDF behind
   a **signed backend endpoint at an unguessable token path** (no auth, short TTL — baby photos); pr5 passes
   those URLs as the `source_url`s. Don't re-render here — the files already exist by the time we submit.
3. **Create the print job** — POST with `pod_package_id` (`LULU_POD_PACKAGE_ID`), page count, quantity, and
   shipping address; this is a **paid** job (external checkout — Lulu auto-charges the company card on file).
   The customer already paid us via Stripe (pr7) before we submit. Set an `external_id` (a generated id in
   pr5) — the seam pr7 ties to `print_orders.id` for double-submit dedup (submitting twice = two physical books).
4. **Cover-dimension cross-check** (folded in from the pr4 follow-up) — with the authenticated client in hand,
   call Lulu's **cover-dimensions API** for the real SKU + page count and confirm our computed spine matches.
   pr4 flagged `PAPER_PPI` / `SPINE_PAD_IN` / `SPINE_TEXT_MIN_PAGES` in `PrintCoverPage.jsx` as needing this
   check. A wrong spine = a Lulu reject, so de-risk it here. If Lulu's number diverges, reconcile the constants
   (or note the gap) — don't silently ship a mismatched cover.

## Scope boundary — pr5 stops at the client (pr7 owns the order)
pr5 has **no real order**: no customer, no address form, no `print_orders` table, no Stripe, no webhook — those
are **pr7**. To exercise the submit against sandbox, add a **throwaway owner-guarded dev endpoint**
`POST /books/{bookId}/print/lulu-test` that renders interior+cover, then submits a job with a **canned US
sandbox address** + qty 1 (US-only / GROUND per pr0.5). This mirrors how pr2's `PrintDevController` became
pr3's real endpoint — **pr7 deletes this trigger** and moves the call into the webhook. Do NOT build the order
table / address capture / checkout here.

## Kill switch — `app.print.enabled` (define it here, default OFF)
The whole Lulu/print feature ships **live but dormant** behind a single env flag so it can be turned off fast
without a redeploy (Michael is on vacation right after launch; the fear is a bug submitting Lulu jobs we
weren't paid for). **pr5 owns the deepest, authoritative backstop:** the point in the Lulu client where a
**paid print job** is submitted **hard-refuses when the flag is off** — throw/return a handled error, never
POST to Lulu. This is the last line of defense; pr7 (checkout) and pr8 (UI) add earlier gates, but even a
request that somehow reaches the client must not reach Lulu when off.
- Add `app.print.enabled=${PRINT_ENABLED:false}` to `application.properties` (env-driven, safe default like
  `app.free-grant.limit`; the mail "silently disabled when blank" idiom is the model).
- **Default `false`** → prod ships with it off; flip `PRINT_ENABLED=true` only after return + verification (pr10).
- **Dev:** set `PRINT_ENABLED=true` in your local `.env` / `start-services.sh` so you can actually test pr5–pr9.
- Scope: a **pure kill switch** — off means *refuse new submissions*. It does **not** cancel in-flight Lulu
  jobs (that's `../sv2-s14-print-hardening.md` → s14a). Flip-to-off is a "no new orders" guarantee, not a recall.

## ⚠️ Notes
- **Sandbox first.** `LULU_API_BASE` points at sandbox; a separate prod base + creds swap in later (like
  Stripe test→live). Never commit secrets.
- **Order of operations:** the Stripe payment (pr7) must succeed **before** we POST the paid Lulu job — same
  "fulfil on confirmed payment" discipline as the credit webhook.
- **Print-job rejection** (below min page count, bad PDF) is a real failure path — surface it; full handling
  is a hardening concern (see `../sv2-s14-print-hardening.md` → **s14a**, which is the min-bar for pr10).
- **Async fetch — a bad `source_url` is NOT a POST error.** Lulu accepts the POST and returns a job with a
  `status` (CREATED → …), then fetches the `source_url`s **asynchronously**; an unreachable/bad PDF surfaces as
  a **later error status**, not a failed POST. So `createPrintJob` returns the job id + status, and any error
  status is treated as a handled failure, not a crash. Verify the exact status flow against the sandbox during
  the build. (This is also why the localhost-reachability fix below matters — the POST would "succeed" either way.)

## How we test — tunnel (Lulu must reach our PDFs)
Lulu fetches `source_url` **server-side**, but in dev the fetch URL is built from `app.backend-url` =
`http://localhost:3001` (see `PrintRenderService` — `pdfUrl = backendBase + "/print/pdf/" + token`), which
Lulu's sandbox servers **cannot reach**. So OAuth + the POST work locally, but Lulu can't pull the files.
- Run a temporary public tunnel (ngrok / cloudflared) to `localhost:3001`, set **`BACKEND_URL=<tunnel-url>`**
  for the test run so the persisted `pdfUrl`s are publicly fetchable, then hit the `lulu-test` endpoint.
- The tunnel URL is throwaway (dies with the session); no VPS, no prod. Prod uses the real public
  `app.backend-url` (`https://cradlehq.app/api`), so the localhost problem is dev-only — it disappears at pr10.

## Config
```
LULU_API_BASE=...   LULU_CLIENT_ID=...   LULU_CLIENT_SECRET=...   LULU_POD_PACKAGE_ID=...   PRINT_ENABLED=false
```
The `LULU_*` vars currently live **only in `.env`** (read by `lulu-verify.sh`) — they are **not yet bound in
Spring**. pr5 adds a `lulu.*` `@Value` block to `application.properties` (`lulu.api-base` / `client-id` /
`client-secret` / `pod-package-id`). Mirror into `.env.example` and add **blank passthrough lines** to
`docker-compose.prod.yml` now (real prod values swap in at pr10) — same pattern as Stripe in Payments P1.

## Done when
- [ ] OAuth token obtained + cached against the sandbox.
- [ ] A print job is created in the sandbox from a real interior + cover **via the tunnel** — Lulu actually
      fetches both PDFs (job reaches a non-error status), with quantity + address.
- [ ] Cover-dimension cross-check run for the real SKU + page count; our spine matches Lulu's calc (or the gap
      is reconciled/noted).
- [ ] Rejections / async error statuses surface as a handled error, not a crash.
- [ ] `app.print.enabled=false` **hard-refuses** the paid-print-job submission (nothing reaches Lulu); `true` allows it.
- [ ] The `lulu-test` trigger is clearly marked throwaway (pr7 deletes it); no `print_orders`/checkout built here.

## Not this session
The cost/shipping *estimate* (pr6) · the Stripe checkout that precedes the paid job (pr7) · the order table /
address form / webhook (pr7) · the UI (pr8). Prod credentials/cutover come later (Payments P12-style discipline).
