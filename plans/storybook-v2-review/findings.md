# Findings log — storybook-v2 branch review

**Every pass appends here.** This file is the durable record between sessions; a finding that exists only in a
chat transcript is a lost finding. r6 builds `branch-review-storybook-v2.html` from what's below.

**Format** — one row per finding, grouped under its pass:

```
### F<n> — <one-line claim>
- **Label:** ⛔ SHIP-BLOCKER | 📋 DEFERRED
- **Where:** `path/to/File.java:123`
- **What:** what is actually wrong
- **Why it matters:** the consequence, concretely — who gets hurt and how
- **Fix:** the suggested change
```

Number findings **F1, F2, F3…** continuously across all passes (don't restart per pass) so r6 can reference
them unambiguously.

---

## Pass r1 — Dead code
_Run 2026-07-22. **⛔ check PASSED** — see "r1 clean bill" at the end of this section._

### F1 — `lib/letterTypes.js` is a whole dead module (no importer anywhere)
- **Label:** 📋 DEFERRED
- **Where:** `Frontend/src/lib/letterTypes.js` (33 lines, both exports)
- **What:** Neither `LETTER_TYPES` nor `getLetterType` is imported by any file. Its header names three
  consumers (Guided Book seeding a title from `letterTypeId`, Scrapbook pre-seeding, AI assist
  `promptTemplate`); none exist — `letterTypeId` appears nowhere in the codebase. `LetterCanvas` renders a
  generic letter page with no type concept.
- **Why it matters:** Low. It's a config file describing an extensibility point that was never wired, so it
  reads as live design when it is aspirational. The `promptTemplate` also implies an AI path that doesn't exist.
- **Fix:** Delete the file, or keep it and strip the "Consumers" comment down to "not yet wired".
- **Minor, same bucket:** `guidedBook.js:19 pageHasBlockContent` is `export`ed but only used inside its own
  module — narrow to a local.

### F2 — `lib/storybookPdf.js` (307 lines) is dead: the client-side PDF export was replaced by print
- **Label:** 📋 DEFERRED
- **Where:** `Frontend/src/lib/storybookPdf.js`; stale comment at `Frontend/src/components/tabs/StorybookTab.jsx:362`
- **What:** Both exports are unreachable from the app. `generateStorybookPdf` has zero references;
  `downloadPdf` is imported **only by its own test** (`test/storybookPdf.test.js`). No dynamic `import()`
  anywhere in `Frontend/src` reaches it. The module still pulls in `html2canvas`, `jsPDF` and eleven canvas
  components. It was superseded by the print track's headless-Chrome sidecar route
  (`PrintBookPage`/`PrintCoverPage` → `PrintRenderService`). Confirming residue: StorybookTab still says
  `{/* Book theme picker + PDF download */}` over a block that now contains **only** the theme picker.
- **Why it matters:** Low for shipping, real for maintenance — 307 lines of capture code that looks like the
  live PDF path. A future change to a canvas will be "kept working" in a file nothing runs. The surviving test
  also buys nothing but keeps the module looking alive.
- **Fix:** Delete the module + its test and fix the StorybookTab comment. **Decide first:** is a user-facing
  "download my book as a PDF" affordance intended to come back? If yes, keep and log it as unwired; if no,
  delete. (Adjacent, out of scope: `lib/pdf.js` `generatePdf`/`downloadPdf` — the journal export — has the same
  no-consumer shape. Worth a look, but it's unchanged since `6ab07b0` so it isn't this review's scope.)

### F3 — The multi-photo "first times" feature has no writer: `first_time_photos` can never be populated
- **Label:** 📋 DEFERRED
- **Where:** `Backend/.../firsttimes/FirstTimeController.java:70,85,98,109` · `FirstTimeService.java:125–190`
  · `dto/AddFirstTimePhotoRequest.java` · `dto/UpdateFirstTimePhotoRequest.java` · `dto/ReorderPhotosRequest.java`
  · `FirstTimePhoto.java` · migration `V38__create_first_time_photos.sql`
- **What:** Four endpoints (`POST /{id}/photos`, `PATCH /{id}/photos/{photoId}`, `DELETE /{id}/photos/{photoId}`,
  `PATCH /{id}/photos/order`) plus ~110 lines of service code and a table. The frontend calls **only**
  `/first-times`, `/first-times/{id}` (GET/POST/PATCH/DELETE) — `grep` for `/photos` in `Frontend/src` returns
  nothing. This is the backend half of **s9.0a, which was Dropped**. The read path *is* wired (every
  `/first-times` load runs an extra JOIN to hydrate `photos`), so the cost is paid on each request.
- **Why it matters:** The table stays empty in production forever, so `GalleryCanvas`'s "up to 4 photos,
  adaptive grid" can only ever show the hero photo — a storybook page type that silently can't fill. Plus a
  wasted query per first-times load and four maintained, tested endpoints no client can reach.
- **Fix:** Decide the feature's fate rather than the code's. Either finish s9.0a's UX (small — the API is done
  and tested), or remove the four endpoints + service block and leave the table for later. Don't leave it as-is
  with the JOIN in the hot path.

### F4 — `LuluClient.getPrintJob(long)` has no caller — both status feeds use the raw variant
- **Label:** 📋 DEFERRED
- **Where:** `Backend/.../print/LuluClient.java:107`
- **What:** Both consumers deliberately go through `getPrintJobRaw` + `LuluJobStatusMapper.parse` instead
  (`PrintOrderStatusService.java:175` and `LuluWebhookService`), so the typed `getPrintJob` wrapper is unused
  in main. Three class-level Javadoc references still direct readers to it as *the* polling entry point
  (`LuluClient.java:29,33,96`).
- **Why it matters:** Low, but it's a live decoy on the one code path where "two ways to interpret a Lulu job"
  is the exact failure mode `LuluJobStatusMapper` exists to prevent — a future caller could reasonably pick the
  wrapper and bypass the single interpretation point.
- **Fix:** Delete `getPrintJob` (keep `parseJob`/`PrintJob` — `createPrintJob` returns it) and repoint the
  Javadoc at `getPrintJobRaw` + the mapper.

### r1 clean bill — things checked and found genuinely clean
- **⛔ permitAll route audit — PASSES.** Every route under a permitted namespace is accounted for and
  self-authorizes: `/health` = Actuator only (`exposure.include=health`, `show-details=never`);
  `/auth/*` = the seven anonymous flows (`/auth/me` and `/auth/resend-verification` are correctly *not*
  listed, so they need a JWT); `/admin/**` = one route, gated on `X-Admin-Secret` with a blank-secret guard;
  `/book/public/{token}` and `/print/payload|pdf/{token}` = token-authorized; `/print/lulu-webhook` and
  `/billing/webhook` = signature-verified. **No forgotten dev/throwaway route survived.** Note
  `PrintController` is `/books/{bookId}/print/**` and `PrintOrdersController` is `/print-orders` — neither is
  matched by the `/print/**` pattern, so both are authenticated. `PrintDevController` is gone.
- **AI page-gen relics are genuinely gone.** `GenerateGroupsRequest`, `GeneratedPageContent` and
  `GeneratedPageResponse` are deleted in this diff; `grep CLAUDE-DEBUG Backend/` returns nothing;
  `ClaudeClient` is down to `isConfigured` + `generateText` and explicitly does **not** log prompts/responses.
- **Reversal residue:** `StorybookWizard.jsx` and `lib/storybookPeriods.js` were properly deleted (V43 retired
  period chapters). Component orphan sweep across `Frontend/src/components` found only `HomeFleet.jsx` — the
  known inactive app, out of scope.
- **`PrintOrderConfirm` vs `UpgradeConfirm`:** no copy-paste leftovers; correctly a sibling, not a fork.
- **Scheduled jobs are live:** `@EnableScheduling` is present on `GotcherAppApplication`, so
  `PrintPdfStore.sweepExpired` (hourly TTL) and `PrintOrderStatusService.reconcile` (the paid-order safety net)
  both actually run. Worth stating because they read as uncalled to a static sweep.

## Pass r2 — Duplication
_Run 2026-07-22. **No divergence found** — every duplicate pair checked was byte-identical in behaviour, so
nothing here is a ⛔. See "r2 clean bill"._

### F5 — The book-ownership IDOR check exists in 4 copies, with 3 identically-named exception classes
- **Label:** 📋 DEFERRED
- **Where:** `book/BookShareService.java:80` · `print/PrintRenderService.java:87` ·
  `print/PrintInteriorService.java:91` · `billing/BillingService.java:114 (userOwnsBook)`.
  Exception classes: `BillingService.BookNotAccessibleException:144` ·
  `BookShareService.BookNotAccessibleException:108` · `PrintRenderService.BookNotAccessibleException:98`
- **What:** All four run the **identical** SQL — `SELECT COUNT(*) FROM books b JOIN baby_profiles bp ON
  b.baby_profile_id = bp.id WHERE b.id = ? AND bp.user_id = ?`, same param order (`bookId, userId`). Three
  throw, one (`userOwnsBook`) returns a boolean. `PrintInteriorService` already reuses
  `PrintRenderService.BookNotAccessibleException` rather than adding a fourth. **I verified the copies have not
  diverged** — this is repetition, not a behaviour split.
- **Why it matters:** Not today — today they agree. It matters because this is *the* IDOR boundary for the
  whole book surface (`books` has no `user_id`; ownership is only reachable through `baby_profiles`). Four
  copies means a future change to what "owned" means — a shared/collaborator book, a soft-delete flag, an
  archived profile — has four sites to find, and missing one opens a hole on exactly the path that leaked in
  June. Three same-named `BookNotAccessibleException` classes in three packages compound it: an import fixed
  by the IDE can silently catch the wrong type.
- **Fix:** One `BookOwnership` helper (or a method on a shared base) exposing `require(userId, bookId)` and
  `isOwned(userId, bookId)`, with a single `BookNotAccessibleException`. Mechanical and low-risk — but it
  touches money paths, so it belongs *after* the deploy, not before it.

### F6 — Time-of-day formatting is inlined in 5 places; `lib/formatting.js` has no `formatTime`
- **Label:** 📋 DEFERRED
- **Where:** in scope: `components/tabs/DashboardTab.jsx:606`. Out of scope but identical:
  `AppointmentTab.jsx:11` · `DiaperTab.jsx:51` · `SleepTab.jsx:48` · `FeedingTab.jsx:339`
- **What:** Five copies of `new Date(...).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })`,
  three of them named `fmtTime` locally. `lib/formatting.js` centralises `formatDate`, `formatMonthYear` and
  `formatCents` but has no time equivalent, so there was nothing to import. DashboardTab:606 re-inlines the
  appointment-time format that `AppointmentTab` already has as `fmtTime` — the same value formatted twice in
  two files. Note two variants exist: appointment times parse `` `1970-01-01T${t}` `` (a time-only column),
  the log tabs parse an ISO instant.
- **Why it matters:** Low — and explicitly **not** a violation of the project date rule, which covers display
  *dates* (the noon-anchoring that prevents timezone off-by-one). `toLocaleTimeString` on a full instant has
  no such trap. It's ordinary drift: five places to change if the app ever wants 24-hour time or a locale.
- **Fix:** Add `formatTime(iso)` and `formatTimeOfDay(hhmm)` to `lib/formatting.js` and collapse the five.
  Cheap, but touches four out-of-scope files — bundle it with other cleanup rather than doing it alone.

### r2 clean bill — duplication checks that came back clean
- **⚠ The hard date rule holds.** `grep` for `toLocaleDateString` across `Frontend/src` matches **only**
  `lib/formatting.js:29,41`. No display date was inlined anywhere on this branch. (The `toLocaleString` hits in
  `HomeFleet.jsx` are the inactive app and are number/currency, not dates.)
- **Money formatting is fully consolidated.** All three consumers import the shared `formatCents` —
  `PrintOrderConfirm.jsx:5`, `PrintOrderModal.jsx:5`, `PrintOrdersSection.jsx:4`. pr9's local copy is gone and
  no hand-rolled `cents / 100` survives, so the price shown before checkout and the amount shown after it are
  produced by one function.
- **Order status is single-sourced.** Nothing re-derives order status outside `LuluJobStatusMapper`.
  `PrintOrderStatusService` only *applies* the mapper's verdict, and its UPDATEs are guarded
  (`WHERE ... status NOT IN ('failed','shipped')` for failures, `status IN ('paid','submitted')` for shipping)
  so a replayed or late event can't un-ship or double-apply. Both feeds — webhook and sweep — enter through it.
- **`print_orders` projections:** `ORDER_SELECT` is the one **customer-facing** projection and serves both the
  confirmation and the list, as s14c intended. The other five selects (`PrintOrderFulfilmentService:80,103`,
  `PrintOperatorAlert:71`, `PrintCustomerEmail:94`, `PrintRefundService:162`) are internal, single-purpose,
  and deliberately select *different* columns (operator/ops data that must never reach a customer payload).
  Not duplication — leave them.
- **Shared frontend utils are reused, not re-implemented** (`PhotoPickerButton`, `uploadCroppedPhoto`,
  `cleanBodyText`, `useCanvasScale`, `captureElement`, `TwemojiImage` — 19 files import them).
- **The two webhook controllers mirror each other correctly** — raw `String` body, signature checked first,
  400 *only* for a bad signature, explicit 500 (never a rethrow, per the Spring 401 trap) otherwise. The one
  asymmetry is deliberate: Stripe's signature header is `@RequestHeader(required=true)` (Spring rejects a
  missing header), Lulu's is `required=false` so the service raises its own `SignatureException`. Both paths
  end in 400. **Do not "fix" this parallel.**

