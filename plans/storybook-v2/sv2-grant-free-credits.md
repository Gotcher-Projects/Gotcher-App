# SV2-GRANT — Free signup credits, capped at the first N users

**Status: ✅ **Complete** (implemented 2026-07-09).** Backend built, full `./gradlew test` green.
**Not yet run against a live Postgres** — Docker was down, so V46 has never been applied and the
`UPDATE … RETURNING` has never actually parsed. Do the §Verification steps before calling this Complete.
**Est:** ~0.5 session · **Blocked on:** nothing · **Run before:** Payments S2

Backend-only. No frontend work, no Stripe. This is session #1 of the remaining paid-bundle queue
(see the session map in `sv2-s9.6-paid-bundle-plan-reconcile.md`).

---

## Goal

Give the **first N signups 5 AI credits** so a new user can actually *try* the ✨ "write this for me"
button before being asked to buy credits. Then stop granting.

**Why it exists.** `AuthService.register()` inserts only `email, password_hash, display_name`, so V23's
`ai_credits_remaining DEFAULT 0` applies. Today every new user sees ✨ on every field, clicks it, and is
told they have no credits — having never seen the feature work. Nobody buys a consumable they haven't
tried.

**Why it's capped.** Bounds the spend, and lets us watch how fast real users exhaust 5 credits *before*
committing to the pack sizes in Payments S2. Cost ceiling: 500 × 5 × $0.007 worst case ≈ **$17.50 total**.

**Decisions carried in** (Michael, 2026-07-09, recorded in `sv2-s9.6` §Free signup grant):
- Grant size **5 credits**; cap `N` defaults to **500**.
- Both are **env-driven** (`FREE_GRANT_LIMIT`, `FREE_GRANT_SIZE` → `application.properties`) so tuning
  them is never a migration.
- **Grant fires at signup**, not at email verification (decision 2026-07-09). See §Known gap.

---

## The two traps — get these right

### 1. Do NOT derive the counter from credit balances

`count(*) WHERE ai_credits_remaining > 0` drops a user the moment they spend their last credit, so the
cap leaks: grant #501 fires as soon as user #3 runs dry. Record *having been granted*, independent of
the balance. The column doubles as the once-per-user idempotency guard.

```sql
-- V46__add_free_grant_at.sql
ALTER TABLE users ADD COLUMN free_grant_at TIMESTAMPTZ;  -- null = never granted
```

Latest migration on disk is **V45** (`V45__drop_family_is_step.sql`), verified 2026-07-09 — confirm
before writing, someone may have landed one since.

### 2. Read-count-then-insert is a TOCTOU race

Two concurrent signups both read 499 and both grant. Decide inside **one statement** and let the DB
arbitrate — same shape as the Stripe webhook ledger will use.

> **Corrected during implementation (2026-07-09).** The single statement does **not** fully close the
> race, and the original wording overclaimed. Under `READ COMMITTED` the `count(*)` subquery reads the
> statement's snapshot, and concurrent signups write *different* rows, so nothing serializes them: two
> in-flight registrations can both see `limit - 1` and both grant. Overshoot is bounded by the number of
> concurrent signups. Closing it properly needs `SERIALIZABLE`, an advisory lock, or a single counter row
> taken `FOR UPDATE` — none of which are worth it for a soft ~$17.50 spend ceiling.
>
> What the statement **does** guarantee is the part that matters: `free_grant_at IS NULL` is evaluated
> against the row Postgres locks, so **a user can never be granted twice**. Keep the single-statement
> shape for that, not for the cap.

```sql
UPDATE users
   SET ai_credits_remaining = ai_credits_remaining + :grantSize,
       free_grant_at = NOW()
 WHERE id = :userId
   AND free_grant_at IS NULL
   AND (SELECT count(*) FROM users WHERE free_grant_at IS NOT NULL) < :limit
RETURNING ai_credits_remaining;
```

