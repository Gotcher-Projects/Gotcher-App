# r5 — General improvements (correctness · security · structure)

**Status:** ✅ **Done 2026-07-22** (by hand) — findings **F13–F15**, all 📋 DEFERRED, **0 ⛔**.
**The permitAll table is filled in with no blanks** (all 8 routes self-authorize) and **every destructive
migration targets a table created after V22**, so none can touch production data — both verified, not assumed.
IDOR, 401-trap, secrets, webhook idempotency and sweep resilience all clean. **F13 (shared `RestTemplate` has
no timeouts) is worth fixing pre-deploy — 2 lines.** See `findings.md` → Pass r5 for the full tables.
· **Est:** ~1.5h · **Independent:** yes
**Read first:** `README.md` (scope `6ab07b0..HEAD`, triage rules, findings format)

**The highest-value pass**, because this branch is the first code that moves real money and ships physical
goods to real addresses. Append findings under **Pass r5**.

> This is the pass where ⛔ labels actually belong. Be willing to use them — a launch delayed by a day is
> cheaper than a stranded paying customer or a leaked shipping address.
>
> ⚠ **Do this by hand even if `/code-review ultra` has run.** An automated pass is good at the mechanical
> checks below; it is weaker on "is this namespace self-authorizing?", which is the trap this codebase has
> fallen into twice.

---

## 1. ⛔ The `permitAll` trap — audit every route in those namespaces

`SecurityConfig` permits: `/health`, `/auth/register|login|refresh|logout|verify-email|forgot-password|reset-password`,
`/admin/**`, `/book/public/**`, `/print/**`, `/billing/webhook`. Everything else is
`anyRequest().authenticated()`.

**Every route under a permitted namespace must authorize itself.** We hit this twice:
- pr9's order lookup — moved to `/books/{bookId}/print/order` so the JWT applies.
- s14c's order list — placed at top-level `/print-orders`, deliberately NOT `/print/orders`.

For each route in those namespaces, name its authorization mechanism explicitly:
| route | authorizes via |
|---|---|
| `/print/payload/{token}`, `/print/pdf/{token}` | opaque/JWT token in the path |
| `/print/lulu-webhook` | HMAC-SHA256 over the raw body |
| `/billing/webhook` | Stripe signature |
| `/admin/**` | `X-Admin-Secret`, refuses when the secret is blank |
| `/book/public/{token}` | share token + content-visibility rules |
**Anything you cannot fill in is a ⛔.**

## 2. IDOR boundaries
Owner scoping must be **in the WHERE clause**, not a pre-check that a later query ignores. Pattern to match:
`PrintInteriorService.requireOwnedBook`, and pr9's `WHERE stripe_session_id = ? AND user_id = ? AND book_id = ?`.
Check every new query that returns user data — books, chapters, photos, orders, share tokens, family members,
birth details, bump photos.

## 3. The Spring 401 trap
An uncaught `RuntimeException` in a controller re-dispatches to `/error` **unauthenticated** and surfaces as
**401, not 500**. Every controller calling an external service (Cloudinary, Claude, Stripe, Lulu) must
`catch (Exception)` and return a mapped `ApiError`. Check the newest controllers especially.

## 4. Secrets
- No key / token / HMAC material in logs, error bodies, or API responses.
- `failure_reason` holds raw vendor text — confirm it never reaches a customer-facing payload (s14c
  deliberately omits it from the DTO; verify nothing else exposes it).
- A `sk_test` key was once printed to a terminal by a faulty masking regex in a helper script — check the
  committed scripts (`lulu-*.sh`, `stripe-listen.sh`) don't do anything similar.

## 5. Money-path correctness
- **Idempotency on every webhook branch.** Stripe *will* redeliver. Each branch must be a no-op the second time:
  the ledger's `ON CONFLICT DO NOTHING`, the `pending→paid` claim, `refund_event_id`, the `*_notified_at` guards.
- **No path that can double-charge, double-grant, or double-submit a print job** (the last one prints and ships
  two physical books).
- Amounts are always **recomputed server-side** — never trusted from the client.
- Currency/rounding consistent between quote, charge and display.

## 6. Migrations V37–V53
Re-verify the destructive ones only touch tables created earlier in the same run:
`V42` (`TRUNCATE storybook_chapters`, 3× `DROP COLUMN`), `V43` (`DELETE`), `V45` (`DROP COLUMN`),
`V48` (`DROP TABLE`). **DEPLOY-0's rehearsal on restored prod data is the real proof** — this pass is a
second pair of eyes on the SQL, not a substitute for it.

## 7. Structure / resilience
- Scheduled work (`PrintOrderStatusService.reconcile`, `PrintPdfStore.sweepExpired`) — one bad row must not
  abort the pass; failures logged not swallowed silently.
- External calls have timeouts (`LuluClient` sets 10s/30s — check others).
- Nothing that emails or calls out holds a DB transaction open.

## Done when
- [ ] The permitAll table above is filled in completely, with no blanks.
- [ ] Every new user-data query checked for `user_id` in the WHERE clause.
- [ ] Every webhook branch confirmed idempotent.
- [ ] Findings appended under Pass r5, numbered continuously, labelled; tally updated.

## Not this pass
Fixing what you find — unless it's ⛔, in which case fix it before DEPLOY-0 (or record Michael's explicit
downgrade and the reason). Dead code (r1) · duplication (r2) · tests (r3) · docs (r4).
