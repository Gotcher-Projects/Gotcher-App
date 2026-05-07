# Session 1 — Paid User Flag
**Status:** Complete
**Branch:** `feature/storybook`
**Depends on:** nothing

## Goal
Add a `tier` column to the users table and thread it through the auth flow so the frontend
can gate storybook features. No payment processor — the tier is set manually via SQL for now.
Also add `ai_credits_remaining` and `credits_reset_at` columns so S2 can enforce credit limits
without a second migration.

## Decisions (from S0)
- Tier values: `free`, `plus`, `pro` (default `free`)
- Plus: $5/month. Pro: pricing TBD.
- Free users get **zero** AI generation credits.
- Gating style: **teaser** — free users see chapter titles but cannot generate chapters.
- AI credits are per-chapter, monthly allowance reset on billing date.

## Files to Change
| File | Change |
|------|--------|
| `Backend/db/migration/V23__add_tier_to_users.sql` | New migration — add tier + credits columns |
| `Backend/src/main/java/com/gotcherapp/api/auth/dto/UserDto.java` | Add `tier` field |
| `Backend/src/main/java/com/gotcherapp/api/auth/AuthService.java` | Read `tier` from DB, populate UserDto in login/register/refresh |
| `Backend/src/main/java/com/gotcherapp/api/auth/AuthController.java` | Update `/auth/me` to return full UserDto with tier |
| `Frontend/src/lib/auth.js` | Include `tier` in the stored session user object |
| `Frontend/src/components/CradleHq.jsx` | Replace `isPaid` with `tier` in user state; pass where needed |
| `Frontend/src/components/ui/PaidGate.jsx` | New component — teaser/upgrade UI for free users |

## Key Decisions

### Migration
```sql
ALTER TABLE users ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN ai_credits_remaining INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN credits_reset_at TIMESTAMPTZ;
```
No data backfill needed — everyone starts as `free` with 0 credits.

### Actual DTO structure (read the code before editing)
The existing auth layer does NOT have separate MeResponse/LoginResponse/RegisterResponse files.
The actual structure is:
- `AuthResponse.java` — holds `accessToken`, `refreshToken`, and `user` (a `UserDto`)
- `UserDto.java` — holds `id`, `email`, `display_name`, `email_verified` — this is the file to update
- `/auth/me` currently returns a raw `Map.of("user", Map.of("userId", ..., "email", ...))` — update
  this to return a full `UserDto` by querying the users table for the principal's id

Add to `UserDto`:
```java
@JsonProperty("tier") String tier
```
Match the existing `@JsonProperty` snake_case pattern — do NOT rely on Jackson's default camelCase serialization since the other fields explicitly annotate.

### AuthService changes
- `login()`: add `tier` to the `SELECT` query, pass to `UserDto` constructor
- `register()`: new user is always `free` — pass `"free"` directly to `UserDto` (no need to query it back)
- `refresh()`: add `tier` to the user SELECT query, pass to `UserDto`

### /auth/me update
Currently returns a minimal Map. Update to return `{ "user": UserDto }` by querying:
```sql
SELECT id, email, display_name, email_verified, tier FROM users WHERE id = ?
```
Using the `userId` from the `AuthPrincipal`. This gives the frontend a consistent shape across all auth endpoints.

### Frontend user state
`auth.js` stores the user object in localStorage. Add `tier` to whatever shape is stored
so it persists across page refreshes. Defensive default: `user.tier ?? 'free'` anywhere it's
read, so older stored sessions without the field don't crash.

### PaidGate component
Teaser gating — free users see *something*, not a blank wall:
```jsx
// Usage: <PaidGate tier={tier}><StorybookTab /></PaidGate>
export default function PaidGate({ tier, children, feature = "this feature" }) {
  if (tier !== 'free') return children;
  return <UpgradePrompt feature={feature} />;
}
```
`UpgradePrompt` renders a card:
- Headline: "Unlock [feature]"
- Subtext: "Upgrade to Plus for $5/month to generate your baby's storybook chapters."
- CTA button: "Upgrade to Plus" (no-op for now — links to nowhere, just styled)
- Use existing Card + Button primitives. Should look intentional, not broken.

S3 will use PaidGate at the chapter level (per Generate button), not as a full-tab wrapper,
to achieve the teaser effect. S1 just needs the component to exist and accept a `tier` prop.

### Manual flip (for testing and early users)
```sql
UPDATE users SET tier = 'plus', ai_credits_remaining = 20 WHERE email = 'someone@example.com';
```

### Future payment hook
When Stripe lands (payments plan), the webhook handler runs:
```sql
UPDATE users SET tier = 'plus', ai_credits_remaining = 5, credits_reset_at = NOW() + INTERVAL '1 month'
WHERE id = ?;
```
No schema changes needed.

## Verification
- [ ] V23 migration applies cleanly (`tier`, `ai_credits_remaining`, `credits_reset_at` on users)
- [ ] `GET /auth/me` returns `tier` field in the user object
- [ ] Login and register responses include `tier` field
- [ ] `tier` persists in localStorage after login (check dev tools)
- [ ] Page refresh does not lose tier state
- [ ] `PaidGate` renders children when `tier` is `plus` or `pro`
- [ ] `PaidGate` renders upgrade prompt when `tier` is `free`
- [ ] Upgrade prompt copy mentions "Plus" and "$5/month"
- [ ] Manually setting `tier = 'plus'` in DB + re-logging in shows gated content
- [ ] No errors in console from missing `tier` field on older stored sessions
