# r3 — Test coverage

**Status:** ✅ **Done 2026-07-22** — findings **F7–F9**, all 📋 DEFERRED, **0 ⛔**.
Baseline **re-verified green: 423 backend / 344 frontend, 0 failures.** Every Tier 1 money path is genuinely
asserted (redelivery no-submit, grant replay, refund COALESCE + undo). The three gaps are correct-but-unguarded
code; **F7 (no HTTP/authorization test at all) is the highest-value follow-up.** See `findings.md` → Pass r3.
· **Est:** ~45m · **Independent:** yes
**Read first:** `README.md` (scope `6ab07b0..HEAD`, triage rules, findings format)

Find untested code **weighted by blast radius**, not by line count. Append findings under **Pass r3**.

> Baseline as of 2026-07-21: **423 backend tests, 344 frontend, all green.** Coverage is already decent, so
> this pass is **not** about raising a number. It is about finding gaps in the places where a bug costs
> somebody money or data.
>
> A missing test is ⛔ only when it guards a **money or data-loss path that has never been exercised at all** —
> neither by a test nor by the live s14 verification run. Most gaps are 📋.

---

## Rank by blast radius

### Tier 1 — money and irreversibility (check these first)
- **The atomic `pending→paid` claim** (`PrintOrderFulfilmentService`) — the single guard against submitting two
  Lulu jobs, i.e. printing and shipping two physical books. Covered by `PrintOrderFulfilmentServiceTest`;
  confirm the redelivery case is genuinely asserted.
- **`GrantService.apply`** — the credit ledger's `ON CONFLICT DO NOTHING` idempotency. A hole here grants
  credits nobody paid for, or takes money and grants nothing.
- **`BillingWebhookService` routing** — `checkout.session.completed` vs `charge.refunded` vs `refund.created`
  vs `refund.failed`, plus the "ignore everything else with a 200" default.
- **`PrintRefundService`** — especially `COALESCE(?, refund_id)` (a plain assignment would wipe the id) and
  `refundFailed` undoing a recorded refund.

### Tier 2 — state that drives customer-visible outcomes
- **`LuluJobStatusMapper`** — the rejection-reason extraction and the "only move forward" rule.
- **`PrintOrderStatusService.reconcile`** — the sweep's eligibility conditions and the resume cap.
- **Share tokens** — mint/regenerate/revoke, and the content-based public-visibility rules (s13e-2).

### Tier 3 — everything else
Pricing table edges, page-count gate boundaries (31/32/50/51), layout/canvas rendering.

## Specific gaps worth checking for
- Is there **any** test asserting `SecurityConfig`'s permitAll list? A test that fails when a new route lands
  under `/print/**` would have caught the pr9 trap twice over. (Likely 📋, but high value.)
- Are the **frontend** money/date formatters tested (`formatCents`, `formatDate` noon-anchoring)?
- `PrintCustomerEmail`'s one-shot guards — a redelivery must not re-send. Covered; confirm both emails.
- Migrations: nothing tests them, and V23→V53 runs against live data. **The mitigation is DEPLOY-0's rehearsal,
  not a unit test** — note it here and move on rather than proposing a migration-test framework.

## Method
```bash
cd Backend && ./gradlew test          # 423 expected
cd Frontend && npm run test -- --run  # 344 expected
git diff --name-only 6ab07b0..HEAD -- Backend/src/main | sed 's/main/test/;s/\.java/Test.java/' # crude: which have no test file
```

## Done when
- [ ] Tier 1 paths each confirmed to have a real assertion (not just a test that constructs the class).
- [ ] Gaps appended under Pass r3, numbered continuously, labelled — **⛔ reserved for untested money/data paths**.
- [ ] Tally updated.

## Not this pass
Writing the missing tests (that's a follow-up slice) · dead code (r1) · duplication (r2) · docs (r4) · security (r5).
