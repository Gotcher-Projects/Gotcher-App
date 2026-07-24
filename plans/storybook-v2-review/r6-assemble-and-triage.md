# r6 — Assemble the artifact + triage

**Status:** Not started · **Est:** ~30m · **Depends on:** r1–r5 (needs `findings.md` populated)
**Read first:** `README.md`, `findings.md`, `branch-review.html` (repo root — the format to match)

Turn the findings log into the written artifact and the go/no-go decision. This is the session that ends with
Michael saying ship or not-yet.

---

## 1. Build `branch-review-storybook-v2.html`

At the **repo root**, self-contained (no external assets), same shape as `branch-review.html`.
⚠ **Do NOT overwrite `branch-review.html`** — it is the record of the June `pregnancy-updates` review.

Structure:
1. **Ship-blocker summary at the very top** — the only section that must be read before deploying. Every ⛔ with
   its one-line claim and current state (open / fixed / downgraded-by-Michael-because-X). If the list is empty,
   say so loudly.
2. **Scope statement** — reviewed `6ab07b0..HEAD` (189 files / 16,583 insertions), and **why not `main..HEAD`**:
   everything to PR #26 already passed this same 5-pass review (`branch-review.html` →
   `storybook-and-pregnancy-review-fixes/` s1–s11, all Complete).
3. **One section per pass**, findings in order, each with label, location, what, why it matters, suggested fix.
4. **Counts table** — ⛔ vs 📋 per pass.

## 2. Triage review
Re-read every ⛔ and ask the same question of each: *does this strand a paying customer, leak data, lose data,
or move money wrongly?* If not, downgrade it to 📋 and record why. **Precedent: the June review had exactly one
ship-blocker out of five passes** — if this one has twelve, the bar has drifted and they should be re-examined.

Conversely, re-read the 📋 pile once for anything mislabelled — particularly in r5.

## 3. Fix the ship-blockers
Each ⛔ gets fixed **and verified** before DEPLOY-0, or is explicitly downgraded by Michael with the reason
recorded in the artifact. Small fixes can land here; anything substantial becomes its own slice.

## 4. Slice the deferred pile — only if it earns it
If 📋 is large, create `plans/storybook-v2-review-fixes/` mirroring the June track (small implement-then-verify
plans, backend cleanup → security → tests parallel to frontend dedup → refactor, **docs last**). If it's a
handful of items, a list in `plans/storybook/tech-debt.md` is enough. **Don't build an eleven-session track for
six findings.**

## 5. Hand it over
Michael reads the ship-blocker summary and gives the go-ahead. That go-ahead is the gate on
`plans/storybook-v2/sv2-deploy-0-first-prod-deploy.md`.

## Done when
- [ ] `branch-review-storybook-v2.html` exists at the repo root; `branch-review.html` untouched.
- [ ] Every ⛔ is fixed-and-verified, or downgraded with a recorded reason.
- [ ] Deferred findings live somewhere durable (a track, or tech-debt) — not only in the artifact.
- [ ] Michael has read the summary and said go.
- [ ] Each pass file's Status flipped to Complete.

## Then
**DEPLOY-0** → **P12** → **pr10** (print left OFF).
