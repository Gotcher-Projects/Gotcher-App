# S2 — Password Reset
**Status:** Complete
**Branch:** rebrand/cradlehq (continue from S1)
**Depends on:** S1 complete, SMTP prerequisites below completed

## Prerequisites ✓ All complete (2026-04-22)

### 1. ~~Choose and configure an SMTP provider~~ ✓ Done
- Resend account created, `cradlehq.app` domain verified, API key generated
- From address: `noreply@cradlehq.app`

### 2. ~~Set env vars on the VPS~~ ✓ Done
Added to `~/gotcherapp/.env`:
```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=<resend-api-key>
SMTP_FROM=noreply@cradlehq.app
BACKEND_URL=https://cradlehq.app/api
FRONTEND_URL=https://cradlehq.app
ADMIN_SECRET=<generated>
```
Note: `BACKEND_URL` must include `/api` suffix — Caddy strips it before forwarding to the backend.

### 3. ~~Bugs fixed and deployed~~ ✓ Done
Three fix branches created and pushed (merge all into main before next session):
- `fix/smtp-from-address` — From address was `resend` (invalid), now reads from `app.smtp.from`
- `fix/email-branding` — Subject/body said "Baby Steps", now says "CradleHQ"
- `fix/docker-env-vars` — `BACKEND_URL`, `SMTP_FROM`, `ADMIN_SECRET` were missing from prod compose env whitelist

### 4. ~~Smoke test email verification~~ ✓ Done
- Verification email arrived from `noreply@cradlehq.app` with correct domain link
- Clicking the link successfully verified the account

---

## Goal
Allow users to reset their password via email link. Follows the same token pattern as email verification — no new dependencies, no React Router.

## Flow
1. User clicks "Forgot password?" on the login page
2. They enter their email — `POST /auth/forgot-password` — backend sends a reset link
3. Email contains `https://cradlehq.app?reset_token=<token>`
4. App.jsx detects `?reset_token=` on load → passes token to LoginPage
5. LoginPage shows a "set new password" form — `POST /auth/reset-password`
6. On success → token cleared from URL, login tab shown with a success banner

Always returns 200 on `forgot-password` regardless of whether the email exists — prevents user enumeration.

## Affected Files

### Backend — create
- `Backend/db/migration/V22__create_password_reset_tokens.sql`
- `Backend/src/main/java/com/gotcherapp/api/auth/PasswordResetService.java`

### Backend — edit
- `Backend/src/main/java/com/gotcherapp/api/auth/AuthController.java` — add 2 endpoints
- `Backend/src/main/java/com/gotcherapp/api/config/SecurityConfig.java` — permitAll for new endpoints

### Frontend — edit
- `Frontend/src/App.jsx` — detect `?reset_token=` param, pass to LoginPage
- `Frontend/src/components/LoginPage.jsx` — forgot view + reset view

---

## Steps

### 1. Migration — V22
`Backend/db/migration/V22__create_password_reset_tokens.sql`:
```sql
CREATE TABLE password_reset_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. PasswordResetService
`Backend/src/main/java/com/gotcherapp/api/auth/PasswordResetService.java`:

**`sendResetEmail(String email)`**
- Look up user by email (`SELECT id FROM users WHERE email = ?`)
- If not found — return silently (no exception — prevents enumeration)
- Delete any existing token for this user
- Generate UUID token (same pattern as EmailVerificationService)
- Set expiry to 1 hour (shorter than verify — reset links should be short-lived)
- Insert into `password_reset_tokens`
- Build link: `frontendUrl + "?reset_token=" + token`
- Call `emailService.send()` with subject "Reset your CradleHQ password" and body containing the link

**`resetPassword(String token, String newPassword)`** returns boolean:
- Look up token in `password_reset_tokens`
- If not found or expired → delete stale token, return false
- Hash `newPassword` with `passwordEncoder`
- `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`
- Delete the used token
- Return true

Inject: `JdbcTemplate`, `EmailService`, `PasswordEncoder`, `@Value("${app.frontend-url}")`.

### 3. AuthController — two new endpoints
Both unauthenticated (no `@AuthenticationPrincipal`).

```java
@PostMapping("/forgot-password")
public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
    try {
        passwordResetService.sendResetEmail(body.get("email"));
    } catch (Exception e) {
        log.warn("forgot-password error: {}", e.getMessage());
    }
    // Always 200 — don't reveal whether email exists
    return ResponseEntity.ok(Map.of("message", "If that email is registered, a reset link has been sent."));
}

@PostMapping("/reset-password")
public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
    boolean ok = passwordResetService.resetPassword(body.get("token"), body.get("newPassword"));
    if (!ok) return ResponseEntity.status(400).body(Map.of("error", "Invalid or expired reset link."));
    return ResponseEntity.ok(Map.of("message", "Password updated."));
}
```

Also inject `PasswordResetService` via constructor.

### 4. SecurityConfig — permitAll
Add `/auth/forgot-password` and `/auth/reset-password` to the existing `permitAll()` list.

### 5. App.jsx — detect reset_token param
In the existing `useEffect` that already reads `?email_verified=`:
- Also read `params.get('reset_token')`
- If present, store it in a new `resetToken` state (useState)
- Remove it from the URL (`window.history.replaceState`) immediately so refresh doesn't re-trigger
- Pass `resetToken` and `onResetConsumed={() => setResetToken(null)}` to `LoginPage`

### 6. LoginPage.jsx — forgot + reset views
Add a `view` state: `'login' | 'register' | 'forgot' | 'reset'`

**Forgot view** (shown when `view === 'forgot'`):
- Email input + "Send reset link" button
- `POST /auth/forgot-password` with `{ email }`
- On success (always 200): show inline message "If that email is registered, a reset link has been sent."
- "← Back to login" link

**Reset view** (shown when `resetToken` prop is truthy — override `view` to `'reset'` in an effect):
- "New password" input + "Confirm new password" input (both type="password")
- Validate passwords match client-side before submitting
- `POST /auth/reset-password` with `{ token: resetToken, newPassword }`
- On success: call `onResetConsumed()`, switch to `'login'` view, show inline success message
- On error: show "This reset link is invalid or has expired."

**Login tab** — add a small "Forgot password?" link below the password field:
```jsx
<button
  type="button"
  onClick={() => setView('forgot')}
  className="text-xs text-muted-foreground hover:underline"
>
  Forgot password?
</button>
```

---

## Definition of Done
- [ ] `POST /auth/forgot-password` returns 200 for both registered and unregistered emails
- [ ] Reset email arrives with a working link (test with real SMTP)
- [ ] Clicking the link loads the reset form
- [ ] Password is updated and user can log in with the new password
- [ ] Expired/used tokens are rejected with a clear error message
- [ ] "Forgot password?" link visible on the login tab
