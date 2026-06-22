# Storybook & Pregnancy — Review Fixes

## Goal
Implement the findings from the branch code review of `pregnancy-updates`
(see `branch-review.html` at repo root) as a sequence of small, independently
verifiable plans. Each plan is one focused implement-then-verify cycle.

## Source
All scope traces back to `branch-review.html` (5 passes: dead code, duplication,
test coverage, documentation, general improvements). Each session below cites the
pass + finding it implements.

## Tracks & order
Two mostly-parallel tracks (backend cleanup→security→tests, and frontend
dedup→refactor), with docs last so they describe the final code.

```
s1 (FE dead code) ─┐
s2 (BE dead code) ─┼─▶ s3 (IDOR) ─┐
                   │   s4 (credits/errors) ─┼─▶ s6 (backend tests)
                   │   s5 (uploads/cleanup) ┘
s1 ─▶ s7 (utilities) ─┬─▶ s8 (FE lib tests)
                      └─▶ s9 (extract helpers) ─▶ s10 (builder split)
(everything) ─▶ s11 (docs)
s12 (polish) — optional, anytime
```

**Recommended sequence:** s1 → s2 → s3 → s4 → s5 → s6 → s7 → s8 → s9 → s10 → s11, then s12 if desired.
The IDOR (s3) is the only ship-blocker; do it early.

## Sessions
| Session | Scope | Status |
|---------|-------|--------|
| s1 | Frontend dead code removal | Complete |
| s2 | Backend dead code & API surface removal (sharing, unlock) | Complete |
| s3 | Security: page-generation IDOR fix | Complete |
| s4 | Atomic credit decrement + controller error handling | Complete |
| s5 | Image upload validation + storage cleanup taxonomy | Not started |
| s6 | Backend test coverage (storybook + bump) | Not started |
| s7 | Shared utilities / de-duplication | Not started |
| s8 | Frontend lib test coverage | Not started |
| s9 | ScrapbookBuilder — extract testable helpers | Complete |
| s10 | ScrapbookBuilder — component split + low-pri dedup | Not started |
| s11 | Documentation refresh | Not started |
| s12 | Polish — a11y / consistency / vestigial (optional) | Not started |

## Per CLAUDE.md
Check each plan's **Status** before working it. Mark **Needs Verification** after
implementation; only **Complete** once Michael confirms it works. Never add
`Co-Authored-By: Claude` to commits.

## Decisions captured
- **Sharing feature: remove** (stale, serves legacy `body` not `layout_data`; full
  redo needed when resumed). Keep migration V25 (`book_share_tokens`).
- **`/storybook/unlock`: remove** (superseded by the period-only wizard).
