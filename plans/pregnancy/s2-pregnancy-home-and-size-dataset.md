# S2 — Pregnancy Home + Size/Development Dataset

**Status: Complete** (verified in-app by Michael 2026-06-17)
**Branch:** `pregnancy-updates`
**Depends on:** S1 complete (`due_date` + stored `phase` field, onboarding phase choice, and the
`markAsBorn` / `updatePhase` actions all shipped).

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

## Decisions (confirmed 2026-06-17 — do not re-litigate)
- **Size copy authoring:** Claude drafts all ~37 weekly rows (comparison object + approximate
  length/weight + development copy), Michael reviews/edits afterward.
- **Dataset row shape — two copy fields:** each row has a one-line `blurb` (hero card) **and** a 2–3
  sentence `detail` (the "This week" section). The card stays clean; "This week" uses `detail`.
- **Prenatal appointment types — reuse as-is:** keep the existing free-text "Appointment Type" field,
  just give it a prenatal placeholder (e.g. "Anatomy scan"). No preset chips in S2.
- **Countdown display — "Week N" + trimester:** show completed weeks (`weeksPregnant`), a trimester
  label (1st = wk 1–13, 2nd = wk 14–27, 3rd = wk 28+), and days-to-go. Not the clinical "Nw Md" style.
- **Card imagery — bundled Twemoji SVGs (confirmed 2026-06-17):** the size card renders a consistent
  Twemoji SVG per emoji (crisp + identical across devices), not the OS glyph. Assets are bundled
  locally under `public/images/twemoji/<codepoint>.svg` (no runtime CDN call — fits the privacy
  posture); fetched one-off via `Frontend/scripts/fetch-twemoji.mjs`. `lib/twemoji.js` maps an emoji
  to its asset; `SizeIcon` in `PregnancyHome` falls back to the native glyph if an asset is missing.
  Twemoji is CC-BY 4.0 → attribution line shown at the foot of the pregnancy page. The per-row `art`
  asset-key still exists so true custom illustrations can replace Twemoji later without a data change.
  (Emoji still repeat within the squash/leafy-green families — only custom art gives 37 distinct images.)
- **Units — both, imperial first:** card shows imperial (in / oz·lb) primary with metric (cm / g)
  secondary, computed in the component; dataset stays single-unit (cm + g).
- **Sex reveal at mark-as-born — extend `markAsBorn`:** when `sex === 'unknown'`, the mark-as-born
  flow also prompts for sex and sends it; `markAsBorn` takes an optional `sex` so birthdate + phase +
  sex land in one write (no follow-up `/baby-profile` save). See the "Mark as born" note in §5.

---

