# r4 — Documentation

**Status:** ✅ **Done 2026-07-22** — findings **F10–F12**, all 📋 DEFERRED, **0 ⛔**.
Both known-wrong items **confirmed** (start-services.sh is at the ROOT; stop caveat missing). The runbook was
the ⛔ candidate and was **deliberately de-escalated**: every new setting has a safe blank default so the app
boots dormant regardless, and DEPLOY-0 already carries the backup/rehearsal/sidecar steps the old guide lacks.
Biggest real gap: **no payments/print primer** (F11) — best written while it's all in working memory.
· **Est:** ~30m · **Independent:** yes (but **run it late** — see below)
**Read first:** `README.md` (scope `6ab07b0..HEAD`, triage rules, findings format)

Check the docs describe the code as it **actually is now**. Append findings under **Pass r4**.

> **Runs late on purpose.** Docs should describe the final code, so this pass comes after r1–r3 (and ideally
> after any r1/r2 fixes land). If passes get reordered for scheduling, keep this one last of r1–r4.
>
> Documentation findings are **📋 by default**. The exception: **a doc that will actively mislead someone
> during the launch** — a wrong command in a runbook, a wrong path in a deploy step. Those are worth ⛔ because
> they cost you at exactly the wrong moment.

---

## Known-wrong already (confirm and fix, don't re-discover)

- ⚠ **`CLAUDE.md` says `cd Backend && ./start-services.sh`. The script is at the repo ROOT.** Confirmed
  repeatedly during the s14 sessions. This one has cost real time.
- ⚠ **`CLAUDE.md`'s stop command** — `./stop-services.sh` at root does **not** reliably kill the API; a stale
  java process keeps port 3001. Worth documenting the `netstat -ano | grep :3001` + kill fallback.
- **`plans/storybook-v2/print/print-full-plan.md`** and **`pr0`** both had stale "Not started / blocked"
  statuses (fixed 2026-07-21) — sanity-check no other overview file still lies about state.

## What to check

### Repo-level
- **`CLAUDE.md`** — stack, how-to-run, gotchas. Does it mention the print/payments architecture at all? A
  future session lands here first.
- **`deployment-guide.html`** — the deploy runbook. It predates payments, print and the sidecar; DEPLOY-0 adds
  a backup + migration rehearsal and a new `pdf-sidecar` service. **If the runbook is what someone follows
  under pressure, a stale one is a ⛔.**
- **`Backend/README.md`** — does it know about the new scripts (`lulu-webhooks.sh`, `lulu-pr5-verify.sh`)?

### Feature primers (the "read before working here" docs)
- `plans/storybook/storybook-context.md` — still accurate after the v2 rework?
- Is there **any** primer for payments/print equivalent to the storybook one? If not, that's a real gap: the
  print track alone is 11 plan files plus s14, and nothing summarises the runtime architecture.

### In-code
The new print/payments classes carry unusually detailed class-doc comments (deliberately — they explain *why*,
e.g. the permitAll placement rationale, the COALESCE reasoning). Spot-check that those didn't drift during
s14a-2's changes.

## Done when
- [ ] `CLAUDE.md` start/stop instructions corrected.
- [ ] `deployment-guide.html` reviewed against what DEPLOY-0 actually does.
- [ ] Findings appended under Pass r4, numbered continuously, labelled; tally updated.

## Not this pass
Rewriting the docs (that's a follow-up slice — unless it's a ⛔ runbook error, which fix now) · code passes r1–r3, r5.
