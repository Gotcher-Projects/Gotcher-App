# Payments S2 — Upgrade Flow (Frontend)
**Status:** Not started
**Branch:** `payments-s2`
**Depends on:** Payments S1

## Goal
Build the frontend upgrade experience: the PaidGate component, pricing modal/page,
Stripe checkout redirect, and subscription management link.

---

## Tasks

### 1. PaidGate component
`Frontend/src/components/ui/PaidGate.jsx`

> **Note (2026-06-19, review cleanup):** `PaidGate.jsx` previously existed as a
> finished teaser component but was **removed** in the `storybook-and-pregnancy-review-fixes`
> S1 dead-code pass because nothing imported it yet. This session **re-creates** it.
> The prior implementation is preserved below as the starting point — recover it
> verbatim from git if needed (`git log --all -- Frontend/src/components/ui/PaidGate.jsx`).

- Wraps any paid-only content
- If user tier is `free`: shows teaser UI (blurred content + upgrade prompt)
- If user tier is `plus` or `pro`: renders children normally
- Takes optional `feature` prop for copy customization ("Unlock the Storybook", etc.)

Prior implementation (pre-removal) — wire the disabled button up to the pricing modal from task 2:

```jsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PaidGate({ tier, children, feature = "this feature" }) {
  if (tier !== 'free') return children;

  return (
    <div className="flex justify-center py-8">
      <Card className="p-8 max-w-sm w-full text-center space-y-4">
        <div className="space-y-1">
          <h3 className="font-display font-semibold text-lg">Unlock {feature}</h3>
          <p className="text-muted-foreground text-sm">
            Upgrade to Plus for $5/month to generate your baby's storybook chapters and preserve every milestone as a memory.
          </p>
        </div>
        <Button className="w-full" disabled>
          Upgrade to Plus — Coming Soon
        </Button>
      </Card>
    </div>
  );
}
```

### 2. Pricing modal or page
Triggered when user taps an upgrade prompt in PaidGate.
- Shows Plus vs. Pro comparison (price, feature list)
- "Upgrade to Plus" button → calls `POST /billing/create-checkout-session` → redirects to Stripe
- Keep it simple for V1 — a modal is fine

### 3. Upgrade success/cancel handling
- `/upgrade-success` route — shown after Stripe redirects back on success
  - Calls `GET /billing/status` to confirm tier updated
  - Shows confirmation message, links back to the storybook or feature they were trying to access
- Cancel just returns user to wherever they were (Stripe cancel URL = back to pricing modal)

### 4. Subscription management link
- In account/settings: "Manage Subscription" button
- Calls `GET /billing/portal` → redirects to Stripe Billing Portal
- User can cancel, update payment method, view invoices — all handled by Stripe

### 5. Tier-aware UI
- `useAuth()` or user context should expose `user.tier`
- Nav or account indicator shows current plan (optional, but helpful for trust)

---

## Notes
- `GET /auth/me` response should include `tier` field — confirm S1 updates this endpoint
- After successful upgrade, force a refresh of the user object so tier-gated UI updates immediately
- Stripe portal redirect means we don't build cancel flows ourselves
