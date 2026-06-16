# S2 — Pregnancy Home + Size/Development Dataset

**Status: Not started**
**Branch:** TBD (continue `feature/pregnancy-mode`)
**Depends on:** S1 complete (`due_date`, phase derivation, onboarding phase choice all shipped).

---

## Context
This is the heart of the keepsake-first experience: the screen an expecting user opens every day.
It is driven almost entirely by one date (`due_date`) and one static dataset (the weekly size /
development table). No new backend tables — pure frontend content + the existing appointments
feature surfaced as prenatal visits.

## Decisions (confirmed 2026-06-16 — do not re-litigate)
- The **weekly "size of your baby" card** is the hero. **Simple illustrations** (not 3D models, not
  photoreal). The same dataset also supplies the **week-by-week development blurb**.
- We **author our own copy + illustrations**. Do not lift another app's text/art verbatim.
- Prenatal appointments **reuse the existing appointment feature** — no new backend.

---

## The size dataset — `Frontend/src/lib/pregnancySizes.js` (new)
One array, weeks ~4 → 40 (≈37 rows). Shape:
```js
// length/weight are approximate, label is the comparison object, art is an asset key.
export const PREGNANCY_SIZES = [
  // week, object label, illustration key, length, weight, development one-liner
  { week: 8,  label: 'a raspberry',  art: 'raspberry',  lengthCm: 1.6,  weightG: 1,   blurb: 'Tiny fingers and toes are starting to form.' },
  { week: 12, label: 'a lime',       art: 'lime',       lengthCm: 5.4,  weightG: 14,  blurb: 'Reflexes are kicking in — fingers will soon open and close.' },
  { week: 20, label: 'a banana',     art: 'banana',     lengthCm: 16.4, weightG: 300, blurb: 'You may start feeling those first flutters of movement.' },
  { week: 24, label: 'a cantaloupe', art: 'cantaloupe', lengthCm: 30,   weightG: 600, blurb: 'Tiny taste buds are forming and hearing is developing.' },
  { week: 40, label: 'a small pumpkin', art: 'pumpkin', lengthCm: 51,   weightG: 3400, blurb: "Fully cooked — ready to meet you any day now!" },
  // ...fill every week 4–40
];

export function sizeForWeek(week) {
  // exact match, else the nearest defined week at or below
  return PREGNANCY_SIZES.filter(s => s.week <= week).at(-1) ?? PREGNANCY_SIZES[0];
}
```
Display both metric and imperial (cm/in, g→oz/lb) computed in the component, so the dataset stays
single-unit.

### Illustrations — keep the art effort bounded
- Store simple line/flat illustrations in `Frontend/public/images/pregnancy/<art>.svg` (or `.png`),
  keyed by the `art` field.
- **Phase the art:** ship the card with an **emoji/text fallback** first (🍋 etc.) so the feature is
  functional without waiting on 37 drawings, then drop illustrations in as they're made. The
  component reads `art` → tries the asset → falls back to a per-row emoji.
- This is the one place real art creeps in; gating it behind a fallback keeps S2 shippable.

---

## Frontend — Pregnancy Home

Rendered when `phase === 'pregnancy'` (replaces the S1 placeholder). New component
`Frontend/src/components/pregnancy/PregnancyHome.jsx`, styled with existing theme tokens.

Sections, top to bottom:
1. **Countdown header** — "Week {weeksPregnant} · {daysUntilDue} days to go", a progress bar of the
   40-week journey, and the due date. All from `pregnancy.js` helpers (S1).
2. **Size card (hero)** — `sizeForWeek(week)`: illustration (or emoji fallback), "Your baby is about
   the size of **{label}**", approximate length + weight, and the development `blurb`. This is the
   shareable/keepsake unit — keep it a clean self-contained card (it becomes a storybook page and a
   social card later).
3. **This week** — the development blurb expanded slightly + a gentle "what to expect" line. (Keep
   copy light and non-clinical; we are not giving medical advice.)
4. **Prenatal appointments** — reuse the existing appointments list/add UI (the
   `com.gotcherapp.api.appointments` endpoints + the AppointmentTab component). Optionally seed a few
   prenatal-oriented preset labels ("Anatomy scan", "Glucose test", "Group B strep"). No backend
   change — same `/appointments` endpoints.
5. **"Mark as born" + phase swap** — give the S1 actions a real home here: a primary "Baby's here?
   Add their birthday" button (records birthdate + swaps to baby mode) and a quieter swap control so
   the user can move between modes at will. Both call `swapPhase(...)` from S1 — the mode follows the
   stored `phase`, never the birthdate, so late/early births and post-birth bump-diary revisits work.

### Wiring
- `CradleHq.jsx` switches on `phase` (`profilePhase`): `pregnancy` → `<PregnancyHome>`, `baby` →
  existing app.
- Reuse `daysUntilDue` / `weeksPregnant` from `lib/pregnancy.js`.

---

## Testing checklist
- [ ] `sizeForWeek` returns the right row for exact + in-between weeks (unit test)
- [ ] Set a due date ~16 weeks out → home shows "Week 24", cantaloupe card, correct countdown
- [ ] Length/weight render in both metric + imperial
- [ ] Illustration shows when the asset exists; emoji fallback shows when it doesn't
- [ ] Prenatal appointments add/list/delete works (same as baby-mode appointments)
- [ ] "Mark as born" swaps to baby mode and the swap control moves both ways (S1 behavior, now reachable here)
- [ ] Edge weeks: week < 4 and week ≥ 40 render sensibly (clamped)

## Out of scope
- Bump photo diary + storybook tie-in — S3.
- Turning the size card into a downloadable/shareable *image* — `plans/social-sharing/`.
