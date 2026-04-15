# Session 1 — Journal Design Spiff
**Status:** Done
**Branch:** `quick-wins`
**Depends on:** nothing

## Goal
Polish the journal tab's visual presentation. Cards are functional but dense.
The entry list (right 2/3 column) needs better hierarchy and photo treatment.

## Files to Change
| File | Change |
|------|--------|
| `Frontend/src/components/BabySteps.jsx` | Rework journal entry card layout (lines 787–861) |

## Key Decisions
- **Photo layout:** When a photo exists, show it as a full-width hero image at the top of the card
  with `object-cover` + fixed height (e.g. `h-48`), rounded top corners — not `object-contain`.
  Current `object-contain` leaves ugly grey bars.
- **Typography:** Entry title → `text-2xl font-bold`; story text → `text-base` (not `text-sm`),
  `leading-relaxed`. More breathing room.
- **Week badge:** Bump to `text-sm` and keep the fuchsia pill. Move date to its own line below title.
- **Card border:** Keep the `border-l-4 border-l-fuchsia-300` but add a subtle hover shadow lift
  (`transition-shadow hover:shadow-lg`).
- **Empty state:** Replace the plain card with a centered illustration-style placeholder — use a
  Camera icon at `w-16 h-16 text-fuchsia-200`, heading "No memories yet", subtext "Add your first entry above."
- **Edit mode:** No change needed — it's functional and inline.
- No new components, no new files, no state changes — layout/style only.

## Verification
- [x] Entry cards with photos show a proper hero image (no grey letterbox bars)
- [x] Entry title is legible and dominant, date sits below it
- [x] Empty state looks intentional, not like a bug
- [ ] Edit mode still works — clicking Edit opens inline form, Save/Cancel work
- [ ] Delete confirm flow still works
- [ ] PDF export button still present and functional
- [ ] No console errors
