# Storybook-v2 — 5-Pass Branch Review (ship gate)

**Status:** **r1–r5 ✅ COMPLETE (2026-07-22, one session) — 0 ⛔ ship-blockers, 15 📋 deferred (F1–F15).**
➡️ **Next: r6** (assemble `branch-review-storybook-v2.html` + re-triage). Findings are in `findings.md`;
each pass file carries its own result summary. **No finding blocks DEPLOY-0.**
**Blocks:** ⛔ `plans/storybook-v2/sv2-deploy-0-first-prod-deploy.md` → P12 → pr10. Nothing ships until every
**⛔ ship-blocker** from this review is closed.
**Precedent:** `branch-review.html` (repo root, 2026-06-21) + `plans/storybook-and-pregnancy-review-fixes/`

The standing pre-ship requirement: **five passes — dead code, duplication, test coverage, documentation,
general improvements.**

---

## Read this before ANY pass (each session starts cold)

### Scope — `6ab07b0..HEAD`, NOT `main..HEAD`
`main` is at 2026-04-28 / migration **V22**, so the PR against it is ~3 months of work. But **everything up to
PR #26 (2026-06-21) already had this exact 5-pass treatment** — `branch-review.html`, whose findings became
`storybook-and-pregnancy-review-fixes/` s1–s11, all Complete. Re-reviewing it is waste.

| | files | insertions |
|---|---|---|
| Whole PR (code only) | 258 | 24,827 |
| **`6ab07b0..HEAD` — THIS review's scope** | **189** | **16,583** |

Scope breakdown: **79** backend main · **25** backend test · **68** frontend · **17** migrations (V37–V53).
Content: the big storybook-v2 change, payments P1–P11, share s13a–e, print pr1–pr9 + s14.

```bash
git diff --stat 6ab07b0..HEAD -- Backend/src Frontend/src Backend/db
git diff --name-only 6ab07b0..HEAD -- Backend/src Frontend/src Backend/db
```
> Files that existed before but were **touched again** after PR #26 are in scope — the diff already covers that.

### Every finding gets ONE of two labels
- **⛔ SHIP-BLOCKER** — security, money correctness, data loss, or anything that strands a paying customer.
  **Must be fixed before DEPLOY-0.** Expect few; the June review had exactly one (an IDOR).
- **📋 DEFERRED** — everything else. Logged, sliced later, shipped after launch.

**Dead-code and duplication findings are almost always 📋.** Do not let them become a pre-ship refactor — that
is what the follow-up track is for.

### Findings accumulate in `findings.md` — this is what makes chunking work
Every pass **appends** to `findings.md` in this folder, in the standard row format (see that file's header).
Because each pass is its own session and context may reset between them, **a finding that only exists in a
chat transcript is a lost finding.** Write it down as you go, not at the end.

### Order
**r1 → r2 → r3 → r4 → r5 → r6.** Documentation (r4) is late on purpose so it describes the final code;
r5 (security/money) is the highest-value pass and r6 assembles the artifact.

| pass | file | est |
|---|---|---|
| r1 Dead code | `r1-dead-code.md` | ~45m |
| r2 Duplication | `r2-duplication.md` | ~45m |
| r3 Test coverage | `r3-test-coverage.md` | ~45m |
| r4 Documentation | `r4-documentation.md` | ~30m |
| r5 General improvements (security/money) | `r5-general-improvements.md` | ~1.5h |
| r6 Assemble + triage | `r6-assemble-and-triage.md` | ~30m |

Passes r1–r5 are **independent** — if you have to skip one and come back, nothing breaks. r6 needs the rest.

### Output
**`branch-review-storybook-v2.html`** at the repo root, built by r6 from `findings.md`.
⚠ **Do not overwrite `branch-review.html`** — that's the record of the June review.

### Accelerator
`/code-review ultra` (user-triggered and billed — Claude cannot launch it) parallelises the mechanical passes
well. Worth running alongside r1–r3. **r5 deserves a hand review regardless** — it's the money and security pass.
