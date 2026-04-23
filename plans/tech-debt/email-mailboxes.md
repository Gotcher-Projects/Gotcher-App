# Tech Debt: Email Mailbox Setup

**Status:** Not started

## Context
Password reset (S2) uses `noreply@cradlehq.app` as the From address — Resend can send from this without a real inbox once the domain is verified. However, two real mailboxes should be set up eventually.

## Mailboxes needed

### 1. `privacy@cradlehq.app`
Required for GDPR/privacy policy contact address. Currently listed in the privacy policy but the inbox doesn't exist.

### 2. `noreply@cradlehq.app` (reply handling)
Currently bounces any replies. Low priority — users clicking reply on a password reset email is expected to fail gracefully.

## Recommended approach
**Cloudflare Email Routing** (free) — forwards `privacy@cradlehq.app` to michaelgotcher7@gmail.com. No Google Workspace needed.

Steps:
1. In Cloudflare dashboard → Email → Email Routing → Add address
2. Forward `privacy@cradlehq.app` → `michaelgotcher7@gmail.com`
3. Cloudflare adds the required MX + SPF records automatically

## Priority
- `privacy@cradlehq.app` — medium (legal/compliance exposure)
- `noreply@` reply handling — low
