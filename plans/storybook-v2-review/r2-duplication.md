# r2 — Duplication

**Status:** ✅ **Done 2026-07-22** — findings **F5–F6**, both 📋 DEFERRED, **0 ⛔**.
No duplicate pair had **diverged** (that was the ⛔ bar). Date rule holds, `formatCents` consolidated, order
status single-sourced in `LuluJobStatusMapper`. See `findings.md` → Pass r2.
· **Est:** ~45m · **Independent:** yes
**Read first:** `README.md` (scope `6ab07b0..HEAD`, triage rules, findings format)

Find logic re-inlined where a shared helper already exists. Append findings to `findings.md` under **Pass r2**.

> **Default label for this pass is 📋 DEFERRED.** Duplication is real debt but rarely blocks a ship. It becomes
> ⛔ only when the copies have **diverged in a way that changes behaviour** — two ownership checks with
> different WHERE clauses, two price calculations that disagree, two status mappers. Look for divergence, not
> just repetition.

---

## What to look for — specific to this branch

### Frontend: the shared utils that exist to prevent this
`PhotoPickerButton` · `uploadCroppedPhoto` · `openCropModal` · `cleanBodyText` · `useCanvasScale` ·
`captureElement` · `TwemojiImage` · and in `lib/formatting.js`: `formatDate`, `formatMonthYear`, `formatCents`.
Check the branch's new components reuse these rather than re-implementing.

### ⚠ Date formatting is a hard project rule
**Every display date goes through `formatDate`/`formatMonthYear`** (noon-anchored, `en-US`). Inline
`new Date(...).toLocaleDateString(...)` is a violation, not a style preference — the noon anchoring exists to
stop off-by-one-day bugs across timezones.
```bash
grep -rn "toLocaleDateString\|toLocaleString('en-US'" Frontend/src --include=*.jsx
```

### Money formatting
`formatCents` was only shared into `lib/formatting.js` during pr9 — before that `PrintOrderModal` had a local
copy. Check nothing else still formats cents by hand, since a total that reads differently before and after
checkout is a trust problem.

### Backend: repeated SQL projections
- **`print_orders` projections** — s14c consolidated the pr9 confirmation and the s14c list into one
  `ORDER_SELECT` + row mapper precisely so they couldn't disagree. **Look for others**, especially anything
  re-selecting order columns.
- **Ownership checks** — the `requireOwnedBook` pattern (`PrintInteriorService`) vs hand-rolled
  `WHERE ... AND user_id = ?`. Repetition here is acceptable *if identical*; flag any that differ.
- **Status/enum mapping** — s14a-1 deliberately has ONE `LuluJobStatusMapper` because two feeds must never
  interpret a rejection differently. Confirm nothing re-derives order status elsewhere.

### Webhook handling
`BillingWebhookService` and `LuluWebhookService` intentionally mirror each other's shape (raw body, signature
first, 400 only for bad signature). That parallel is deliberate — **note it, don't "fix" it.** Flag only if one
has a guard the other is missing.

## Done when
- [ ] Changed frontend components checked against the shared-utils list.
- [ ] No inline date formatting introduced on this branch.
- [ ] Backend repeated projections/ownership checks reviewed, **divergences flagged specifically**.
- [ ] Findings appended under Pass r2, numbered continuously, each labelled; tally updated.

## Not this pass
Dead code (r1) · tests (r3) · docs (r4) · security/correctness (r5).