Zero rows affected → cap reached, or already granted. **Either way: no grant, no error.** A user who
signs up as #501 gets a normal account with 0 credits, not a failure.

### 3. `register()` hardcodes the credit balance in its response

`AuthService.register()` currently returns `new UserDto(userId, email, displayName, false, "free", 0)`
— the `0` is a literal. Grant the credits and the DB is correct, but **the client still shows 0 until
the next `/auth/me`**, so the new user's first impression is the exact broken state this session exists
to fix. Carry the granted balance out of the `UPDATE ... RETURNING` and into the `UserDto`.

Note `tier` is also a hardcoded `"free"` there. `users.tier` is **vestigial** — nothing reads it
(`sv2-s9.6` decision 1). Leave it alone; don't build on it, don't clean it up here.

---

## Work

1. **Migration** `Backend/db/migration/V46__add_free_grant_at.sql` — the `ALTER TABLE` above.
2. **Config** — `free-grant.limit` and `free-grant.size` in `application.properties`, bound from
   `FREE_GRANT_LIMIT` (default `500`) and `FREE_GRANT_SIZE` (default `5`). Add both to the prod compose
   env so tuning doesn't need a rebuild.
3. **`AuthService.register()`** — after the user INSERT succeeds, run the single-statement conditional
   `UPDATE`. Use the returned balance in the `UserDto`; on zero rows, use `0`.

### Ordering / failure semantics

The grant runs **after** the user row exists and **must not** fail the signup. A user created but not
granted is fine and self-consistent (`free_grant_at IS NULL` reads as "never granted"). Wrap it so a
grant failure logs and falls through to a 0-credit account — mirror the existing
`sendVerificationEmail` try/catch a few lines below, which already takes exactly this stance.

Do **not** put the grant in its own transaction that can roll back the user insert.

---

## Tests (`AuthServiceTest`, Mockito + JdbcTemplate mocks)

- Signup **under** the cap → balance is 5, `free_grant_at` set, and the **`AuthResponse` carries 5** (not 0).
- Signup **at/over** the cap → account created, balance 0, no error thrown.
- **Re-grant is impossible**: a user with `free_grant_at` already set is not granted again (the
  `AND free_grant_at IS NULL` arm). Exercise this even though `register()` can't hit it today — it's the
  idempotency guard, and a future "grant on verify" move would lean on it.
- Grant statement throws → signup still succeeds, response has 0 credits.

Cap-race behaviour lives in the SQL, not in Java, so a mock can't prove it. Either accept that, or assert
the *statement shape* (that the count subquery and the `free_grant_at IS NULL` predicate are both present)
rather than pretending a unit test covers the race.

---

## Verification

- [x] `cd Backend && ./gradlew test` green (2026-07-09, full suite).
- [ ] **V46 applies** — start Docker (stop TavernTales first, shared 5432), boot the API, confirm Flyway
      runs V46 and the `UPDATE … RETURNING` parses. None of this has executed yet.
- [ ] Fresh signup in-app → ✨ on a storybook field actually generates text, and the credit counter reads 4
      afterward. **Not** "the DB looks right" — drive the button.
- [ ] Set `FREE_GRANT_LIMIT=0`, restart, sign up → account works, 0 credits, no error surfaced to the client.

---

## ⚠️ Known gap this does NOT close — `email_verified` is never enforced

`AuthService` reads `email_verified` and returns it in `UserDto`, but **nothing blocks an unverified
account from logging in and calling the API** (verified 2026-07-09). So this cap is a **launch promotion,
not an abuse control**: a script with throwaway emails can drain all 500 grants before a real user
arrives. The exposure is bounded only by the cap itself (~$17.50).

**Michael's decision (2026-07-09): ship the signup grant now; fold `email_verified` enforcement into
`sv2-s14` (paid-bundle hardening), where it is already listed.** The cheap fix there is to move the grant
from signup to the verify endpoint — the cap survives the move (that's what trap #1's column buys us), it
just then counts the first N *verified* users.

Do not re-litigate this here. Build the signup grant.
