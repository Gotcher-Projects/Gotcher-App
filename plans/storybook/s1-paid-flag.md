# Session 1 — Paid User Flag
**Status:** Not started
**Branch:** `feature/storybook`
**Depends on:** nothing

## Goal
Add a `is_paid` boolean flag to the users table and thread it through the auth flow so the
frontend can gate storybook features. No payment processor — the flag is flipped manually
via SQL for now. The design should make it easy to hook a payment webhook into later.

## Files to Change
| File | Change |
|------|--------|
| `Backend/db/migration/V23__add_is_paid_to_users.sql` | New migration — add column |
| `Backend/src/main/java/com/gotcherapp/api/auth/dto/MeResponse.java` | Add `isPaid` field |
| `Backend/src/main/java/com/gotcherapp/api/auth/dto/LoginResponse.java` | Add `isPaid` field |
| `Backend/src/main/java/com/gotcherapp/api/auth/dto/RegisterResponse.java` | Add `isPaid` field |
| `Backend/src/main/java/com/gotcherapp/api/auth/AuthService.java` | Read `is_paid` from DB, populate DTOs |
| `Frontend/src/lib/auth.js` | Include `is_paid` in stored session user object |
| `Frontend/src/components/CradleHq.jsx` | Add `isPaid` to user state; pass as prop where needed |
| `Frontend/src/components/ui/PaidGate.jsx` | New component — renders children or an upgrade prompt |

## Key Decisions

### Migration
```sql
ALTER TABLE users ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false;
```
No data backfill needed — everyone starts as free.

### DTO changes
All three auth response DTOs (`LoginResponse`, `RegisterResponse`, `MeResponse`) need an
`isPaid` boolean field. The AuthService already queries the users table for these — add
`is_paid` to the `SELECT` and map it through.

Record fields use camelCase on the Java side (`isPaid`), which Jackson serializes as
`is_paid` by default. Check the existing records — if they use `@JsonProperty` annotations,
match the pattern; if they use plain record component names, use `isPaid` and let Jackson
serialize as-is. The frontend currently reads `user.display_name` (snake_case) so check
what convention the backend actually sends before assuming.

### Frontend user state
`auth.js` stores the user object in localStorage. Add `is_paid` to whatever shape is already
stored so it persists across page refreshes without an extra API call.

### PaidGate component
```jsx
// Usage: <PaidGate isPaid={isPaid}><StorybookTab /></PaidGate>
export default function PaidGate({ isPaid, children }) {
  if (isPaid) return children;
  return <UpgradePrompt />;
}
```
`UpgradePrompt` is a placeholder card for now: "Unlock the Storybook — coming soon."
It should look intentional, not broken. Use the existing card + button primitives.

### Manual flip (for testing and early users)
```sql
UPDATE users SET is_paid = true WHERE email = 'someone@example.com';
```
Document this in the plan. No admin UI needed yet.

### Future payment hook
When Stripe (or similar) is added, the webhook handler just runs:
`UPDATE users SET is_paid = true WHERE id = ?`
No schema changes needed.

## Verification
- [ ] `GET /auth/me` response includes `is_paid` field
- [ ] Login and register responses include `is_paid` field
- [ ] `is_paid` persists in localStorage after login (check dev tools)
- [ ] Page refresh does not lose the paid state
- [ ] `PaidGate` renders children when `isPaid = true`
- [ ] `PaidGate` renders upgrade prompt when `isPaid = false`
- [ ] Manually flipping `is_paid = true` in DB + re-logging in shows gated content
- [ ] No TypeErrors in console from missing field on older stored sessions (handle gracefully)