## The size dataset — `Frontend/src/lib/pregnancySizes.js` (new)
One array, weeks ~4 → 40 (≈37 rows). Shape:
```js
// length/weight are approximate (single-unit: cm + g), label is the comparison object, art is an
// asset key, blurb is the card one-liner, detail is the 2–3 sentence "This week" copy.
export const PREGNANCY_SIZES = [
  {
    week: 8, label: 'a raspberry', art: 'raspberry', lengthCm: 1.6, weightG: 1,
    blurb: 'Tiny fingers and toes are starting to form.',
    detail: "Your baby's webbed fingers and toes are taking shape, and the heart is beating fast. " +
            "Facial features are becoming more defined this week.",
  },
  {
    week: 24, label: 'a cantaloupe', art: 'cantaloupe', lengthCm: 30, weightG: 600,
    blurb: 'Tiny taste buds are forming and hearing is developing.',
    detail: "Your baby can now hear your voice and may respond to sound. Taste buds are forming, and " +
            "the inner ear is developed enough to sense which way is up.",
  },
  // ...fill every week 4–40 (Claude drafts all rows, Michael reviews)
];

export function sizeForWeek(week) {
  // exact match, else the nearest defined week at or below
  return PREGNANCY_SIZES.filter(s => s.week <= week).at(-1) ?? PREGNANCY_SIZES[0];
}
```
Display both imperial (in / oz·lb) and metric (cm / g) computed in the component — imperial primary,
metric secondary — so the dataset stays single-unit.

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
5. **"Mark as born"** — give the S1 action a real home here: a primary "Baby's here? Add their
   birthday" button that **confirms**, records the birthdate, and swaps to baby mode (`markBorn` →
   `markAsBorn` endpoint). The mode follows the stored `phase`, never the birthdate, so late/early
   births work. **No casual swap control here** — per S1, reversal is a guarded settings-only undo,
   not an on-screen toggle. Revisiting and adding to pregnancy content after birth is handled by a
   dedicated pregnancy view/tab inside baby mode (still editable, not read-only) — not by flipping
   phase back. (Where that view lives in baby mode is still unspecified — see the open question at
   the bottom of this file.)
   - **Sex reveal at mark-as-born (carried over from S1).** S1's pregnancy onboarding adds a "Not sure
     yet" sex option that stores `sex = 'unknown'` (distinct from "Prefer not to say" → null). The
     baby-mode profile form (`DashboardTab`) has no `unknown` option, so a baby carried over as
     `unknown` shows a blank/first dropdown value until the parent edits it — the stored `unknown`
     persists until then. In the mark-as-born flow here, **when `sex === 'unknown'`, also prompt for
     the baby's sex** (Boy / Girl / Prefer not to say) alongside the birthdate, so the reveal is
     captured at the natural moment instead of leaving a stale `unknown`. If sex is already known
     (`boy`/`girl`) or deliberately `""`, don't ask. **Decided (2026-06-17):** extend the backend
     `markAsBorn` to take an optional `sex` so birthdate + phase + sex land in one write — no
     follow-up `/baby-profile` save. The `mark-born` endpoint accepts an optional `sex` in the body;
     when present and valid it's included in the UPDATE, otherwise sex is left untouched.

### Wiring
- `CradleHq.jsx` switches on `phase` (`profilePhase`): `pregnancy` → `<PregnancyHome>`, `baby` →
  existing app.
- Reuse `daysUntilDue` / `weeksPregnant` from `lib/pregnancy.js`.

---

## Testing checklist
- [ ] `sizeForWeek` returns the right row for exact + in-between weeks (unit test)
- [ ] Set a due date ~16 weeks out → home shows "Week 24", cantaloupe card, correct countdown
- [ ] Length/weight render in both imperial (primary) + metric (secondary)
- [ ] Trimester label is correct at boundaries (wk 13 = 1st, wk 14 = 2nd, wk 27 = 2nd, wk 28 = 3rd)
- [ ] `blurb` shows on the hero card; `detail` shows in "This week"
- [ ] Emoji fallback renders for every row (no SVG/PNG art ships in S2)
- [ ] Prenatal appointments add/list/delete works (same as baby-mode appointments)
- [ ] "Mark as born" confirms, then swaps to baby mode (S1 behavior, now reachable here); no casual
      swap control is present on the pregnancy home
- [ ] Mark-as-born with `sex === 'unknown'` prompts for sex and saves it in one write; with a known
      sex it does not prompt
- [ ] Edge weeks: week < 4 and week ≥ 40 render sensibly (clamped)

## Out of scope
- Bump photo diary + storybook tie-in — S3.
- Turning the size card into a downloadable/shareable *image* — `plans/social-sharing/`.

## Decided — baby-mode pregnancy view location (2026-06-16)
Baby mode gets a **dedicated way to view and keep editing pregnancy content** (bump diary +
pre-birth journal entries) without switching the whole app back to pregnancy mode — it stays
**editable, not read-only**. **Location: a new pill in the existing Memories tab** (`MemoriesTab`,
which already groups Journal + First Times via `PillNav`) — a "Bump"/"Pregnancy" sub-view, shown
only once a profile has pregnancy data. Built in S3 as the same editable bump-diary component used on
the pregnancy home, just mounted here too. (`due_date`/pregnancy entries exist regardless of phase,
so this pill is data-gated, not phase-gated.)
