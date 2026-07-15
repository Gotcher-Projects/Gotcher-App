# Share s13a — Token backend

**Status:** Complete (verified 2026-07-14) — V48 applied via Flyway (`success=t`); POST/GET/DELETE
`/books/{bookId}/share` exercised live against locked/unlocked/non-owned books (402 gate, regenerate
keeps the unlock, 404 IDOR, idempotent revoke all confirmed). Token util: inline `SecureRandom` +
URL-safe base64 in `BookShareService.generateToken()` (no shared util — s13b reads by token, doesn't mint).
**Est:** ~1.5–2h · **Depends on:** Payments P1 (V47 gave `books.share_unlocked_at`) ✅ · **Blocks:** s13b, s13c
**Launch prompt:** `session-prompts.md` → s13a
**Read first:** `../sv2-s13-share-link.md` (canonical spec) → "Schema" + "Share section" endpoint notes

The revocable share **token** and its management endpoints. Backend only — no UI, no public read path (that's
s13b). The **entitlement** (`books.share_unlocked_at`) already exists and is set by the Payments webhook; this
session never writes it.

---

## What you're actually doing, in one paragraph

A book that's been paid for (`share_unlocked_at` set) needs a revocable secret in its public URL. This session
adds the `book_share_tokens` table (re-keyed to `book_id`) and three JWT-protected endpoints to mint, read, and
revoke that token — with a book-ownership check and a hard rule that you can't mint a link for a book that
hasn't been unlocked.

## API-shape decisions — LOCKED (Michael, 2026-07-12)

The load-bearing decisions (schema, endpoints, IDOR, mint-gate, no-recharge, catch-`Exception`) were already
locked above. These four settle the remaining API shape:

1. **Token format — `SecureRandom` + URL-safe base64 (~43 chars).** `new SecureRandom()` → 32 random bytes →
   `Base64.getUrlEncoder().withoutPadding().encodeToString(...)`. Higher entropy than the UUID-hex idiom used by
   `email_verification_tokens`; fits `VARCHAR(64)`. Yes, this is a *second* token idiom in the codebase — that's
   the accepted tradeoff. (Do **not** copy the UUID-hex util here.)
2. **Locked-book mint → `402 Payment Required`.** `POST` on an owned-but-not-unlocked book returns **402** with a
   mapped `ApiError` (e.g. `{ error: "Purchase required" }`). Distinct from the **404** IDOR case (book not owned).
   The s13c frontend gates on the unlock flag and won't normally hit this, but the backend enforces it regardless.
3. **Missing-token behavior — soft / idempotent.** `GET` with no token → **200 `{ token: null, shareUrl: null }`**
   (not 404). `DELETE` with no token → **204 No Content** (revoke is idempotent). No not-found error for the
   frontend to special-case.
4. **Response body includes `shareUrl`.** `POST` and `GET` return **`{ token, shareUrl }`**, where
   `shareUrl = frontendUrl + "/book/" + token`. **Reuse the existing `app.frontend-url` config** (env
   `FRONTEND_URL`, default `http://localhost:3000`) — inject it via `@Value("${app.frontend-url}")` exactly as
   `PasswordResetService`/`BillingService` do. No new config. This yields `http://localhost:3000/book/{token}`
   locally and `https://cradlehq.app/book/{token}` in prod automatically. `token: null` → `shareUrl: null`.

## Schema — V48 (re-key `book_share_tokens`)

⚠️ **Migration is V48.** Max today is V47 (`add_stripe_billing`); confirm with `ls Backend/db/migration/`.

V25 created `book_share_tokens` keyed on **`baby_profile_id` UNIQUE** — one token per *baby*, written before
`books` existed (V42). It **cannot express a per-book token.** No code references it and it holds no data, so
**drop and recreate** — clean break, no data migration:

```sql
DROP TABLE IF EXISTS book_share_tokens;
CREATE TABLE book_share_tokens (
  id         BIGSERIAL PRIMARY KEY,
  book_id    BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE UNIQUE,  -- one active token per BOOK
  token      VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`UNIQUE(book_id)` = one active token per book; "regenerate" is an upsert (replace the row). `token UNIQUE` +
its own index makes the public lookup in s13b fast. **Do not** add `share_unlocked_at` here — it lives on
`books` (V47); the two are deliberately separate (entitlement vs. revocable secret).

## Endpoints — `/books/{bookId}/share` (JWT-protected)

Book-scoped, not account/baby-scoped (a parent with two books needs a token per book). Do **not** resurrect the
deleted `/storybook/share` shape.

| Method | Path | Does |
|---|---|---|
| `POST` | `/books/{bookId}/share` | Mint (or regenerate) the token; return `{ token, shareUrl }`. 402 if book not unlocked. |
| `GET`  | `/books/{bookId}/share` | Return `{ token, shareUrl }`, or `{ token: null, shareUrl: null }` (200) if none. |
| `DELETE` | `/books/{bookId}/share` | Revoke (delete the row); 204, idempotent (204 even if no token existed). |

### ⚠️ Ownership (IDOR) — the same trap as billing
`books` has **no `user_id`**; ownership is `books.baby_profile_id → baby_profiles.user_id`, a two-hop join.
**Reuse the exact pattern in `BillingService.userOwnsBook(userId, bookId)`** (added in Payments P2). Every one of
the three endpoints must verify it, returning **404** (not 403) for a book the caller doesn't own — don't
confirm the book exists.

### ⚠️ Mint requires an unlocked book (decided 2026-07-12)
`POST` must reject unless `books.share_unlocked_at IS NOT NULL` — you can't share a book that wasn't paid for.
Return **402 Payment Required** (mapped `ApiError`) — distinct from the 404 IDOR case. The locked state is
handled by the s13c **upsell**, never by minting a link. (`GET`/`DELETE` on a locked book simply have nothing to
return/delete.)

### Token generation & regenerate
- **`SecureRandom` + URL-safe base64, ~43 chars** (32 random bytes →
  `Base64.getUrlEncoder().withoutPadding()`). Decided 2026-07-12 — deliberately **not** the UUID-hex idiom the
  auth tokens use; higher entropy, still fits `VARCHAR(64)`.
- "Regenerate" = mint over the top (the `UNIQUE(book_id)` upsert). It **must not touch `share_unlocked_at`** —
  the parent paid once; a new link never re-charges. This is the whole reason entitlement and token are
  separate columns.

### ⚠️ Controller hygiene
Catch `Exception` (not just `IOException`) and return a mapped `ApiError` — an uncaught `RuntimeException`
re-dispatches to `/error` and surfaces as a **401, not 500** (CLAUDE.md).

## Done when

- [ ] V48 applies; `book_share_tokens` is keyed on `book_id UNIQUE`; app boots; `./gradlew test` green.
- [ ] Owner can mint → get → revoke a token for an **unlocked** book.
- [ ] Minting on a **locked** book is rejected (4xx), not silently allowed.
- [ ] A **non-owner** gets 404 on all three verbs.
- [ ] Regenerate returns a **new** token and leaves `books.share_unlocked_at` unchanged.

## Not this session

The public read endpoint + renderer (s13b) · the StorybookTab UI (s13c) · anything about checkout/unlock
(already done in Payments P2/P3).

## Closing note

Record the actual duration. Note the token util you reused, so s13b/s13c don't re-hunt it.
