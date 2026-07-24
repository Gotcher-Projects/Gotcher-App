# Session prompts — storybook-v2 branch review

One prompt per pass. **Each assumes a cold session** — the prompt plus the plan file is enough to start.
Run in order r1 → r6; r1–r5 are independent if you need to skip and come back.

⚠ Every pass **appends to `findings.md`**. That file is the only thing that survives a context reset — a
finding left in a transcript is a lost finding.

---

## r1 — Dead code (~45m)
```
Review pass r1 (dead code). Plan: plans/storybook-v2-review/r1-dead-code.md — read plans/storybook-v2-review/README.md first for scope + triage rules.
SCOPE = 6ab07b0..HEAD (189 files), NOT main..HEAD — everything up to PR #26 already had this same 5-pass review.
Default label is DEFERRED. The ONE ship-blocker to hunt: a forgotten dev/throwaway route under a permitAll
namespace (/print/**, /admin/**, /book/public/**) — pr7 deleted PrintDevController; confirm nothing similar
survived. Also: AI page-gen relics (batched generation was REMOVED in sv2-s11, CLAUDE-DEBUG logging deleted),
residue from the scrapbook->guided rework, the reverted L-WRAP work, and the dropped s9.0a.
Append findings to plans/storybook-v2-review/findings.md under Pass r1, numbered F1.., and update the tally.
```

## r2 — Duplication (~45m)
```
Review pass r2 (duplication). Plan: plans/storybook-v2-review/r2-duplication.md — README.md first.
Default label DEFERRED; it's only a ship-blocker when copies have DIVERGED in a way that changes behaviour.
Check the shared utils are reused (PhotoPickerButton, uploadCroppedPhoto, cleanBodyText, useCanvasScale,
captureElement, TwemojiImage, formatDate/formatMonthYear/formatCents). HARD RULE: no inline
toLocaleDateString - all display dates go through lib/formatting.js (noon-anchored). Backend: repeated
print_orders projections (s14c consolidated two into ORDER_SELECT - find others), ownership checks that
differ from requireOwnedBook, anything re-deriving order status outside LuluJobStatusMapper.
Append to findings.md under Pass r2; update the tally.
```

## r3 — Test coverage (~45m)
```
Review pass r3 (test coverage). Plan: plans/storybook-v2-review/r3-test-coverage.md — README.md first.
Baseline: 423 backend + 344 frontend tests, all green. This is NOT about raising a number - find gaps where a
bug costs money or data. Tier 1: the atomic pending->paid claim (double-submit = two physical books),
GrantService idempotency, BillingWebhookService routing, PrintRefundService (COALESCE refund_id, refundFailed
undo). Tier 2: LuluJobStatusMapper, the reconcile sweep, share tokens. Also ask whether ANY test would fail if
a new route landed under /print/** - that would have caught the pr9 trap.
SHIP-BLOCKER only for an untested money/data path never exercised by tests OR the s14 live run. Append under
Pass r3; update the tally.
```

## r4 — Documentation (~30m, run late)
```
Review pass r4 (documentation). Plan: plans/storybook-v2-review/r4-documentation.md — README.md first.
Runs late so it describes final code. Already known-wrong, confirm + fix: CLAUDE.md says start-services.sh is
in Backend/ (it's at the repo ROOT), and stop-services.sh doesn't reliably kill the API (stale java on 3001).
Check deployment-guide.html against what DEPLOY-0 actually does now (backup + migration rehearsal + a new
pdf-sidecar service) - a stale runbook followed under pressure is a SHIP-BLOCKER. Ask whether any
payments/print primer exists equivalent to storybook-context.md; if not that's a real gap.
Append under Pass r4; update the tally.
```

## r5 — General improvements: security + money (~1.5h) — **the important one**
```
Review pass r5 (general improvements - correctness, security, structure). Plan:
plans/storybook-v2-review/r5-general-improvements.md — README.md first. Do this BY HAND even if
/code-review ultra has run.
1. Fill in the permitAll authorization table completely - every route under /health, /auth/*, /admin/**,
   /book/public/**, /print/**, /billing/webhook must self-authorize. ANY BLANK IS A SHIP-BLOCKER. This trap
   was hit twice (pr9, s14c).
2. IDOR: user_id in the WHERE clause, not a pre-check.
3. The Spring 401 trap: controllers calling external services must catch(Exception) -> ApiError.
4. Secrets: nothing in logs/error bodies/DTOs; failure_reason holds raw vendor text and must never reach a
   customer payload.
5. Money: every webhook branch idempotent (Stripe WILL redeliver); nothing can double-charge, double-grant or
   double-submit a print job; amounts recomputed server-side.
6. Migrations V37-V53 destructive statements (V42/V43/V45/V48) - second pair of eyes; DEPLOY-0's rehearsal is
   the real proof.
Use SHIP-BLOCKER freely here. Append under Pass r5; update the tally.
```

## r6 — Assemble + triage (~30m)
```
Review pass r6. Plan: plans/storybook-v2-review/r6-assemble-and-triage.md — needs findings.md populated by r1-r5.
Build branch-review-storybook-v2.html at the REPO ROOT, self-contained, same shape as branch-review.html.
DO NOT overwrite branch-review.html (June's record). Ship-blocker summary at the very top, then scope
(6ab07b0..HEAD and why not main..HEAD), then one section per pass, then a counts table.
Then re-triage: for each SHIP-BLOCKER ask "does this strand a paying customer, leak data, lose data, or move
money wrongly?" - if not, downgrade and record why. June's review had exactly ONE blocker across five passes;
if this has twelve, the bar drifted.
Fix the blockers (or record Michael's explicit downgrade). Slice the deferred pile only if it earns it.
```
