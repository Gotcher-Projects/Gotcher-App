# Bug Fix: Feeding oz Tracking in Track Tab
**Status:** Complete

## Problem
- `manualAddFeed` in `BabySteps.jsx` never passes `amountMl` in the PATCH call, so oz entered in the Dashboard quick log is silently dropped and never stored.
- `FeedingTab.jsx` manual log dialog has no oz field at all — users can't log oz from the Track tab.
- oz is never displayed in the feeding history in the Track tab.

## Root Cause
`BabySteps.jsx:230` — `manualAddFeed` POSTs to `/feeding` then PATCHes with only `{ endedAt }`, discarding `req.oz`.

## Affected Files
- `Frontend/src/components/BabySteps.jsx` — `manualAddFeed` function (~line 230)
- `Frontend/src/components/tabs/FeedingTab.jsx` — manual log dialog + history display

## Steps

### 1. Fix `manualAddFeed` in `BabySteps.jsx`
In the PATCH call, convert `oz → amountMl` and include it:
```js
body: JSON.stringify({
  endedAt: req.endedAt,
  amountMl: req.oz ? Math.round(req.oz * 29.5735) : null,
})
```

### 2. Add oz field to `FeedingTab` manual log dialog
- Add `oz: ''` to `manualForm` state init (and reset on save)
- Render an oz `<Input type="number">` below the feed type selector, only when `manualForm.type` is `bottle`, `formula`, or `solids`
- Pass `oz: parseFloat(manualForm.oz) || null` in the `onManualAdd` call

### 3. Display oz in FeedingTab history
Add a helper at the top of the file:
```js
const mlToOz = ml => ml ? (ml / 29.5735).toFixed(1) + ' oz' : null;
```
- In "Today's Feeds" mini list: append oz amount in the duration cell when present (e.g. `"2.5 oz"` instead of duration for bottle/formula/solids, or show both)
- In the grouped history rows: add oz in the Duration column when `l.amountMl` is set (bottle/formula/solids won't have a meaningful duration since `startedAt === endedAt` for manual logs)

## Notes
- Backend already supports `amountMl` in `StopFeedRequest` and stores it in `feeding_logs.amount_ml` — no backend changes needed.
- 1 fl oz = 29.5735 ml (use `Math.round` for storage, `.toFixed(1)` for display)
- Timer start/stop flow is out of scope for this fix.
