# s7 — Small debt: formatter + docs (F6, F10, F12)

**Status:** Not started · **Tier:** 2 (eventually) · **Independent:** yes
**Findings:** `plans/storybook-v2-review/findings.md` → **F6, F10, F12**

Three cheap, unrelated hygiene items grouped so they don't each need a session. All low-risk.

## F6 — a `formatTime` helper (kill 5 inline copies)
Five copies of `new Date(...).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })`, three named
`fmtTime` locally: `DashboardTab.jsx:606` (in scope), plus `AppointmentTab.jsx:11`, `DiaperTab.jsx:51`,
`SleepTab.jsx:48`, `FeedingTab.jsx:339`. `lib/formatting.js` has `formatDate`/`formatCents` but no time helper.
Two variants exist — appointment times parse a time-only `` `1970-01-01T${t}` ``, the log tabs parse an ISO
instant — so add **two**: `formatTimeOfDay(hhmm)` and `formatTime(iso)`. Collapse all five.
> Not a date-rule violation: the noon-anchoring rule is about display *dates*; `toLocaleTimeString` on an
> instant has no timezone off-by-one trap. This is ordinary de-duplication.

## F10 — fix `CLAUDE.md`'s start command  ✅ ALREADY DONE in s2 (2026-07-22) — skip
_s2 fixed the start path (`./start-services.sh` from root) and added the port-3001 stop fallback. Verify it's
still correct and move on; nothing to do here unless it regressed._
`CLAUDE.md:18` says `cd Backend && ./start-services.sh`, but the script is at the **repo root** (`Backend/` has
only the `lulu-*`/`stripe-listen`/`run-migrations` scripts). Change to `./start-services.sh` from the root. Add
the stop caveat: `./stop-services.sh` doesn't reliably kill the API — document the port-3001 fallback
(`netstat -ano | findstr :3001` → `taskkill /PID <pid> /F`).
> If **s2** already ran, it may have fixed this line — check first and skip if done.

## F12 — banner on the stale deploy guide
`deployment-guide.html` (2026-07-02) predates payments/print/sidecar and documents none of the new env vars.
It's **not** a ship-blocker (every new setting has a safe blank default; DEPLOY-0 carries the real steps), but
add a banner at the top: *"For the storybook-v2 / payments / print deploy, follow
`plans/storybook-v2/sv2-deploy-0-first-prod-deploy.md` first; this guide covers the steady-state deploy only."*
Fold the new env vars + the `pdf-sidecar` service into the guide **properly after DEPLOY-0 lands**, when the
compose file actually has the sidecar.

## Done when
- [ ] `formatTimeOfDay` + `formatTime` in `lib/formatting.js`; the 5 sites use them; `npm run test` green.
- [ ] `CLAUDE.md` start/stop corrected.
- [ ] `deployment-guide.html` has the DEPLOY-0 banner.

## Not this session
Rewriting the deploy guide's body (wait for the compose file to be true) · anything touching runtime code.
