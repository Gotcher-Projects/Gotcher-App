# Payments P4 — Webhook hardening + deploy surface

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** P3 · **Blocks:** nothing directly (but P8's success screen assumes a real webhook lands)
**Launch prompt:** `session-prompts.md` → P4
**Read first:** `stripe-primer.md` §4, §8

P3 proved the webhook works against the CLI on your laptop. P4 proves it survives **production**: real card
flows in the sandbox, the decline and 3-D Secure paths, Caddy passing the signature header through intact,
and the **production** webhook endpoint registered (which gets a *different* `whsec_` than the CLI's).

---

## What you're actually doing, in one paragraph

Two things break a webhook in production that never show up on localhost: a reverse proxy that mangles the
signature header, and using the CLI's `whsec_` where the production endpoint's `whsec_` belongs. This
session exercises the real card paths end-to-end in the sandbox, then wires the production surface so that
when P12 flips to live keys, the plumbing is already proven.

---

## Steps

1. **Real end-to-end in the sandbox.** `4242 4242 4242 4242` → success → confirm credits land **via the
   webhook**, not the redirect. Watch the event in `stripe listen` and the dashboard event log.
2. **Decline path.** `4000 0000 0000 9995` → no grant, no crash, sane logging.
3. **3-D Secure path.** `4000 0025 0000 3155` → forces a challenge and **changes redirect timing**.
   Exercise it once so P8's polling assumptions are grounded in reality.
4. **⚠️ Caddy must proxy `/billing/webhook` to `:3001` with the `Stripe-Signature` header INTACT.** A proxy
   that rewrites or drops headers produces the **same silent verification failure** as body-parsing in P3.
   Verify the header arrives unmodified.
5. **⚠️ Register the production endpoint** in the Stripe Dashboard (Developers → Webhooks). It gets a
   **completely different `whsec_`** than the CLI printed. They are not interchangeable; the wrong one
   fails signature verification with no error that names the cause. Put the prod `whsec_` in the VPS
   secrets, not the CLI one.
6. **Ledger tests.** Add/confirm tests around: replay (same event twice), unknown event type
   (ignore-and-200), malformed/invalid signature (4xx).

**Deploy to prod with TEST keys** and confirm a real webhook lands from Stripe → the ledger records it →
credits move. This is a test-mode deploy; live keys are P12.

## Done when

- [ ] `4242` success grants via webhook in the sandbox, end-to-end, through the deployed prod surface.
- [ ] Decline and 3-D Secure paths both behave (no grant / correct grant, no crash).
- [ ] Caddy passes `Stripe-Signature` through unmodified; a real Stripe-sent event verifies.
- [ ] The **production** webhook endpoint is registered and its `whsec_` (not the CLI's) is in prod secrets.
- [ ] Ledger tests (replay, unknown type, bad signature) are green.

## Not this session

Live-mode keys / live price ids (P12 — a separate universe) · the frontend success screen (P8) · the Radar
rule (P5). This is still **test mode**, just deployed and proven on real infrastructure.

## Closing note

Record the actual duration. Note especially whether the Caddy/prod-webhook wiring was trivial or fiddly —
that's the part with no localhost analogue, and it feeds the P0.5/re-slice calibration.
