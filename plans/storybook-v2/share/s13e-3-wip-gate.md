# Share s13e-3 — WIP gate + "Mark as finished" toggle (frontend)

**Status:** Complete (verified 2026-07-14 by Michael — gate/badge/? help + toggle all confirmed in-browser).

_Implementation:_ `PublicBookPage`: WIP badge (fixed) + `?` help popover +
once-per-session ack gate (`sessionStorage['wip-ack:'+token]`), shown when `finished===false` && pages exist;
finished/empty unchanged. `ShareSection`: "Mark as finished" toggle (PATCH /books/{id} {finished}, optimistic) +
"📖 N pages added" line (`filledPageCount`). Build clean, 336 FE tests pass.
**Left to verify live:** incognito unfinished book → gate → badge + ? help; toggle finished in-app → refresh → clean.
**Est:** ~2h · **Depends on:** s13e-2 (payload `finished`/`type`; the `finished` flag + PATCH) · **Blocks:** nothing
**Scope:** FRONTEND (`PublicBookPage.jsx`, `StorybookTab.jsx`/`ShareSection.jsx`). No backend.

The visitor-facing work-in-progress treatment + the owner's "Mark as finished" switch. Grounded in mockup
`mockups/s13e-finished-toggle-and-wip.html` (Option A) — build to match it.

---

## Decisions locked (Michael, 2026-07-14) — see the mockup

- **Owner: one "Mark as finished" toggle** in the StorybookTab share section (same for guided + freeform), driving
  `PATCH /books/{id} {finished}`. Helper copy + a light "📖 N pages added" line reflect the state (per the mockup).
- **Visitor, not finished →** the WIP treatment:
  1. **Acknowledgment gate** (interstitial): "This book is a work in progress → View the book". Shows **once per
     session** (`sessionStorage`), keyed per token.
  2. **Persistent WIP badge** ("Work in progress") once past the gate.
  3. **`?` help popover**: "This family is still adding to their book — you're seeing the pages they've finished so far."
- **Visitor, finished →** clean book: no gate, no badge, no `?`.
- **Empty book** (`chapters: []`) → keep today's "This story is still being written" (no gate — nothing behind it).
- The toggle governs ONLY the WIP treatment; which pages appear is decided server-side (s13e-2).

## Frontend — `PublicBookPage.jsx`
- Read `finished` from the payload. If `finished` → render as today (cover + pages, no WIP chrome).
- If not finished AND there are pages:
  - On first load this session (no `sessionStorage['wip-ack:'+token]`), overlay the **gate**; "View the book" sets
    the flag and dismisses.
  - Render the **badge** (top-right) + the **`?`** popover (copy from the mockup). Match the mockup's look
    (cream card, soft shadow, the badge/help styles).
- Empty state unchanged.

## Frontend — owner toggle (`ShareSection.jsx` / StorybookTab)
- Add the **Mark as finished** switch (mockup's dashed card) below the link controls in the unlocked state — and
  decide whether it should also show when locked (it's a book property, not gated on sharing; the mockup shows it in
  the share section, so keep it there). Wire to `PATCH /books/{activeBookId} {finished}`; update local book state
  optimistically (mirror `handleThemeSelect`'s optimistic pattern) and reflect `activeBook.finished`.
- Show the "📖 N pages added" line. (Count from the active book's chapters/`sorted` already in StorybookTab — pass it
  to `ShareSection`, or compute filled-page count client-side for the label only; the authoritative filter is server-side.)

## Done when
- [ ] Owner toggles Mark-as-finished → persists via PATCH; label/state update; survives reload.
- [ ] Visitor on a NOT-finished book: gate shows once/session, then badge + working `?` help; refresh within the
      session doesn't re-gate.
- [ ] Visitor on a FINISHED book: clean, no WIP chrome.
- [ ] Empty book still shows "still being written".
- [ ] Matches the mockup; light/cream outward theme intact; mobile has no horizontal scroll.

## Not this session
Backend content rule / payload / migration (s13e-2) · purchase confirmation + PDF removal (s13e-1).
