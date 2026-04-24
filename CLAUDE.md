# CradleHQ — Claude Instructions

## Plans

When working from a plan file in `plans/`, check the **Status** field at the top before doing anything.

- If `Status: Complete` — stop immediately. Tell the user this plan is already done and ask what they want to work on instead. Do not implement anything from it. Completed plans will eventually be moved to `plans/completed/` — this is not yet implemented.
- If `Status: In Progress` — pick up where it left off; confirm current state with the user before writing code.
- If `Status: Not started` — proceed normally.
