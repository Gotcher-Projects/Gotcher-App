# s4 — Atomic Credits + Controller Error Handling

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** s2
**Source:** `branch-review.html` → Pass 5 (P2 credits race; P2 error handling)

> **Implemented 2026-06-20.**
> - **Atomic credits:** `generatePages` now charges via a single conditional
>   `UPDATE … SET ai_credits_remaining = ai_credits_remaining - ? WHERE id = ? AND ai_credits_remaining >= ?`;
>   0 rows affected → `InsufficientCreditsException`. Removed the read-then-check TOCTOU and the unused
>   `credits`/`ai_credits_remaining` read (now `SELECT tier` only). Refund-on-failure unchanged.
> - **Global error advice (chosen over narrow per-method wrap):** new `common/ApiExceptionHandler`
>   (`@RestControllerAdvice`) maps Forbidden→403, InsufficientCredits→402, NoSuchElement→404,
>   IllegalArgument & HttpMessageNotReadable→400, and a catch-all Exception→500 that **logs the detail
>   server-side and returns a generic message** (no internal leak). Additive: existing per-method
>   try/catch is untouched and still wins; advice only catches what escapes — which kills the
>   401-instead-of-500 trap for `getAll`/`reorder` and every other controller at once. Custom
>   exceptions left nested in `StorybookService` (advice imports them).
> - **Tests:** `generatePages_throwsInsufficientCredits_whenAtomicChargeAffectsZeroRows`;
>   `ApiExceptionHandlerTest` (6 mappings incl. the no-leak assertion); updated the s3 scoping test to
>   stub the atomic charge. **`./gradlew test` green: 204 passed, 0 failures.**
> Awaiting Michael's manual check: generating with insufficient credits returns 402 (not negative),
> and a forced server error returns 500 (not 401).

---

## Goal
Two backend robustness fixes: make AI-credit spending race-safe, and stop uncaught exceptions from
surfacing as misleading 401s.

## Scope
### Atomic credit decrement
- `generatePages` currently checks `credits < totalEntries` then decrements in a separate statement
  (TOCTOU — concurrent calls can overspend / go negative).
- Replace with a single conditional update:
  `UPDATE users SET ai_credits_remaining = ai_credits_remaining - ? WHERE id = ? AND ai_credits_remaining >= ?`
  and treat a 0-row result as `InsufficientCreditsException`.
- Keep the existing refund-on-failure logic; ensure it still pairs correctly with the new path.

### Controller error handling
- `StorybookController.reorder` and `getAll` have no try/catch → an uncaught `RuntimeException`
  re-dispatches to `/error` unauthenticated and surfaces as **401 not 500** (project-wide gotcha).
- Preferred: add a `@RestControllerAdvice` mapping common exceptions to `ApiError` statuses
  (`ForbiddenException`→403, `InsufficientCreditsException`→402, `NoSuchElementException`→404,
  `IllegalArgumentException`→400, else 500) so per-method try/catch can be simplified over time.
  Minimum: wrap the two unguarded methods.

## Tests
- Credit update: when balance < cost, the conditional update affects 0 rows → `InsufficientCredits`;
  when sufficient, balance decremented exactly once.
- Advice: each exception type maps to the expected HTTP status (can live in s6 controller tests).

## Files
- `Backend/.../storybook/StorybookService.java`
- `Backend/.../storybook/StorybookController.java`
- `Backend/.../common/` (new `@RestControllerAdvice`, if taken)

## Verification
1. `./gradlew test` green.
2. Manual: generating with insufficient credits returns 402 and does not go negative.
