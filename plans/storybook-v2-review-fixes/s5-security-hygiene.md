# s5 — Security hygiene (F5, F15, F14)

**Status:** Not started · **Tier:** 2 (eventually) · **Independent:** yes
**Findings:** `plans/storybook-v2-review/findings.md` → **F5, F15, F14**

> ⚠ **Do this after the deploy has settled, never before.** F5 touches money paths (checkout, share unlock).
> None of it is exploitable today — this is defense-in-depth so the *next* change can't open a hole.

## F5 — consolidate the 4× book-ownership IDOR check
The identical ownership SQL (`SELECT COUNT(*) FROM books b JOIN baby_profiles bp ON b.baby_profile_id = bp.id
WHERE b.id = ? AND bp.user_id = ?`) is copied into four services, with **three identically-named**
`BookNotAccessibleException` classes:
- `book/BookShareService.java:80` · `print/PrintRenderService.java:87` · `print/PrintInteriorService.java:91`
  · `billing/BillingService.java:114 (userOwnsBook, returns boolean)`

This is *the* IDOR boundary for the whole book surface (`books` has no `user_id`). Extract one `BookOwnership`
helper exposing `require(userId, bookId)` (throws) and `isOwned(userId, bookId)` (boolean), with a **single**
`BookNotAccessibleException`. Repoint all four callers. Mechanical; verified non-divergent today, so behaviour
must not change — the existing tests (e.g. `PrintOrderServiceTest`'s not-owned case) should still pass untouched.

## F15 — put the owner scope in the share-token SQL (do this with F5)
`BookShareService.java:60` (`SELECT token ... WHERE book_id = ?`) and `:71` (`DELETE ... WHERE book_id = ?`)
scope by `book_id` **only** — correct today because `requireOwnedBook` runs two lines above, but it's the
pre-check shape the review warns about and the only new query that deviates. Fold the owner scope into the SQL
(`JOIN books b ... JOIN baby_profiles bp ... WHERE t.book_id = ? AND bp.user_id = ?`) so the statement is safe
standalone. Natural to do alongside the F5 helper.

## F14 — stop returning raw exception text in 500 bodies
~12 controller `catch (Exception e)` blocks pass `e.getMessage()` straight into the 500 body (incl.
`PublicBookController.java:33`, which is **unauthenticated**; also `BillingController:43`, `BookController`,
`PrintController:120`, `UploadController:36`, `AdminController:43`). That message can be raw Stripe/Cloudinary/
Lulu/JDBC text. The global `@RestControllerAdvice` (`ApiExceptionHandler.java:61`) already does this right —
flat `"An unexpected error occurred"`. Make the per-controller terminal handlers match: **log `e` server-side,
return a generic message.** Keep every mapped error (`notFound`/`conflict`/`badRequest`) exactly as-is.

## Done when
- [ ] One ownership helper + one exception; four callers repointed; `./gradlew test` green with no test edits.
- [ ] Share-token read/delete carry `user_id` in the WHERE clause.
- [ ] Terminal 500 handlers return generic text; mapped errors unchanged.

## Not this session
Rewriting the mapped-error semantics · the permitAll test (s3) · dead code (s4).
