# Session 3 — In-App Storybook View
**Status:** Not started
**Branch:** `feature/storybook`
**Depends on:** S1 (paid flag in frontend), S2 (backend endpoints live)

## Goal
Build the in-app storybook reading and editing experience. A new "Book" section appears in
the Memories tab (alongside Journal and Firsts). It shows the baby's chapters in order, with
visual states for locked / unlocked / draft / published. Paid users can generate and approve
chapters; free users see the PaidGate upgrade prompt.

Milestone and First Time save handlers in CradleHq.jsx must call `POST /storybook/unlock`
after a successful save so chapter rows are created automatically.

## Files to Change
| File | Change |
|------|--------|
| `Frontend/src/components/tabs/MemoriesTab.jsx` | Add 'book' to PillNav; render StorybookTab |
| `Frontend/src/components/tabs/StorybookTab.jsx` | New file — full storybook view |
| `Frontend/src/components/CradleHq.jsx` | Add storybook state + handlers; call unlock on milestone/first-time saves |
| `Frontend/src/lib/api.js` | No changes needed — uses existing `apiRequest` |

## Key Decisions

### Navigation placement
Add a third option to the Memories PillNav:
```
[ Journal ]  [ Firsts ]  [ Book ]
```
The "Book" option is always visible regardless of paid status. When a free user taps it,
they see the `PaidGate` upgrade prompt. This makes the feature discoverable and creates
a clear reason to upgrade.

### Storybook state in CradleHq.jsx
Add alongside existing state:
```js
const [chapters, setChapters] = useState([]);
```
Fetch on mount: `GET /storybook` → `setChapters(data)`.
Pass down to MemoriesTab as `chapters` prop alongside existing props.

### Unlock trigger wiring
After a successful `toggleMilestone(key, true)` call, call:
```js
await apiRequest('/storybook/unlock', { method: 'POST', body: { anchorType: 'milestone', anchorKey: key, anchorLabel: label } });
```
After a successful `onAddFirst()` call:
```js
await apiRequest('/storybook/unlock', { method: 'POST', body: { anchorType: 'first_time', anchorKey: String(firstTime.id), anchorLabel: firstTime.label } });
```
Both calls are fire-and-forget (catch and ignore errors — don't block the main action).
After either call, refresh chapters: `GET /storybook` → `setChapters`.

### StorybookTab component structure
```
StorybookTab
  ├── if not paid → <PaidGate isPaid={false} />
  └── if paid
        ├── Empty state (no chapters yet — guide to log milestones)
        ├── ChapterCard × N (ordered by created_at)
        └── (future: Share button — added in S4)
```

### ChapterCard states
Each chapter has one of four visual states based on `status`:

**unlocked** — "Ready to generate"
- Card with anchor label as title, subtle border
- "Generate Chapter" button (calls POST /storybook/generate/{id}, shows spinner)
- Subtext: "Tap to write the story of this moment"

**generating** (local loading state, not a DB status)
- Same card with a Loader2 spinner and "Writing your story..." text
- Button disabled

**draft** — "Waiting for your approval"
- Shows the full generated body text
- Amber/yellow badge: "Draft — review before publishing"
- "Approve & Publish" button → PATCH status=published
- "Edit" button → opens inline textarea with the body text, Save/Cancel
- "Regenerate" button → calls generate again (overwrites draft)

**published** — final state
- Displays body text with clean typography
- Subtle green/purple published indicator
- "Edit" button (can still edit after publishing — updates body text only, not status)
- Anchor label + published date as subtitle

### Generate error handling
If the Claude API call fails (network error, 500, 403), show a toast error and return the
chapter to `unlocked` state in local state (don't leave it spinning). The backend sets
`status=draft` only on success, so a re-fetch will show the true state.

### Typography in published chapters
Published chapter body should read like a book, not a UI element:
- Font: `font-serif` (Georgia/serif fallback) or use Poppins at normal weight
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
Pass a `onNavigate` callback from MemoriesTab to StorybookTab if needed.

## Verification
- [ ] "Book" appears as third option in Memories PillNav
- [ ] Free user sees PaidGate upgrade prompt in Book view
- [ ] Paid user sees chapter list (or empty state)
- [ ] Logging a milestone creates an `unlocked` chapter card (after data refresh)
- [ ] Saving a first time creates an `unlocked` chapter card
- [ ] "Generate Chapter" button calls API, shows spinner, renders draft on success
- [ ] Draft chapter shows body text + Approve + Edit + Regenerate
- [ ] "Approve & Publish" transitions card to published state
- [ ] Published chapter body is readable (serif/relaxed font, constrained width)
- [ ] Edit works on both draft and published chapters
- [ ] Generate API failure shows error toast and returns card to unlocked state
- [ ] Empty state renders when no milestones/firsts logged yet
- [ ] Empty state navigation buttons work