## Pass r3 — Test coverage
_Run 2026-07-22. **Baseline re-verified green: 423 backend / 0 failures, 344 frontend / 29 files, 0 failures** —
exactly the numbers the plan predicted. **Every Tier 1 money path is genuinely asserted** (details in the clean
bill). The gaps below are all 📋: each is code that is **correct today** but has nothing guarding a regression._

### F7 — There is no HTTP/authorization-layer test anywhere; `SecurityConfig` has zero coverage
- **Label:** 📋 DEFERRED — *but the highest-value item in this pass*
- **Where:** `Backend/src/test/**` (absence). `SecurityConfig.java:41–55` is untested.
- **What:** `grep` for `MockMvc`, `@SpringBootTest` and `@WebMvcTest` across the whole backend test tree returns
  **nothing** — the only hit for "permitAll" is a *comment* in `LuluWebhookServiceTest`. Every one of the 423
  tests is a pure Mockito unit test that calls controller/service methods directly, so the security filter
  chain is never exercised. `BillingWebhookControllerTest`'s 200/400/500 cases invoke the controller method,
  not the HTTP stack.
- **Why it matters:** **Nothing would fail if a new route landed under `/print/**` unauthenticated.** That trap
  was hit twice on this branch already (pr9, s14c) and was caught both times by a human noticing. The permitAll
  list is now six namespaces guarding a public book payload, a PDF store and two money webhooks; it is the
  single highest-consequence config in the repo and the only thing enforcing it is review discipline.
