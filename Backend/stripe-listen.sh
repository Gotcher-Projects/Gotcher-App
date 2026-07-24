#!/usr/bin/env sh
# Payments dev helper — run in its OWN terminal while working on payments (P3/P4).
#
# Stripe cannot reach localhost, so this opens a tunnel and forwards live events to the local webhook.
# NOT for production: in prod, Stripe POSTs directly to the Dashboard-registered public endpoint (P4),
# and this script has no role. Requires the Stripe CLI + a prior `stripe login` (done in P0).
#
# The whsec_ it prints must match STRIPE_WEBHOOK_SECRET in Backend/.env. It's stable per account, but if
# webhook signature verification ever fails "for no reason", re-check that these two match.
exec stripe listen --forward-to localhost:3001/billing/webhook
