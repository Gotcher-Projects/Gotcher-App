# s1 — Frontend Dead Code Removal

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** none
**Source:** `branch-review.html` → Pass 1 (Dead Code), section A

> **Implemented 2026-06-19.** All items done. `npm run test` (193 passed) and `npm run build` green.
> **PaidGate decision:** removed now (was unused), but its prior implementation + a removal note
> were added to what is now `plans/storybook-v2/deprecated/payments-s2-upgrade-flow.md` task 1
> (moved + deprecated 2026-07-09) so the payments feature can re-create it. Note the payments model has
> since changed to one-time SKUs — the new purchase modal is built fresh; that file is reference only.
> Awaiting Michael's manual smoke test before marking Complete.

---

## Goal
Delete confirmed-unused frontend code so later refactor/test work has a smaller, honest surface.
Pure removal — no behaviour change.

## Scope
- **Delete file** `Frontend/src/components/ui/PaidGate.jsx` — never imported anywhere (paywall is
  inline in `StorybookTab`/`StorybookWizard`).
- **`MomentHeroCanvas.jsx`** — remove dead props `selectedSource` (line ~67) and `onFontChange`
  (line ~71) from the destructure, and stop passing them at the call site in
  `ScrapbookBuilder.jsx` (lines ~1129, ~1132). Keep `handleFontChange` (still used by `Slot`).
- **`onNavigate` chain** — remove the unused `onNavigate` prop from `StorybookTab.jsx` (it's never
  called). Then simplify/remove the wrapper in `MemoriesTab.jsx` (lines ~79–85) and the
  `health-milestones` handler `CradleHq.jsx` passes to `MemoriesTab` (lines ~771–776).
  > If cross-tab navigation is still wanted as a feature, stop and confirm with Michael before
  > deleting the chain — otherwise remove it.
- **No-groups generation branch** — remove the `else` branch in `StorybookTab.handleGeneratePages`
  (lines ~65–67) and the now-unused `wizardGeneratePages` in `CradleHq.jsx` (lines ~398–400). The
  wizard always passes groups, so the branch is unreachable.

## Out of scope
- `onUserUpdate` on `CradleHq` — leave for s12 (decide keep-for-future vs remove).
- Backend removals — that's s2.

## Files
- `Frontend/src/components/ui/PaidGate.jsx` (delete)
- `Frontend/src/components/storybook/MomentHeroCanvas.jsx`
- `Frontend/src/components/storybook/ScrapbookBuilder.jsx`
- `Frontend/src/components/tabs/StorybookTab.jsx`
- `Frontend/src/components/tabs/MemoriesTab.jsx`
- `Frontend/src/components/CradleHq.jsx`

## Verification
1. `cd Frontend && npm run test` — green.
2. `npm run build` — no unresolved imports / unused-var lint errors.
3. Manual smoke: open the Book tab, run the wizard (Scrapbook + Quick Build), open the builder,
   confirm moment-hero pages still render and place content.