- **Fix:** One `@SpringBootTest` + `MockMvc` class asserting the *shape*, not the routes: every request mapping
  discovered from `RequestMappingHandlerMapping` either matches the permitAll list or returns 401 without a
  JWT. That version fails automatically when someone adds a route to a permitted namespace, which is the actual
  goal — a hand-written list of six paths would just be a second copy to forget. **Strong candidate for the
  first post-deploy slice.**

### F8 — The print render token and PDF store — the auth for two *unauthenticated* endpoints — have no tests
- **Label:** 📋 DEFERRED
- **Where:** `security/JwtUtil.java:57 generatePrintRenderToken`, `:72 getPrintRenderBookId` ·
  `print/PrintPdfStore.java` (whole class) — no `JwtUtilTest`, no `PrintPdfStoreTest`
- **What:** These two are the *entire* authorization for `GET /print/payload/{token}` (returns the full book
  payload — baby name, family names, photo URLs) and `GET /print/pdf/{token}` (returns the printable PDF
  bytes), both `permitAll`. `AuthServiceTest` **mocks** `JwtUtil`, so its real logic is never executed by any
  test. **I read both and they are correct:** `getPrintRenderBookId` verifies signature + expiry via
  `parseToken` *and* requires `purpose = print-render`, so an ordinary access token can't be swapped in; the
  store's tokens are 32 bytes of `SecureRandom`, and `fetch` filters on `expires_at > NOW()`.
