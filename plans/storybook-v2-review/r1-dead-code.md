# r1 — Dead code

**Status:** ✅ **Done 2026-07-22** — findings **F1–F4**, all 📋 DEFERRED, **0 ⛔**.
The ⛔ permitAll route audit **PASSED** (no forgotten dev route; every permitted route self-authorizes) and the
AI page-gen relics are confirmed gone. See `findings.md` → Pass r1 (incl. its "clean bill" list).
· **Est:** ~45m · **Independent:** yes
**Read first:** `README.md` (scope `6ab07b0..HEAD`, triage rules, findings format)

Find code that no longer has a caller, a route, or a reason. Append findings to `findings.md` under **Pass r1**.

> **Default label for this pass is 📋 DEFERRED.** Dead code is real debt but almost never blocks a ship. The
> one exception that IS a ⛔: **a live unauthenticated route.** See the first bullet.

---

## What to look for — specific to this branch

### ⛔ The one thing here that can be a ship-blocker
**Forgotten dev/throwaway endpoints, especially under a `permitAll` namespace.** `SecurityConfig` permits
`/health`, part of `/auth/*`, `/admin/**`, `/book/public/**`, `/print/**`, `/billing/webhook`. pr7 deleted
`PrintDevController` and the lulu-test triggers — **confirm nothing similar survived anywhere**, and that every
surviving route under those namespaces is intentional. A dead-but-live route in `/print/**` is unauthenticated
by definition.

### AI page-generation relics
Batched AI page generation was **removed** (sv2-s11) and the `[CLAUDE-DEBUG]` request/response logging was
deleted by the hygiene plan. Confirm both are genuinely gone, including:
- prompt-building helpers, response parsers, and any `ClaudeClient` methods only used by batched generation
- DB columns/tables that only the removed feature wrote (e.g. generated-content columns from V34)
- frontend components/actions for a "generate pages" affordance that no longer exists
- `grep -rn "CLAUDE-DEBUG" Backend/` should return nothing

### Reversals and half-landed work
The branch went through several direction changes; each may have left residue:
- **scrapbook → guided** rework (sv2-s7/s8.5) — unused canvases, template helpers, layout code
- **L-WRAP de-dup** was reverted (see the storybook L-WRAP follow-up note) — check nothing orphaned remains
- **s9.0a multi-photo firsts UX** was **Dropped** — confirm no partial implementation shipped
- pr9's confirmation replaced nothing, but check `UpgradeConfirm` vs `PrintOrderConfirm` for copy-paste leftovers

### Ordinary sweep
- Unused exports in `Frontend/src/lib/` and `components/storybook/`
- Backend service methods with no caller; DTO fields never read
- Unreferenced assets added during the branch

## Method
```bash
git diff --name-only 6ab07b0..HEAD -- Backend/src Frontend/src
# for a suspected-dead symbol:
grep -rn "SymbolName" Backend/src Frontend/src --include=*.java --include=*.jsx
```
Frontend dead exports are easiest caught by grepping each `export` in changed `lib/` files for a second usage.

## Done when
- [ ] Every changed file in scope has been looked at for dead code.
- [ ] **Every route under a `permitAll` namespace is accounted for** (this is the ⛔ check).
- [ ] Findings appended to `findings.md` under Pass r1, numbered continuously, each labelled.
- [ ] Running tally updated.

## Not this pass
Duplication (r2) · missing tests (r3) · stale docs (r4) · correctness/security beyond dead routes (r5).
