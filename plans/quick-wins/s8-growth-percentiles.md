# Session 8 — CDC Growth Percentiles Overlay
**Status:** Complete
**Branch:** feature/growth-percentiles
**Depends on:** S6 complete (Growth lives inside Health tab after restructure)

---

## Context
The growth chart already plots the baby's weight/height/head measurements over time. Parents'
#1 question is "is my baby on track?" — this adds CDC reference curves (5th, 50th, 95th
percentile) as overlay lines so parents can see where their baby sits without asking a doctor.

Frontend-only. CDC publishes LMS (lambda-mu-sigma) tables in the public domain. No backend
changes needed.

---

## Decisions Made in S4
- Weight, height, and head circumference percentiles — all three
- Boys and girls on separate curves
- Show 5th / 50th / 95th percentile lines (not the full 10-line fan)

---

## Data Source

CDC publishes LMS tables at:
https://www.cdc.gov/growthcharts/who_charts.htm (WHO 0–2 years, recommended over CDC for infants)

For simplicity, use the WHO 0–24 month tables (weight-for-age, length-for-age, head
circumference-for-age). These are available as CSV / text tables. Bake the data directly
into a static JS file — no fetch required at runtime.

### Static data file: `Frontend/src/lib/growthPercentiles.js`

Structure:
```js
// WHO weight-for-age (kg), boys, months 0–24
// Columns: month, p5, p50, p95
export const WEIGHT_BOYS = [
  [0,  2.9, 3.3, 4.4],
  [1,  3.9, 4.5, 5.8],
  // ...
];
export const WEIGHT_GIRLS = [ ... ];
export const LENGTH_BOYS  = [ ... ];
export const LENGTH_GIRLS = [ ... ];
export const HEAD_BOYS    = [ ... ];
export const HEAD_GIRLS   = [ ... ];
```

Use the WHO tables (birth to 24 months). If the baby is > 24 months, don't show percentile
lines (or extend to CDC 2–20 tables in a future session).

---

## Chart Integration

The growth chart is rendered in `GrowthTab` in BabySteps.jsx. Currently it uses a basic
SVG or a charting library — read the current implementation before coding.

Overlay lines are drawn in the same coordinate space as the existing data. The baby's sex
comes from `data.profile.sex` (or equivalent field — check the baby_profiles schema).

If the baby profile doesn't have a sex field yet:
- Add `sex VARCHAR(10)` to the baby_profiles table (new migration V17)
- Add `sex` to the profile form on Dashboard
- Default to showing both-sex average curves if sex is unknown

### Rendering approach
- Each percentile curve is a `<polyline>` or `<path>` in the existing SVG
- Line style: dashed, low opacity (e.g. `stroke-dasharray="4 4" opacity="0.4"`)
- Colors: 5th = red-300, 50th = slate-400, 95th = green-300 (subtle, not distracting)
- Label each line at the right edge: "5th", "50th", "95th"

---

## Files to Change

| File | Change |
|------|--------|
| `Frontend/src/lib/growthPercentiles.js` | New file — WHO LMS data for W/L/HC, boys + girls |
| `Frontend/src/components/BabySteps.jsx` | Import and overlay percentile curves in `GrowthTab` |
| `Backend/db/migration/V17__add_sex_to_baby_profiles.sql` | Only if sex field is missing from baby_profiles |
| `Backend/src/main/java/com/gotcherapp/api/baby/BabyProfileController.java` | Only if sex field is added |

Read `GrowthTab` in BabySteps.jsx before writing anything — the chart implementation
determines how overlays are added.

---

## Testing Checklist
- [ ] Percentile lines appear on weight chart for a baby with records
- [ ] Lines scale correctly with chart axes (don't overflow or misalign)
- [ ] Boys and girls show sex-appropriate curves
- [ ] Baby with no sex set falls back gracefully (neutral curve or no lines)
- [ ] Lines are clearly labeled (5th / 50th / 95th)
- [ ] Percentile lines don't obscure the baby's own data points
- [ ] Chart still renders correctly with zero growth records

---

## Out of Scope
- CDC 2–20 year tables (only need 0–24 months for now)
- Interactive hover tooltip on percentile lines
- Storing sex on baby_profiles (only if field is absent — check first)