- **Why it matters:** Correct today, unguarded tomorrow. The negative cases are what protect the data — a
  wrong-purpose token, an expired token, an expired PDF row — and **none of them has ever been executed**,
  by a test or by the s14 live run (which only ever exercised the happy path). If the purpose check were
  dropped in a refactor, every test would still pass and any logged-in user's access token would read any
  book's payload by id.
- **Fix:** A small `JwtUtilTest` (valid → bookId; access token → rejected; expired → rejected; tampered →
  rejected) and a `PrintPdfStoreTest` (fetch of an expired row returns empty). ~15 fast unit tests, no DB
  needed for the JWT half.

### F9 — Three of the four Stripe webhook branches are never routed in a test
- **Label:** 📋 DEFERRED
- **Where:** `Backend/src/test/.../billing/BillingWebhookServiceTest.java` — covers `checkout.session.completed`
  (×2), print routing, unhandled-type, bad-signature. No test for `charge.refunded`, `refund.created` or
  `refund.failed`.
- **What:** `BillingWebhookService.java:73–83` routes four event types, each casting the deserialized object
  (`(Charge) obj` for one, `(Refund) obj` for two) and calling a different `PrintRefundService` method.
  `PrintRefundService` itself is **excellently** covered (13 tests, including the `COALESCE` id-preservation
  case and the `refundFailed` undo), but the *wiring* from event type → method → cast is only proven for the
  checkout branch.
- **Why it matters:** Moderate, and bounded: `charge.refunded` and `refund.created` **were exercised live** in
  the s14a-2 verification run on 2026-07-21, so they are known to work end-to-end — that is why this is 📋 and
  not ⛔. `refund.failed` has been exercised by neither a routing test nor live (a genuinely failed refund is
  hard to trigger), and it is the branch that pages a human when a customer we already promised a refund
  didn't get the money. A bad cast there throws → 500 → Stripe retries → after enough failures the alert
  simply never arrives.
- **Fix:** Three routing tests in the existing file, mirroring `printOrder_routesToPrintFulfilment_notGrant` —
  build the event, assert the right `PrintRefundService` method is called with the right type.

### r3 clean bill — Tier 1 verified, not assumed
- **The atomic `pending→paid` claim is properly guarded.** `PrintOrderFulfilmentServiceTest` asserts the
  redelivery case by name — `redelivery_claimAffectsZero_noSubmit` — plus kill-switch parking, Lulu-error
  parking with operator alert, resume-with-stored-address, resume-with-expired-PDFs, and ineligible-resume
  no-op (12 tests). **This is the guard against shipping two physical books, and it is real.**
- **`GrantService` idempotency is asserted:** `replay_returnsFalse_grantsNothing`, plus credit-pack /
  share-only / bundle each verifying exactly what is and isn't granted.
- **`PrintRefundService`:** `chargeRefunded_cannotWipeAnIdAlreadyStoredByRefundCreated` (the `COALESCE(?,
  refund_id)` case the plan flagged), `failedRefund_undoesTheRecording_andAlertsTheOperator`,
  `redeliveredRefundEvent_doesNotEmailAgain`, and digital-purchase filtering on all three paths.
