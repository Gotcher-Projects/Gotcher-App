# Pregnancy Feature — Context Primer

> **Purpose:** A short, accurate briefing on the CradleHQ "bump-to-baby" pregnancy mode.
> **Last verified against commit `4dc23e9`** (branch `pregnancy-updates`, 2026-06-21).

---

## 1. Phase model — one app, two modes

A baby profile carries a **`phase`** (`'pregnancy' | 'baby'`), NOT NULL on every saved row, so
the stored value always wins. `profilePhase(profile)` (`lib/pregnancy.js`) returns it, falling
back to `'incomplete'` only for a brand-new user mid-onboarding (no saved row yet).

The main shell `components/CradleHq.jsx` routes on phase:
- **`pregnancy`** → pregnancy home (`PregnancyShell` / `PregnancyHome` + bump diary).
- **`baby`** → the full baby-tracking app (tabs, storybook, etc.).

Onboarding picks the phase: choosing **"Expecting"** + a **due date** → `phase = 'pregnancy'`;
**"Already have my baby"** + a **birthdate** → `phase = 'baby'`. A pregnancy profile later
transitions to `baby` once the baby arrives (set birthdate).

## 2. Due-date → week math (`lib/pregnancy.js`)

Pure, timezone-stable (plain millisecond subtraction, no `setDate`):
- `GESTATION_DAYS = 280` (40 weeks); **due date = LMP + 280d**, so LMP is derived from the due date.
- `weeksPregnant(dueDate, today?)` → whole weeks pregnant, clamped to `[0, 42]`.
- `daysUntilDue(dueDate, today?)` → `ceil` days remaining.
- `trimester(week)` → `1` (wk 1–13) / `2` (wk 14–27) / `3` (wk 28+).

> **Date → Week derivation:** the app stores the **due date** (a single anchor) and derives the
> current week from it on every render. It does not store a mutable "current week".

## 3. Size dataset (`lib/pregnancySizes.js`)

- `PREGNANCY_SIZES` — one row per gestational week (fruit/veg comparison + length + weight).
- `sizeForWeek(week)` → the row for a week (handles in-between weeks).
- `formatLength(cm)` / `formatWeight(g)` — imperial-primary, metric-secondary display.

## 4. Components (`components/pregnancy/`)

| File | Role |
|------|------|
| `PregnancyShell.jsx` | Pregnancy-mode shell/nav. |
| `PregnancyHome.jsx` | "Week N" home: size card (`sizeForWeek`), countdown (`daysUntilDue`), trimester. |
| `BumpCard.jsx` | Compact week/size summary card. |
| `BumpDiary.jsx` | The **bump diary** — dated photo + note entries tracking the pregnancy. |

The **bump diary** is reachable from both pregnancy mode and (after the baby arrives) the baby
app, so the pregnancy record isn't lost on the phase transition.

## 5. Plans & status

Plans live in `plans/pregnancy/` (`s1`–`s5` + `README.md`). Check each plan's **Status** before
working it (see root `CLAUDE.md`). Display dates use `formatDate`/`formatMonthYear`
(`lib/formatting.js`); pure week/size helpers are unit-tested (`test/pregnancy.test.js`,
`test/pregnancySizes.test.js`, `test/bumpDiary.test.js`).
