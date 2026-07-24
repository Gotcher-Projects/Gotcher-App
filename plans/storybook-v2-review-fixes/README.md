# Storybook-v2 review — fixes track

**Status:** Not started — sliced 2026-07-22 from `plans/storybook-v2-review/findings.md` (F1–F15).
**Precedent:** `plans/storybook-and-pregnancy-review-fixes/` (the June review's follow-up track).

The 5-pass branch review (`plans/storybook-v2-review/`) found **0 ⛔ ship-blockers and 15 📋 deferred items**.
This folder turns those 15 into small, independent sessions. **None of these blocks DEPLOY-0** — the review
cleared the branch to ship. This is the debt list, split by when it's worth doing.

---

## Read this first (each session starts cold)

- **Every finding is 📋, not a ship-blocker.** The branch is cleared to deploy; do these on their own schedule.
- **Full detail per finding lives in `plans/storybook-v2-review/findings.md`** (F1–F15), including the *why*
  and the exact file:line. Each session below names its findings — read those rows first.
- **Independent.** Any session can be done in any order within its tier. Numbering is priority, not dependency.
- **Don't let a cleanup session grow.** The review's whole point was to keep debt out of the pre-ship path;
  don't reverse that by turning s4/s7 into a refactor marathon. One session, the named findings, stop.

## Tier 1 — sooner (around the deploy)

| session | findings | what | when |
|---|---|---|---|
| `s1-resttemplate-timeouts.md` | F13 | Give the shared `RestTemplate` connect/read timeouts | **pre-deploy** — 2 lines |
| `s2-payments-print-primer.md` | F11 | ✅ **Done 2026-07-22** — primer at `plans/storybook-v2/payments-print-context.md`; `CLAUDE.md` stack + pointers updated (also fixed F10's start-path → s7 skips it) | done |
| `s3-permitall-auth-test.md` | F7 | One `MockMvc` test that fails when a new route lands under a permitAll namespace | **first thing after deploy** |

## Tier 2 — eventually (ordinary post-launch debt)

| session | findings | what |
|---|---|---|
| `s4-dead-code.md` | F1, F4 (+ F2/F3 gated on a decision) | Remove dead modules/methods; decide the fate of two dead features |
| `s5-security-hygiene.md` | F5, F15, F14 | Consolidate the 4× ownership check; put owner scope in share-token SQL; stop leaking raw exception text in 500s |
| `s6-test-backfill.md` | F8, F9 | Test the print render token + PDF store; test the 3 unrouted Stripe refund branches |
| `s7-small-debt.md` | F6, F10, F12 | `formatTime` helper; fix `CLAUDE.md` start path; banner on the stale deploy guide |

## Order
Tier 1 in number order (s1 pre-deploy, s2 now, s3 right after). Tier 2 any order. **s5 touches money paths —
do it after the deploy has settled, never before.**