- **`LuluJobStatusMapper`** (7) and **`PrintOrderStatusService.reconcile`** (12, including
  `sweep_survivesAFailedLuluRead` and the resume cap) are covered.
- **Frontend formatters are tested** — `formatting.test.js` exercises `formatDate`/`formatCents`, so the
  noon-anchoring rule has a guard.
- **Migrations:** still untested, by design. **The mitigation is DEPLOY-0's rehearsal on a restored prod dump,
  not a unit test** — V42/V43/V45/V48 are destructive and no test framework would prove them safe against real
  data. Flagged here only so r6 doesn't record it as an oversight.
- **Classes with no test file** (informational, mostly thin controllers correctly covered via their services):
  `BillingService`, `PrintRenderService`, `PrintSidecarClient`, `PrintOperatorAlert`, `ClaudeClient`,
  `KeyedRecordService`, and the controllers. `PrintSidecarClient` and `PrintOperatorAlert` are the two worth a
  second look later — both are external-I/O boundaries.

## Pass r4 — Documentation
_Run 2026-07-22. **No ⛔** — the runbook risk was checked specifically and de-escalated (see F12): every new
setting has a safe blank default, so a stale doc cannot break the boot, and `DEPLOY-0` already carries the
steps the old guide lacks._

### F10 — `CLAUDE.md`'s start command has the wrong path (confirmed), and the stop caveat is missing
- **Label:** 📋 DEFERRED — but it is a **2-minute fix that has already cost real time twice**
- **Where:** `CLAUDE.md:18–19`
- **What:** Says `cd Backend && ./start-services.sh`. **Confirmed by listing the tree:** `start-services.sh`
  and `stop-services.sh` are both at the **repo root**; `Backend/` contains only `lulu-pr5-verify.sh`,
  `lulu-verify.sh`, `lulu-webhooks.sh`, `run-migrations.sh`, `stripe-listen.sh`. So the documented command
  fails outright. The stop line is right about the location but omits the known caveat: it does **not**
  reliably kill the API, leaving a stale `java` holding port 3001.
- **Why it matters:** It's the first instruction a cold session follows, and it's wrong. That's how it burns
  time repeatedly — the reader assumes the doc and debugs the environment.
- **Fix:** `./start-services.sh` from the repo root; add the fallback for a stuck API
  (`netstat -ano | findstr :3001` → `taskkill /PID <pid> /F`, or the `lsof -ti:3001 | xargs kill` equivalent).

### F11 — No payments/print primer exists, and `CLAUDE.md` doesn't mention either track
- **Label:** 📋 DEFERRED
- **Where:** `CLAUDE.md` "Stack" (:6–14) and "Pointers" (:60–64); `plans/` has only
  `storybook/storybook-context.md` and `pregnancy/pregnancy-context.md`
- **What:** Two of the biggest subsystems on this branch have no entry-point doc. `CLAUDE.md`'s stack section
  lists frontend/backend/database and **never mentions Stripe, Lulu, or the headless-Chrome PDF sidecar** —
  which is a *fourth runtime process* (port 4000) that the print feature cannot work without. The Pointers
  section names the storybook, pregnancy and review-fixes tracks but neither payments nor print. Meanwhile the
  print track alone is 11 plan files plus s14, and payments is P1–P12.
- **Why it matters:** This is the doc a cold session reads first, and the review plans themselves assume
  "every pass session starts cold". Someone landing on a print bug has to reverse-engineer the runtime
  (backend → sidecar → Chrome → `/print/book/{token}` route → PDF store → Lulu fetch) from eleven plan files.
  It also means the sidecar can be forgotten when starting the app locally.
- **Fix:** One `plans/storybook-v2/print/print-context.md` (or a combined `payments-print-context.md`) in the
  shape of `storybook-context.md`: the runtime path end to end, the kill switch, the token types, where money
  is decided. Add the sidecar to `CLAUDE.md`'s stack list and both tracks to Pointers. **Best written now,
  while it's all in working memory — the value is highest for the session that comes after this one.**

### F12 — `deployment-guide.html` predates payments, print and the sidecar, and documents none of the new env vars
- **Label:** 📋 DEFERRED — *considered for ⛔ and deliberately not; reasoning below*
- **Where:** `deployment-guide.html` (repo root, last modified **2026-07-02**), referenced as **the** runbook
  by `sv2-deploy-0-first-prod-deploy.md:99`
- **What:** The guide has a backup/restore section and a migration-verification step, but a grep for
  `STRIPE|LULU|ANTHROPIC|SIDECAR` across the whole file returns **zero matches**, and it has no notion of the
  `pdf-sidecar` service. `docker-compose.prod.yml` currently defines only `caddy`, `api`, `postgres` — the
  sidecar genuinely isn't there yet.
