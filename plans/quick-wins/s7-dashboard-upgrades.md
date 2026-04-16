# Session 7 — Dashboard Upgrades
**Status:** Complete
**Branch:** feature/dashboard-upgrades
**Depends on:** S6.5 complete (file split must be in place — DashboardTab.jsx is the only file to change this session)

---

## Context
Three self-contained improvements to the Dashboard tab, all frontend-only using data already
loaded in BabySteps.jsx. No new API calls, no new state beyond what's already fetched.

---

## Feature 1 — Quick-Log Buttons

### What
A row of one-tap buttons on the Dashboard for the most common daily actions.
Parents log feeding and diaper changes 8+ times a day — navigating to a tab each time is
friction. These buttons call the same handler functions already used by the individual tabs.

### Actions to surface (4 buttons)
| Button | Handler | Notes |
|--------|---------|-------|
| Feed (bottle) | `addFeedingLog` with type='bottle' | Opens a minimal inline form: oz + time |
| Feed (nurse) | `addFeedingLog` with type='nurse' | Opens inline form: duration + time |
| Diaper | `addPoopLog` | Opens inline form: type (wet/dirty/both) + time |
| Sleep | `startSleepLog` or `addSleepLog` | Opens inline form: start + end time |

### UI
A 2×2 grid of icon + label buttons below the profile header. Each opens a small inline modal
or collapsible form (not a navigation — stay on Dashboard). On success, form collapses and
shows a brief "Logged!" confirmation.

Keep the inline form minimal — just the required fields. Users can go to the Track tab for
full history.

---

## Feature 2 — Milestone Card

### What
Move Milestones out of the Health sub-nav (where S6 temporarily placed it) and surface the
current age group's checklist as a card on Dashboard.

### UI
- Card titled "This Week's Milestones" (or "Age N–N Milestones")
- Shows only the current age group (based on `week`/`months`)
- Inline checkboxes — same `toggleMilestone` handler as the full Milestones tab
- "See all milestones" link that navigates to Health → Milestones (set `setActiveTab('health')` + `setHealthView('milestones')`)
- If all milestones in current group are achieved, show a small celebration message

### Props needed
`DashboardTab` already receives `data` (contains milestones), `week`, `onToggleMilestone`.
No new props needed.

### After this session
Remove Milestones from the Health sub-nav pill list (or keep it — either is fine; discuss at
start of session).

---

## Feature 3 — Sleep & Feeding Summary Cards

### What
Two small stat cards showing computed summaries from data already loaded in BabySteps.jsx.

**Feeding card**
- Last feed: "2h 15m ago" (time since most recent feeding log's `endTime` or `startTime`)
- Today's feeds: count of logs since midnight
- Avg gap today: mean time between feeds (if ≥ 2 feeds today)

**Sleep card**
- Total sleep last 24h: sum of completed sleep log durations
- Longest stretch last 24h
- Last wake time: time since most recent sleep log ended

### Data source
`feeding` state (already fetched `/feeding?days=7`) and `sleep` state (already fetched
`/sleep?days=30`). Both already passed into or accessible in the component tree.

These stats are computed in `DashboardTab` — no new API calls, no new state.

### Props
`DashboardTab` needs `feeding` and `sleep` passed in. Check current props — add them if
not already there.

---

## Files to Change

| File | Change |
|------|--------|
| `Frontend/src/components/BabySteps.jsx` | Add quick-log buttons, milestone card, summary cards to `DashboardTab`. Pass `feeding` and `sleep` props if not already there. |

No backend changes. No new files (unless quick-log inline forms are extracted — keep them
in BabySteps.jsx for now).

---

## Testing Checklist
- [ ] Quick-log: Feed (bottle) creates a feeding log, appears in Track → Feeding history
- [ ] Quick-log: Diaper creates a poop log, appears in Track → Poop history
- [ ] Quick-log: Sleep creates a sleep log, appears in Track → Sleep history
- [ ] Quick-log inline forms close/collapse after success
- [ ] Milestone card shows current age group milestones
- [ ] Milestone checkboxes work (toggle persists on reload)
- [ ] "See all" navigates to Health → Milestones
- [ ] Feeding summary card shows correct last-feed time and today count
- [ ] Sleep summary card shows correct 24h total
- [ ] No regressions on any other tab

---

## Out of Scope
- CDC percentile overlay — S8
- Journal photo focal point — S9
- Any new backend endpoints

---

## Future Dashboard Ideas (post-S9 backlog)

Things worth thinking about for a later planning session once the quick-wins plan wraps up:

- **Today at a glance** — a single summary row: last feed time, last diaper, last sleep stretch, next appointment. Replaces hunting across tabs for common status checks.
- **Baby photo header** — profile photo displayed prominently at the top of the dashboard alongside the age/name header. Makes the app feel personal from first login.
- **Weekly narrative summary** — auto-generated plain-English blurb ("Lily slept an average of 14h last week, up from 12h the week before"). No AI needed — pure template string from computed stats.
- **Upcoming milestones** — a small card showing the next 2–3 milestones not yet achieved for the baby's current age group, with a link to Health → Milestones.
- **Streak / consistency badges** — visual indicator for consistent logging streaks (e.g. "7-day feeding streak"). Encourages engagement without adding complexity elsewhere.
- **Customizable widget order** — let parents drag cards into the order they care about most. Probably deferred until there are enough cards to make it worthwhile.
- **Multi-baby support** — a switcher in the header to toggle between sibling profiles. This would require a significant data-model change (baby_profile_id on all tables) and is a bigger project than a quick win.
