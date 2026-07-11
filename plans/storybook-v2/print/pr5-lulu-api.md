# Print pr5 — Lulu API: OAuth + upload + print job

**Status:** Not started
**Est:** ~2 hours · **Depends on:** pr3, pr4, **pr0** (credentials) · **Blocks:** pr6, pr7
**Launch prompt:** `session-prompts.md` → pr5
**Read first:** `lulu-spec-handoff.md` (auth, print job) + Lulu API docs (api.lulu.com/docs)

The Lulu client: authenticate, upload the interior + cover, and submit a **paid** print job — all against
the **sandbox** first.

---

## What you're building

`com.gotcherapp.api.print` (or similar): a Lulu client + service.
1. **OAuth** — client-credentials grant against `LULU_API_BASE` with `LULU_CLIENT_ID`/`SECRET`; cache the
   token to its lifetime.
2. **Provide the files** — Lulu takes interior + cover (via URL it fetches, or upload, per current API).
   Interior + cover come from pr3/pr4.
3. **Create the print job** — POST with `pod_package_id` (`LULU_POD_PACKAGE_ID`), page count, quantity, and
   shipping address; this is a **paid** job (external checkout — Lulu auto-charges the company card on file).
   The customer already paid us via Stripe (pr7) before we submit.

## ⚠️ Notes
- **Sandbox first.** `LULU_API_BASE` points at sandbox; a separate prod base + creds swap in later (like
  Stripe test→live). Never commit secrets.
- **Order of operations:** the Stripe payment (pr7) must succeed **before** we POST the paid Lulu job — same
  "fulfil on confirmed payment" discipline as the credit webhook.
- **Print-job rejection** (below min page count, bad PDF) is a real failure path — surface it; full handling
  is a hardening concern (see `../sv2-s14`).

## Config
```
LULU_API_BASE=...        LULU_CLIENT_ID=...        LULU_CLIENT_SECRET=...        LULU_POD_PACKAGE_ID=...
```
Mirror into `application.properties`, `.env.example`, `docker-compose.prod.yml` (same pattern as Stripe in
Payments P1).

## Done when
- [ ] OAuth token obtained + cached against the sandbox.
- [ ] A print job is created in the sandbox from a real interior + cover, with quantity + address.
- [ ] Rejections surface as a handled error, not a crash.

## Not this session
The cost/shipping *estimate* (pr6) · the Stripe checkout that precedes the paid job (pr7) · the UI (pr8).
Prod credentials/cutover come later (with the Payments P12-style deploy discipline).
