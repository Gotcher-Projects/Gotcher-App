# Tech Debt

## Pregnancy size card — swap Twemoji for custom art
**Status:** Not started
**Context:** The weekly "size of your baby" card (`PregnancyHome.jsx` → `SizeIcon`) currently renders bundled **Twemoji SVGs** (`public/images/twemoji/`, mapped via `lib/twemoji.js`) as a polish-layer placeholder. It's consistent across devices, but emoji still **repeat within families** (squash 🎃, leafy greens 🥬) so the 37 weeks are not 37 distinct images, and the look is "emoji," not keepsake-grade.

**Future enhancement:** Replace with real custom illustrations — one per week, 37 distinct. The data layer is already ready: each row in `pregnancySizes.js` has a reserved `art` asset-key. Plan is to drop SVG/PNG art into `public/images/pregnancy/<art>.svg` and have `SizeIcon` prefer the `art` asset, falling back to Twemoji, then native emoji. No data-shape change needed. Once custom art ships, the Twemoji CC-BY attribution line at the foot of the pregnancy page can be removed (or kept if any Twemoji remains as fallback).

## Growth Chart Color Picker (Option B)
**Status:** Not started
**Context:** Growth charts currently use `chartColors` defined per-theme in `themes/index.js` (Option A). This is the current implementation.

**Future enhancement:** Add a per-user color picker in a settings panel that lets users override each chart line color independently. Colors would be stored in localStorage alongside the theme preference. Would need:
- A settings/preferences UI (doesn't exist yet)
- A color picker component (e.g. a native `<input type="color">` or a small palette grid)
- Merge logic: theme chartColors as defaults, user overrides on top
- ThemeContext update to expose merged colors

## Bump entries — optional title for fuller journal parity
**Status:** Open question — deferred from pregnancy S5 (2026-06-18)
**Context:** S5 makes the bump diary double as the pregnancy journal (photo optional, note becomes a
first-class field). The baby journal leads each card with a **title**; bump entries do not — the
"Week N · <size> 🍈" line acts as the de-facto title. We deliberately did **not** add a title field
in S5 (it's a migration + form + `BumpCard` change for limited gain).

**Future debate:** decide whether bump/pregnancy-journal entries should gain an optional `title`
column for fuller parity with the baby journal (and richer storybook page headings). Weigh against the
size-line already serving as the heading. Revisit if the v2 "Before You Arrived" chapter wants
per-page titles.

## Pregnancy vs. baby memories — one table or two?
**Status:** Open question — explored in pregnancy S5 (2026-06-18); decided "two tables for now"
**Context:** Pre-birth memories live in `bump_photos` (gestational week 4–40, size pairing, photo
optional after S5, note). Baby memories live in `journal_entries` (age-relative week, title + story,
`entry_date`, image). They overlap ~80% in shape but the **`week` axis means different things**
(gestational vs. age) — conflating them is exactly what caused the storybook period-filter ambiguity.

**Decision (for now):** keep the two tables. `bump_photos` is the canonical pre-birth memory store;
`journal_entries` stays baby-only (no `phase` column). Rationale: shipped + working, clean semantic
separation, avoids re-introducing the week-namespace collision, and the size pairing is intrinsic to
pregnancy.

**Future debate:** if a **unified bump→baby memory timeline** ever becomes a real feature, revisit.
The likely best path is *not* to merge storage (risky migration, re-introduces the week collision)
but to define a **shared "memory" read-shape** (`{ date, week, phase, photo, text }`) that both tables
map into, so consumers (storybook v2, any timeline view) don't care which table a memory came from —
"one place" at the read seam without unifying storage. See `plans/storybook-v2/pregnancy-track.md`.