- **Why it is NOT a ⛔:** two independent reasons, both verified. (1) **Every** new setting in
  `application.properties` has a safe default — `STRIPE_SECRET_KEY:`, `LULU_CLIENT_ID:`, `ANTHROPIC_API_KEY:`
  are blank, `PRINT_ENABLED:false`, `PRINT_SIDECAR_URL` falls back to localhost. The app **boots dormant**
  without any of them, which is exactly DEPLOY-0's intent, so following the stale guide cannot produce a failed
  boot or a half-configured money path. (2) `DEPLOY-0` (updated today) already contains what the guide lacks:
  step 0's `pg_dump` + **proven-restorable** dump + full V23→V53 rehearsal on a restored copy, and step 6's
  sidecar wiring with `PRINT_SIDECAR_URL`/`PRINT_FRONTEND_BASE`. The operator following DEPLOY-0 gets correct
  steps; the guide is superseded rather than wrong.
- **Fix:** Cheap and worth doing **before** the deploy anyway: add a banner at the top of
  `deployment-guide.html` — "for the storybook-v2 / payments / print deploy, follow
  `plans/storybook-v2/sv2-deploy-0-first-prod-deploy.md` first; this guide covers the steady-state deploy
  only." Fold the new env vars and the `pdf-sidecar` service into the guide properly **after** DEPLOY-0 lands,
  when the compose file is actually true.

### r4 clean bill + doc drift already logged elsewhere
- **`DEPLOY-0` itself is accurate and current** (updated 2026-07-22) — backup, restore-verification, migration
  rehearsal against real data, sidecar wiring, and the explicit "rollback = restore the dump" position. No
  stale status found in it.
- **In-code class docs held up well.** The print/payments classes carry unusually good *why* comments
  (permitAll placement rationale in `PrintOrdersController`/`PrintController`, the `COALESCE` reasoning, the
  "5 consecutive failures deactivate the webhook" warning, the kill-switch semantics). Spot-checks after
  s14a-2 found no drift.
- **Two drifted comments were already caught in earlier passes** — not renumbered here: `StorybookTab.jsx:362`
  advertises a "PDF download" that no longer exists (**F2**), and `LuluClient`'s Javadoc points readers at
  `getPrintJob` as the polling entry point when both feeds use `getPrintJobRaw` (**F4**).
- **`Backend/`'s scripts are undocumented** in `CLAUDE.md` — `lulu-webhooks.sh`, `lulu-verify.sh`,
  `lulu-pr5-verify.sh`, `stripe-listen.sh`, `run-migrations.sh` all exist and none is mentioned. Minor; fold
  into the F11 primer rather than tracking separately.

## Pass r5 — General improvements (correctness / security / structure)
_Run 2026-07-22, by hand. **0 ⛔.** The two things this pass exists to catch — the permitAll trap and the
destructive migrations — were both chased to a definite answer and both came back clean. The headline is under
"r5 clean bill": **no destructive migration touches any table that exists in production.** Three 📋 findings
below; **F13 is the one worth fixing before the deploy anyway** (2 lines)._

### F13 — The shared `RestTemplate` has no timeouts; a hung Anthropic call can pin a request thread forever
- **Label:** 📋 DEFERRED — *considered for ⛔; see the reasoning. **Recommend fixing pre-deploy regardless** —
  it is a two-line change with no behavioural risk.*
- **Where:** `config/AppConfig.java:11–13` — `return new RestTemplate();` · consumed by
  `storybook/ClaudeClient.java:32`
- **What:** The shared bean is a bare `new RestTemplate()`, which uses `SimpleClientHttpRequestFactory`
  defaults — **connect and read timeouts are both infinite**. `ClaudeClient` (the "✨ write this for me" assist)
  is the one caller that uses it. The print clients do **not** share this problem: `LuluClient.java:63–64` sets
  10s/30s and `PrintSidecarClient.java:31–32` sets 10s + the render timeout, each on its own factory.
- **Why it matters:** If Anthropic accepts a connection and then stalls, the calling Tomcat worker blocks
  indefinitely. Enough concurrent stalled assists exhaust the worker pool (default 200) and the **whole API**
  stops responding — including `/billing/webhook` and `/print/lulu-webhook`. That's the compounding part:
  Lulu **deactivates a webhook after 5 consecutive failed deliveries**, so an unrelated AI outage could switch
  off the print status feed. **Why not ⛔:** it requires a true silent stall (not an error or a close), the
  reconciliation sweep is an independent safety net for exactly that failure, and Stripe redelivers for days.
  It degrades availability; it does not move money wrongly or leak data.
- **Fix:** Give the bean a factory with `setConnectTimeout(10_000)` / `setReadTimeout(60_000)` — mirroring what
  `LuluClient` already does. Anthropic calls are seconds, so 60s is generous.

### F14 — `ApiError.serverError(e.getMessage())` returns raw internal exception text to clients
- **Label:** 📋 DEFERRED
- **Where:** ~12 sites, incl. `billing/BillingController.java:43`, `book/BookController.java:44,61,79,93`,
  `book/PublicBookController.java:33` (**unauthenticated**), `print/PrintController.java:120`,
  `upload/UploadController.java:36`, `admin/AdminController.java:43`
