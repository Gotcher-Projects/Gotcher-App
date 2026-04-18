# Session 6 — Tab Restructure (12 → 5)
**Status:** Pending
**Branch:** feature/tab-restructure
**Depends on:** S5 complete (Firsts tab must exist before merging it into Memories)

---

## Context
Currently 12 tabs crammed into a single row — unusable on mobile. S4 decided on 5 top-level
tabs. This session is purely structural: move existing components into the new groupings.
No new features, no new API calls, no new components.

---

## New Tab Structure

| Tab | Contains | Notes |
|-----|----------|-------|
| Dashboard | Same as current | Leave Dashboard content alone — S7 handles the upgrade |
| Memories | Journal + First Times | Secondary pill toggle at top of tab |
| Track | Feeding + Sleep + Poop | Secondary pill toggle |
| Health | Growth + Vaccines + Appointments + Milestones | Secondary pill toggle; Milestones moves to Dashboard in S7 |
| Discover | Marketplace + Playdates + Activities | Secondary pill toggle |

---

## Secondary Navigation Pattern

Each grouped tab gets a row of pill buttons below the main tab bar:

```jsx
const [memoriesView, setMemoriesView] = useState('journal');

<div className="flex gap-2 mb-4">
  <button
    onClick={() => setMemoriesView('journal')}
    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
      memoriesView === 'journal'
        ? 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700'
        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
    }`}
  >
    Journal
  </button>
  <button
    onClick={() => setMemoriesView('firsts')}
    className={`px-3 py-1 rounded-full text-sm border transition-colors ...`}
  >
    Firsts
  </button>
</div>
```

Do NOT use nested `<Tabs>` components — pill buttons with local state are simpler and avoid
Radix nesting issues.

---

## Files to Change

| File | Change |
|------|--------|
| `Frontend/src/components/BabySteps.jsx` | Replace 12 `TabsTrigger` + `TabsContent` with 5. Add secondary pill toggles. |

No backend changes. No new files.

---

## State to Add

One `useState` per grouped tab for the active sub-view:

```js
const [memoriesView, setMemoriesView] = useState('journal');   // 'journal' | 'firsts'
const [trackView, setTrackView] = useState('feeding');          // 'feeding' | 'sleep' | 'poop'
const [healthView, setHealthView] = useState('growth');         // 'growth' | 'vaccines' | 'appointments' | 'milestones'
const [discoverView, setDiscoverView] = useState('marketplace');// 'marketplace' | 'playdates' | 'activities'
```

---

## Tab Trigger Changes

Remove all 12 current `TabsTrigger` entries. Replace with:

```jsx
<TabsTrigger value="dashboard">Dashboard</TabsTrigger>
<TabsTrigger value="memories">Memories</TabsTrigger>
<TabsTrigger value="track">Track</TabsTrigger>
<TabsTrigger value="health">Health</TabsTrigger>
<TabsTrigger value="discover">Discover</TabsTrigger>
```

---

## TabsContent Layout

Each content block renders the pill nav + conditionally shows the right component:

```jsx
<TabsContent value="memories" className="mt-4">
  <PillNav
    options={[{ value: 'journal', label: 'Journal' }, { value: 'firsts', label: 'Firsts' }]}
    active={memoriesView}
    onChange={setMemoriesView}
  />
  {memoriesView === 'journal' && <JournalTab ... />}
  {memoriesView === 'firsts'  && <FirstTimesTab ... />}
</TabsContent>
```

Write a tiny `PillNav` helper component at the bottom of BabySteps.jsx (10–15 lines) to avoid
repeating the button pattern 4 times:

```jsx
function PillNav({ options, active, onChange }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            active === o.value
              ? 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-700'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

---

## Dashboard Tab Changes (this session only)

Leave all existing DashboardTab content exactly as-is. S7 handles dashboard upgrades.

The only change: remove the Milestones `TabsTrigger` and `TabsContent` from the top-level tab
list — Milestones now lives inside the Health sub-nav. Ensure the `<MilestonesTab>` component
and all its props still render correctly under Health.

---

## Testing Checklist
- [ ] All 12 features still accessible — nothing lost
- [ ] Switching top tab resets sub-view to the default (first option) — or preserves it (either is fine, pick one)
- [ ] Mobile: 5 tabs fit on one row without overflow or wrapping
- [ ] Pill nav renders on each grouped tab
- [ ] Journal, Firsts, Feeding, Sleep, Poop, Growth, Vaccines, Appointments, Milestones, Marketplace, Playdates, Activities all still function correctly

---

## Out of Scope
- Dashboard upgrade (milestone card, quick-log, summary stats) — S7
- Moving Milestones from Health to Dashboard — S7
- Any new features or API calls
