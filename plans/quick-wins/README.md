# Quick Wins Plan

Three sessions to ship the remaining quick-win features. Baby age display and growth tracking
were already built before this plan was written.

---

## Status

| Session | Feature | Scope | Status |
|---------|---------|-------|--------|
| [S1](./s1-journal-spiff.md) | Journal design spiff | Frontend only | Complete |
| [S2](./s2-vaccine-tracker.md) | Vaccine Tracker | Full stack | Complete |
| [S3](./s3-appointments.md) | Doctor Appointments | Full stack | Complete |
| [S4](./s4-planning-review.md) | Feature planning review | No code | Complete |
| [S5](./s5-first-times.md) | First Times Tracker | Full stack | Complete |
| [S6](./s6-tab-restructure.md) | Tab restructure (12 → 5) | Frontend only | Pending |
| [S6.5](./s6.5-file-split.md) | Split BabySteps.jsx by tab | Frontend only | Pending |
| [S7](./s7-dashboard-upgrades.md) | Dashboard: quick-log + milestone card + summary stats | Frontend only | Pending |
| [S8](./s8-growth-percentiles.md) | CDC Growth Percentiles overlay | Frontend only | Pending |
| [S9](./s9-journal-focal-point.md) | Journal photo focal point | Full stack | Pending |

---

## Already Done (no sessions needed)

| Feature | Where it lives |
|---------|---------------|
| Baby age display | `Frontend/src/lib/babyAge.js` + `BabySteps.jsx:418` |
| Growth tracking | `Backend/…/growth/` + V9/V11 migrations + `GrowthTab` in BabySteps.jsx |

---

## Session File Template

```markdown
# Session N — Title
**Status:** Pending / In Progress / Complete
**Branch:** branch-name
**Depends on:** S(N-1) complete

## Files to Change
| File | Change |
|------|--------|
| path/to/file | description |

## Key Decisions
- Decision 1
- Decision 2

## Verification
- [ ] Check 1
- [ ] Check 2
```
