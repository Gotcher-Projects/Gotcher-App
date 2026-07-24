# Session 3 — In-App Storybook View
**Status:** Complete
**Branch:** `feature/storybook`
**Depends on:** S1 (tier in frontend), S2 (backend endpoints live)
**Design reference:** `plans/storybook/design-decisions.md`

> **Note from S2 planning:** The storybook now supports two chapter types — event-anchored
> ('milestone'|'first_time') and time-period ('period'). S3 must handle both:
> - Event-anchored chapters are created via the existing milestone/first-time unlock flow
> - Period chapters are created via a separate UI — a "Add Chapter" section with a dropdown
>   listing available time periods based on baby age and data availability (frontend computes
>   which periods have enough data to offer). Include a help callout explaining that sparse
>   data may result in thin chapters.
> - ChapterCards look the same regardless of type — the anchor_label is the display title
> - `sort_order` is returned by the API but ordering UI is a future session

## Goal
Build the in-app storybook reading and editing experience. A new "Book" section appears in
the Memories tab (alongside Journal and Firsts). It shows the baby's chapters in order with
visual states for unlocked / generating / draft / published.

**Teaser gating (S0 decision):** The Book tab is visible to all users. Free users see
chapter titles from their unlocked rows, but Generate is locked behind an inline upgrade prompt.
Paid users with credits can generate and approve chapters. This makes the feature discoverable
and gives free users a concrete reason to upgrade.

Milestone and First Time save handlers in CradleHq.jsx must call `POST /storybook/unlock`
after a successful save so chapter rows are created for all users (free and paid alike).

## Files to Change
| File | Change |
|------|--------|
| `Frontend/src/components/tabs/MemoriesTab.jsx` | Add 'book' to PillNav; render StorybookTab |
| `Frontend/src/components/tabs/StorybookTab.jsx` | New file — full storybook view |
| `Frontend/src/components/CradleHq.jsx` | Add storybook state + handlers; call unlock on milestone/first-time saves |

## Key Decisions

### Navigation placement
Add a third option to the Memories PillNav:
```
[ Journal ]  [ Firsts ]  [ Book ]
```
"Book" is always visible regardless of tier. Free users tap it and see their chapters with
locked generate buttons — not a blank wall. This is the teaser experience.

### Storybook state in CradleHq.jsx
```js
const [chapters, setChapters] = useState([]);
```
Fetch on mount: `GET /storybook` → `setChapters(data)`.
Pass `chapters` and `tier` down to MemoriesTab → StorybookTab.

### Unlock trigger wiring
After a successful `toggleMilestone(key, true)` call:
```js
await apiRequest('/storybook/unlock', { method: 'POST', body: {
  anchorType: 'milestone', anchorKey: key, anchorLabel: label
}});
```
After a successful `onAddFirst()` call:
```js
await apiRequest('/storybook/unlock', { method: 'POST', body: {
  anchorType: 'first_time', anchorKey: String(firstTime.id), anchorLabel: firstTime.label
}});
```
Both are fire-and-forget (catch and ignore errors — don't block the main action).
After either call, refresh: `GET /storybook` → `setChapters`.
Free users also get unlock rows — they just can't generate yet.

### StorybookTab component structure
```
StorybookTab
  ├── Upgrade banner (free users only, dismissible)
  ├── Empty state (no chapters yet)
  └── ChapterCard × N (ordered by created_at)
        ├── free user  → title visible, Generate button shows inline upgrade prompt
        └── paid user  → full ChapterCard with all actions
```

No full-tab PaidGate wrapper. Free users see the chapter list, not a locked screen.

### Upgrade banner (free users)
Render a subtle banner at the top of the tab for free users:
> "Your story is ready to write — upgrade to Plus to generate chapters."
> [Upgrade to Plus →]

Dismissible (local state, not persisted). Reappears on next visit.
Use the existing card/badge primitives with an amber or brand-purple accent.

### ChapterCard states

**unlocked — free user**
- Card with anchor label as title, subtle border
- "Generate Chapter" button → replaced with lock icon + "Upgrade to Plus to generate"
- Tap behavior: open upgrade modal / link (same UpgradePrompt from S1's PaidGate)

**unlocked — paid user, credits available**
- "Generate Chapter" button (calls POST /storybook/generate/{id}, shows spinner)
- Subtext: "Tap to write the story of this moment"

**unlocked — paid user, 0 credits**
- "Generate Chapter" button disabled, subtext: "No credits remaining this month"

**generating** (local loading state, not a DB status)
- Loader2 spinner + "Writing your story..." text
- Button disabled

**draft**
- Shows the full generated body text
- Amber badge: "Draft — review before publishing"
- "Approve & Publish" button → PATCH status=published
- "Edit" button → inline textarea, Save/Cancel
- "Regenerate" button → costs 1 credit (warn if 0 credits); calls generate again

**published**
- Body text with clean typography (see Typography section)
- Subtle published indicator (green or brand-purple)
- "Edit" button (can edit after publishing — updates body only, not status)
- Anchor label + published date as subtitle

### Generate error handling
If the Claude API call fails (network error, 500, 403, 402), show a toast error and return
the chapter to `unlocked` state in local state. The backend refunds the credit on failure,
so no manual credit adjustment is needed on the frontend.

### Typography in published chapters
- Font: `font-serif` (Georgia/serif fallback) or Poppins at normal weight
- Line height: `leading-relaxed` or `leading-loose`
- Font size: `text-base` or `text-lg`
- Max width: constrain to ~65ch for readability
- Subtle card background, no heavy borders

### Empty state
When `chapters.length === 0`:
> "Your story starts when you log milestones and first times.
>  Each achievement becomes a chapter."
> [Go to Milestones →]  [Go to Firsts →]

These buttons switch the Memories PillNav to 'firsts' or navigate to Health tab.

## Verification
- [ ] "Book" appears as third option in Memories PillNav
- [ ] Free user sees chapter list with upgrade banner (not a blank locked screen)
- [ ] Free user's chapter cards show title but Generate is replaced with upgrade prompt
- [ ] Paid user with credits sees "Generate Chapter" button
- [ ] Paid user with 0 credits sees disabled Generate button with credit message
- [ ] Logging a milestone creates an `unlocked` chapter card (after refresh)
- [ ] Saving a first time creates an `unlocked` chapter card
- [ ] "Generate Chapter" calls API, shows spinner, renders draft on success
- [ ] Draft chapter shows body + Approve + Edit + Regenerate
- [ ] "Approve & Publish" transitions card to published state
- [ ] Published chapter body uses serif/relaxed typography
- [ ] Edit works on both draft and published chapters
- [ ] Generate failure shows error toast and returns card to unlocked state
- [ ] Empty state renders when no milestones/firsts logged yet
- [ ] Empty state navigation buttons work
