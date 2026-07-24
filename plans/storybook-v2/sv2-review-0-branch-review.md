# REVIEW-0 — 5-pass branch code review (ship gate)

**Status:** ➡️ **SLICED 2026-07-22 → `plans/storybook-v2-review/`** — this file is now a pointer.
**Blocks:** ⛔ `sv2-deploy-0-first-prod-deploy.md` → P12 → pr10.

The standing pre-ship requirement — **dead code, duplication, test coverage, documentation, general
improvements** — was too big for one session, so each pass is now its own file and can be run in any sitting.

---

## Where the work lives

**`plans/storybook-v2-review/`**

| | |
|---|---|
| `README.md` | **read first** — scope, triage rules, findings format. Every pass session starts cold. |
| `findings.md` | the running log **every pass appends to** — this is what survives a context reset |
| `r1-dead-code.md` · `r2-duplication.md` · `r3-test-coverage.md` · `r4-documentation.md` · `r5-general-improvements.md` | the five passes (~45m/45m/45m/30m/1.5h) |
| `r6-assemble-and-triage.md` | builds `branch-review-storybook-v2.html`, re-triages, gates the ship |
| `session-prompts.md` | one paste-able prompt per pass |

**Order:** r1 → r2 → r3 → r4 → r5 → r6. r1–r5 are independent; r4 is late so docs describe final code;
r5 (security/money) is the one that matters most; r6 needs the rest.

## The two decisions that made this tractable

1. **Scope is `6ab07b0..HEAD`, not `main..HEAD`.** Everything to PR #26 (2026-06-21) already passed this exact
   5-pass review — `branch-review.html` → `storybook-and-pregnancy-review-fixes/` s1–s11, all Complete.
   That's 258 files → **189 files / 16,583 insertions**.
2. **Every finding is ⛔ ship-blocker or 📋 deferred.** Only ⛔ blocks the deploy. Dead code and duplication are
   almost always 📋 — they must not turn into a pre-ship refactor.

## Then
**DEPLOY-0** (deploy dormant) → **P12** (Stripe live) → **pr10** (Lulu prod, print left OFF).
