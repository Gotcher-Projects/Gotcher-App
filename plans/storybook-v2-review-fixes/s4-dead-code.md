# s4 — Dead code (F1, F4 · F2/F3 gated on a decision)

**Status:** Not started · **Tier:** 2 (eventually) · **Independent:** yes
**Findings:** `plans/storybook-v2-review/findings.md` → **F1, F2, F3, F4**

Dead code is debt, not a blocker — the review labelled all of these 📋. Two of them (F2, F3) are **whole
features** whose fate is a product call, not a code call, so they're gated below.

## Do unconditionally
- **F1 — delete `Frontend/src/lib/letterTypes.js`.** No importer anywhere; its documented consumers
  (`letterTypeId` seeding) never materialized. Also narrow `guidedBook.js:19 pageHasBlockContent` from `export`
  to a module-local (only used in its own file).
- **F4 — delete `LuluClient.getPrintJob(long)`** (`LuluClient.java:107`). No caller — both status feeds use
  `getPrintJobRaw` + `LuluJobStatusMapper.parse`. Keep `parseJob`/`PrintJob` (`createPrintJob` returns it).
  Repoint the three class-Javadoc references (`:29,33,96`) at `getPrintJobRaw` + the mapper.
- **F2 residue — fix the stale comment** at `StorybookTab.jsx:362` (`{/* Book theme picker + PDF download */}`
  over a block that now contains only the theme picker).

## Gated on Michael's decision — DO NOT delete without it
Ask first; the answer decides the work.

- **F2 — `Frontend/src/lib/storybookPdf.js` (307 lines) + `test/storybookPdf.test.js`.** Fully unreachable from
  the app (`downloadPdf` is imported only by its own test); superseded by the print sidecar route. **Decision:**
  is a user-facing "download my book as a PDF" affordance coming back? **No → delete both.** **Yes → keep and
  log it as unwired**, don't leave it looking live.
- **F3 — the multi-photo "first times" backend** (`FirstTimeController.java:70,85,98,109`,
  `FirstTimeService.java:125–190`, the 3 photo DTOs, `first_time_photos` table). The backend half of the
  **Dropped s9.0a**; no frontend caller, and the read path still runs an extra JOIN on every `/first-times`
  load. **Decision:** finish s9.0a's UX (the API is done + tested) **or** remove the 4 endpoints + service block
  and drop the hot-path JOIN. Either way, stop paying the JOIN for an empty table. (The table itself can stay.)

## Done when
- [ ] F1 + F4 + the F2 comment removed; `npm run test` and `./gradlew test` green.
- [ ] F2 and F3 decisions recorded here, and the chosen action taken.

## Not this session
Any live behaviour change · the ownership refactor (s5) · the `HomeFleet.jsx` orphan (inactive app, out of scope).