- **What:** The terminal `catch (Exception e)` blocks — correctly present for the Spring 401 trap — pass
  `e.getMessage()` straight into the 500 body. For these controllers that message can originate from Stripe,
  Cloudinary, Lulu, or the JDBC driver, so vendor phrasing, request ids, and SQL/constraint details can reach
  the client. `PublicBookController` does it on a **permitAll** route. Notably the global
  `@RestControllerAdvice` (`common/ApiExceptionHandler.java:61`) gets this right — it returns a flat
  `"An unexpected error occurred"` — so the per-controller handlers are the inconsistent ones.
- **Why it matters:** Low severity, not a key leak — I checked, and no secret is ever logged or returned
  (see clean bill). It's information disclosure that aids probing, and it's inconsistent with the handler the
  codebase already treats as correct.
- **Fix:** Log `e` server-side (already done in most places) and return a generic message, matching
  `ApiExceptionHandler`. Keep the specific mapped errors (`notFound`/`conflict`/`badRequest`) exactly as they
  are — those are deliberate and carry no internal detail.

### F15 — Share-token queries authorize by pre-check rather than in the WHERE clause
- **Label:** 📋 DEFERRED (defense-in-depth; **not** exploitable today)
- **Where:** `book/BookShareService.java:60` (`SELECT token FROM book_share_tokens WHERE book_id = ?`) and
  `:71` (`DELETE FROM book_share_tokens WHERE book_id = ?`)
- **What:** Both statements are scoped by `book_id` **only**. Ownership is enforced by the
  `requireOwnedBook(userId, bookId)` call immediately above each (lines 58 and 70), which throws first — so
  the behaviour is correct. But this is the pre-check shape the r5 checklist explicitly warns about, and it is
  the *only* place in the new code that deviates: every other user-data query
  (`storybook_chapters`, `family_members`, `birth_details`, `bump_photos`, `print_orders`) carries
  `baby_profile_id = ?` or `user_id = ?` **in the WHERE clause**.
- **Why it matters:** Not today — the guard is two lines above the query. It matters if these statements are
  ever reused, extracted into a helper, or called from a new path that forgets the pre-check, because the SQL
  itself would happily read or revoke **any** book's share token by id. That is the shape the June IDOR had.
- **Fix:** Fold the owner scope into the SQL (`... FROM book_share_tokens t JOIN books b ... JOIN baby_profiles
  bp ... WHERE t.book_id = ? AND bp.user_id = ?`) so the statement is safe standalone. Natural to do together
  with **F5**'s ownership consolidation.

### r5 clean bill — the checks this pass exists for, all chased to a definite answer

**1. ⛔ The permitAll table — filled in completely, no blanks.** (Audited in r1, restated here as the plan requires.)

| route | authorizes via | verified |
|---|---|---|
| `/health` | Actuator only; `exposure.include=health`, `show-details=never` | ✅ no custom controller exists |
| `/auth/register\|login\|refresh\|logout\|verify-email\|forgot-password\|reset-password` | anonymous by design | ✅ `/auth/me` + `/auth/resend-verification` are **not** listed → JWT required |
| `/admin/**` | `X-Admin-Secret` header, **refuses when the secret is blank** | ✅ `AdminController:28` — one route only |
| `/book/public/{token}` | share token **and** `b.share_unlocked_at IS NOT NULL` | ✅ `PublicBookService:66` |
| `/print/payload/{token}` | short-lived JWT, signature + expiry + **`purpose` claim** | ✅ `JwtUtil:72` |
| `/print/pdf/{token}` | 32-byte `SecureRandom` opaque token + `expires_at > NOW()` | ✅ `PrintPdfStore:46` |
| `/print/lulu-webhook` | HMAC-SHA256 over raw body, constant-time, **fail-closed on blank secret** | ✅ `LuluWebhookService:90` |
| `/billing/webhook` | Stripe signature over the raw body | ✅ `BillingWebhookController:38` |

Also confirmed: `PrintController` (`/books/{bookId}/print/**`) and `PrintOrdersController` (`/print-orders`)
are **not** matched by `/print/**` and fall through to `anyRequest().authenticated()` — the pr9/s14c trap is
correctly avoided, and both files document why.

**2. IDOR — clean.** Every new user-data query puts the owner scope **in the WHERE clause**, not in a
pre-check: `storybook_chapters` (`baby_profile_id = ?` on read/update/delete/reorder), `family_members`,
`birth_details`, `bump_photos`, and `print_orders` (`WHERE po.stripe_session_id = ? AND po.user_id = ? AND
po.book_id = ?` for the confirmation, `WHERE po.user_id = ?` for the list). Profile ids are always derived
server-side from the JWT via `BabyProfileRepository`, never accepted from the client. The one deviation is
**F15**.

