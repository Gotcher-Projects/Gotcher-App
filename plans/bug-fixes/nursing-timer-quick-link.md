# Nursing Timer in Dashboard Quick Links
**Status:** Under Review
**Area:** Dashboard quick links — DashboardTab + BabySteps

> ⚠️ This plan is under review and may be removed. Before starting this session, explicitly confirm with the user that they want to implement the live nursing timer on the dashboard. Do not begin implementation without that confirmation.

## Goal
Replace the after-the-fact nurse quick log form on the Dashboard with a live tap-to-start / tap-to-stop timer, matching the behavior already available in the Track tab.

## How it works today
The nurse quick link opens a form asking for duration (minutes), side, and end time — all entered after the fact. `onStart` and `onStop` are not passed to DashboardTab.

## What changes
- DashboardTab gets `onStart` and `onStop` props from BabySteps
- Active feed is detected from the existing `feeding` prop: `feeding.find(f => !f.endedAt)`
- The nurse quick log UI becomes:
  - **Idle:** Two buttons — "Start Left" / "Start Right" — call `onStart('breast_left')` / `onStart('breast_right')`
  - **Active:** Shows breast side, elapsed time (ticking), and a "Stop" button — calls `onStop(activeFeed.id, new Date().toISOString())`
- The old manual duration+time form is removed for nurse (bottle manual log is unaffected)

## Affected Files

### Frontend — edit
- `Frontend/src/components/BabySteps.jsx` — pass `onStart={startFeed}` and `onStop={stopFeed}` to DashboardTab
- `Frontend/src/components/tabs/DashboardTab.jsx` — accept `onStart`/`onStop` props; replace nurse quick log with timer UI

## Notes
- Sleep live timer explicitly excluded — logging after the fact is the right UX for sleep
- Elapsed time display needs a `useEffect` interval (1s tick) when a feed is active, similar to FeedingTab
- If a feed is already active when the Dashboard loads, the timer should reflect the real elapsed time from `activeFeed.startedAt`
