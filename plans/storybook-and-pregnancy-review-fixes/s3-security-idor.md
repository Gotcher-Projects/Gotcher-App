# s3 — Security: Page-Generation IDOR Fix

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** s2 (touches the same service/controller)
**Source:** `branch-review.html` → Pass 5, P1 (SECURITY)
**Priority: ship-blocker**

> **Implemented 2026-06-19.** Both fixes in `StorybookService`:
> 1. **Read scoping** — `buildBatchPagesPrompt` now takes `profileId` and both `journal_entries` /
>    `first_times` reads are `WHERE baby_profile_id = ? AND id IN (…)`.
> 2. **Write boundary** — `wizard()` calls new `assertSelectionsOwned()` which `COUNT(*)`-checks each
>    submitted journal/first-time id against the caller's profile and throws
>    `IllegalArgumentException` (→ 400) if any id isn't owned.
> Audited the rest of the service: all other reads were already tenant-scoped; the two remaining
> `WHERE id = ?` queries use a freshly-derived owned `chapterId`/`profileId`.
> New `StorybookServiceTest` (4 tests): foreign journal id rejected, foreign first-time id rejected,
> owned ids create the chapter, and `generatePages` journal read is `baby_profile_id`-scoped.
> **`./gradlew test` green: 197 passed, 0 failures.** Awaiting Michael's manual check that generating
> a chapter from your own entries is unchanged.

---

## Goal
Close the cross-tenant data exposure: a user can submit another user's journal / first-time IDs and
have that content pulled into their chapter and Claude prompt.

## Root cause
- `wizard()` stores `selectedJournalIds` / `selectedFirstTimeIds` verbatim with no ownership check.
- `buildBatchPagesPrompt()` reads them with `SELECT … WHERE id IN (…)` — **no `baby_profile_id`
  filter** (StorybookService.java ~289 for journal, ~310 for first_times).

## Scope
- **Owner-scope both reads** in `buildBatchPagesPrompt`: add
  `AND baby_profile_id = ?` to the `journal_entries` and `first_times` `IN (…)` queries (the method
  already has the profile id in `generatePages`; thread it through).
- **Validate at the boundary** in `wizard()`: before storing, drop (or reject) any selected ID that
  doesn't belong to the caller's `baby_profile_id`. Prefer reject with `IllegalArgumentException`
  if you want it loud; dropping silently is acceptable if simpler — decide during the session.
- Audit the rest of `StorybookService` for any other unscoped `IN (…)` reads while here.

## Tests (write with the fix)
- `generatePages` / prompt builder: a foreign journal/first-time id is **not** included in the
  generated output (mock jdbc to return only owned rows when scoped).
- `wizard()`: submitting a foreign id is rejected/stripped.
- Owned ids still flow through unchanged (no regression).

## Files
- `Backend/.../storybook/StorybookService.java`
- `Backend/.../storybook/StorybookServiceTest.java` (new or extended — coordinate with s6)

## Verification
1. `./gradlew test` — new IDOR tests pass.
2. Manual: generating a chapter for your own entries is unchanged.