**3. The Spring 401 trap — clean.** Every controller that calls an external service (Stripe, Lulu, Cloudinary,
Claude, the sidecar) ends in `catch (Exception e)` → mapped `ApiError`, and several carry a comment naming the
trap. There is also a global `@RestControllerAdvice` backstop (`ApiExceptionHandler`). The controllers without
a terminal catch (`BirthDetails`, `FamilyMember`, `Milestone`, `Vaccine`) are DB-only and covered by the advice.

**4. Secrets — clean.** No key, token, or HMAC material appears in any log statement: the only signature-related
logs are `e.getMessage()` on a verification failure, and `ClaudeClient:69` logs **model + maxTokens only**, with
an explicit comment that prompts/responses are withheld because they carry personal family content.
`failure_reason` (raw Lulu operator text) is confirmed **absent** from `ORDER_SELECT` — the single customer-facing
projection — and `PrintCustomerEmail` states it sends no raw vendor text. Committed scripts were not found to
echo credentials.

**5. Money paths — idempotent at every branch.** `createCheckout` refuses on the kill switch **first** (no
charge for a dormant feature), validates quantity, then **recomputes the amount server-side** from
`orderability()` + `PrintPricingService` — the client's number is never trusted — and passes a per-order Stripe
idempotency key (`print_order_{orderId}`) so a transport retry can't double-create a session. Fulfilment is
gated by the atomic `pending→paid` claim (a second delivery affects 0 rows → no second Lulu job → **no second
physical book**); grants use `ON CONFLICT DO NOTHING`; refund recording uses `COALESCE(?, refund_id)` and
`*_notified_at` guards; status UPDATEs are guarded so a replayed event cannot un-ship an order.

**6. ⭐ Migrations V37–V53 — verified safe, and more strongly than expected.** Every destructive statement
targets a table **created later than V22**, i.e. created earlier *in the same run*, so **none of them can touch
data that exists in production today**:
| statement | target created in | verdict |
|---|---|---|
| `V42` `TRUNCATE storybook_chapters` + 3× `DROP COLUMN` | **V24** (`create_storybook_chapters`) | ✅ 18 steps earlier, same run |
| `V43` `DELETE FROM storybook_chapters` / `DELETE FROM books` | **V24** / **V42** | ✅ same run |
| `V45` `DROP COLUMN is_step` | `family_members` = **V41** | ✅ same run |
| `V48` `DROP TABLE book_share_tokens` | **V25** | ✅ same run |
Prod is at **V22**, so none of these tables exists there yet. I also checked the V27 concern specifically:
it is an `UPDATE storybook_chapters SET image_url = (SELECT … FROM journal_entries / first_times …)` — it
**reads** real journal/first-times content and writes only into the in-run chapters table. V42 truncating those
rows therefore discards derived data, **never the source**; `journal_entries` and `first_times` are never
written by any of these migrations. **This does not replace DEPLOY-0's rehearsal on a restored dump** — the
rehearsal remains the real proof, and V42's `TRUNCATE` still deserves to be watched on real data.

**7. Resilience — good.** `reconcile()` wraps each row in `try/catch/finally` so one bad order can't abort the
pass, always stamps `last_checked_at` in the `finally`, and is bounded by a batch limit, a staleness filter and
a time horizon. Failures are logged with the exception, never swallowed. External calls have explicit timeouts
except the shared `RestTemplate` (**F13**). No email or outbound call is made while holding a transaction open.

---

## Running tally
**r1–r5 all run 2026-07-22 in one session.**

| | ⛔ ship-blockers | 📋 deferred | findings |
|---|---|---|---|
| r1 Dead code | 0 | 4 | F1–F4 |
| r2 Duplication | 0 | 2 | F5–F6 |
| r3 Test coverage | 0 | 3 | F7–F9 |
| r4 Documentation | 0 | 3 | F10–F12 |
| r5 Security / money | 0 | 3 | F13–F15 |
| **total** | **0** | **15** | |

_Update this table at the end of each pass — it's the number Michael reads to decide whether shipping is still
on track._

### What this means for shipping
**Nothing found blocks DEPLOY-0.** The two checks the review existed to perform both came back clean with a
definite answer, not an "it looks fine":
- **The permitAll trap** (hit twice on this branch) — all 8 permitted routes self-authorize; table filled in
  with no blanks, in r5.
- **The destructive migrations** — every one targets a table created **after V22**, so none can touch data
  that exists in production. DEPLOY-0's rehearsal on a restored dump is still the real proof.

Three findings are worth acting on sooner than "some day", in this order:
1. **F13** — 2-line timeout fix on the shared `RestTemplate`. Worth doing pre-deploy; no behavioural risk.
2. **F11** — write the payments/print primer **now**, while the architecture is in working memory.
3. **F7** — one `MockMvc` test that fails when a new route lands under a permitAll namespace. This is the
   automated guard for the mistake this codebase keeps making by hand.

The remaining twelve are ordinary debt (dead modules, a 4× ownership helper, formatter drift, doc paths) and
should be sliced **after** launch, not before — per the README's rule that dead code and duplication must not
turn into a pre-ship refactor.
