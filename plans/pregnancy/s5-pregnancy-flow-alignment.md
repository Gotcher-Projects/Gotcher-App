# S5 — Pregnancy Flow Alignment + Polish

**Status: Not started**
**Branch:** `pregnancy-updates`
**Depends on:** S3 complete (pregnancy home + bump diary exist). Independent of S4 (storybook tie-in)
— can run before or after it.

---

## Context
S1–S3 stood up pregnancy mode quickly to prove the flow. It works, but it was built as one
single-scrolling screen and doesn't match the structure / look of the established **baby flow**
(tabbed shell: Dashboard / Memories / Track / Health / Discover, with shared `Card` / `font-display`
headers / `PillNav` patterns). This session makes pregnancy mode feel like the same app, unifies the
bump diary and the (pregnancy) journal into one surface, and adds the date-driven week behavior.

> Michael confirmed S3's basics look good (2026-06-17) — this is intentional polish, not a bug fix.

## Decisions (confirmed 2026-06-17 — do not re-litigate)
- **Pregnancy mode becomes a tabbed shell mirroring the baby flow** — same `<Tabs>` component/styling
  as baby mode. **Three tabs: Home · Appointments · Bump.**
  - **Home** = the countdown ("how long to go"), the size card, and "what the baby does" (the
    `detail` / "this week" development copy), plus the **mark-as-born** card. (≈ today's `PregnancyHome`
    top sections, minus appointments/bump which become their own tabs.)
  - **Appointments** = the prenatal appointments screen (reuse `AppointmentTab` as today).
  - **Bump** = the bump diary.
- **The bump diary IS the pregnancy journal — there is NO separate pregnancy journal.** Journal and
  bump are mechanically the same entry (dated, week-tagged, photo + text); we do not build two
  near-identical surfaces. To let the bump diary also hold photo-less "story" moments ("we found out,"
  "first kick," heard the heartbeat), **the photo becomes optional** and `BumpCard` gains a text-only
  variant matching the baby journal's no-image card.
- **"Journal/UI parity"** = restyle the pregnancy screens + diary cards to the baby-flow vocabulary
  (card shells, `font-display` headers, action bars, empty states), so the two modes look like one
  product. Keep `BumpCard` reusable (S4 / social still consume it).

## Open questions — RESOLVED at session start (2026-06-18, with Michael)
1. **Shell:** extract a new **`PregnancyShell.jsx`** that owns the `<Tabs>` (Home/Appointments/Bump);
   trim `PregnancyHome` to Home-tab content; `CradleHq` renders `<PregnancyShell>`. (Keeps `CradleHq`
   from bloating — it's already ~830 lines.)
2. **Title on bump entries:** **No** — the "Week N · <size> 🍈" line is the de-facto heading. Deferred
   to tech debt (`plans/techdebt.md` → "Bump entries — optional title") to debate later.
3. **Week field:** **derived-but-overridable**, strictly **one-directional Date → Week** (changing Week
   never back-edits Date).
4. **Derivation reference date:** `dueDate || birthdate`. Birthdate ≈ due date, and baby mode always
   has a birthdate (mark-as-born requires it), so there is **no "missing reference" case** to fall back
   from. `week = weeksPregnant(dueDate || birthdate, entryDate)` (already clamps to [0,42]).
5. **Auto-advance week after save:** **drop it entirely** — incoherent once week is date-derived, and
   not the journal model.
6. **Memory storage:** **two tables, unchanged.** `bump_photos` is the canonical pre-birth memory
   store; `journal_entries` stays baby-only (NO `phase` column). Conflating the gestational vs.
   age-relative `week` axes is what caused the storybook period-filter ambiguity. If a unified
   bump→baby timeline is ever needed, solve it at the **read seam** (shared `{date,week,phase,photo,
   text}` shape), not by merging storage. Noted in `plans/techdebt.md` + `storybook-v2/pregnancy-track.md`.

---

## Work stream A — tabbed shell + UI parity

- **Shell:** when `phase === 'pregnancy'`, render a `<Tabs>` shell (Home / Appointments / Bump) in the
  same style as baby mode's `<Tabs>` in `CradleHq.jsx` (likely a `PregnancyShell` mirroring how baby
  mode is laid out). Trim `PregnancyHome.jsx` to the **Home** tab content (countdown + size + this
  week + mark-as-born); move appointments and bump diary to their own tab panels.
- **Parity pass:** reconcile spacing, headers, button styles, empty states, and card treatments across
  the Home / Appointments / Bump tabs with the baby-flow equivalents.
- **Bump-as-journal change:**
  - Backend: new migration making `bump_photos.image_url` **nullable**; relax `BumpPhotoService.create`
    (drop the hard `imageUrl is required`). Require **at least a photo OR a note** so empty entries
    can't be saved (mirrors journal's "title or story" guard).
  - `BumpCard`: add a **text-only variant** (no-photo) styled like the baby journal's no-image card;
    keep the photo-forward portrait/landscape variants.
  - `BumpDiary` add/edit form: photo no longer required; the note becomes a first-class field.
  - **Open (decide at session start):** add an optional **title** to bump entries for fuller journal
    parity (journal cards lead with a title), or keep note-only? Lean note-only to avoid a column +
    scope creep, but flag for Michael.
- The **baby-mode "Bump" pill** in `MemoriesTab` is unchanged in placement; it benefits from the same
  optional-photo + text-only card automatically.

## Work stream B — derive the week from the entry's date

Michael: *"if I change the date to a certain date it should figure out the week from that point on."*

- The helper already exists: `weeksPregnant(dueDate, refDate)` in `lib/pregnancy.js` takes a reference
  date. So for a bump entry dated `D`: `week = weeksPregnant(profile.dueDate, new Date(D))`.
- **Behavior to build (confirm details at session start):** in the bump diary add/edit form, when the
  **Date** changes, auto-derive **Week** from the due date. This replaces the current independent
  Week field default (and supersedes the `firstEmptyWeek` baby-mode default — picking the date the old
  photo was taken now auto-fills the right week when backfilling).
  - Decide: is Week now fully **derived (read-only/disabled)**, or **derived-but-overridable** (auto-
    fills on date change, still editable)? Lean derived-but-overridable unless Michael wants it locked.
  - Edge cases: no/blank date (fall back to current week or leave blank?); date outside 4–40 weeks
    (clamp, same as `sizeForWeek`); baby mode where `weeksPregnant` would read past-due for a recent
    date — derivation is from `dueDate`, so an old taken-date still yields the correct historical week.
- Check whether the same date→week derivation should apply anywhere else that pairs a date with a week
  (e.g. journal entries also carry a `week`) — confirm scope with Michael; default to bump diary only.

---

## Build order (settled 2026-06-18)

Lower-risk, self-contained data/logic changes first; the shell restructure (mostly moving existing
JSX) last so it isn't churned by the logic edits.

**1 — Backend: photo-optional bump entries**
- `V37__bump_photos_image_url_nullable.sql` — `ALTER TABLE bump_photos ALTER COLUMN image_url DROP NOT NULL;`
  (verify V36 created it `NOT NULL` first).
- `BumpPhotoService.create` — drop the `imageUrl is required` guard; add a **photo OR note required**
  check (throw if both blank/null). `week` stays required. `update` already tolerates partial patches.

**2 — Frontend: `BumpCard` text-only variant**
- When `imageUrl` is null, render without the aspect image block — a text-only card styled like the
  baby journal's no-image card (size line + date + note). Keep the portrait/landscape photo variants.
  This is consumed by both pregnancy mode and the baby-mode "Bump" pill, so it lands in both at once.

**3 — Frontend: `BumpDiary` form logic (photo optional + Date→Week + drop auto-advance)**
- `AddBumpForm.handleSave`: require **photo OR note** (not photo); allow `imageUrl: null`; disable Save
  only when both photo and note are empty. **Remove** the `setWeek(w => Math.min(40, +w+1))` auto-advance.
- Add a `weekRefDate` prop (`dueDate || birthdate`). On Date change, set Week =
  `weeksPregnant(weekRefDate, new Date(date))` — still editable. Apply to the `BumpEntry` edit form too.
- Retire the `pristine`/`defaultWeek`-sync effect in favour of date-derivation; keep `firstEmptyWeek`
  only as the initial Week when the date is blank.
- Note field promoted to first-class (label/placeholder reflect journal use: feelings / what happened).

**4 — Frontend: `PregnancyShell` + trim `PregnancyHome`**
- New `PregnancyShell.jsx` — `<Tabs>` (Home · Appointments · Bump) mirroring baby-mode `<Tabs>` styling.
- Trim `PregnancyHome` to Home content (countdown + size + this-week + mark-as-born); move appointments
  and bump diary into their own tab panels.
- `CradleHq` renders `<PregnancyShell>` for `phase === 'pregnancy'`, passing `weekRefDate` + existing props.

**5 — Baby-mode parity wiring**
- `MemoriesTab`'s "Bump" pill: pass `weekRefDate` (`dueDate || birthdate`) into `BumpDiary` so backfill
  date→week derivation works in baby mode too.
- Parity pass: reconcile headers, cards, action bars, empty states across the three pregnancy tabs with
  baby-flow conventions.

**6 — Tests + in-app verify**
- Unit: date→week derivation (incl. `dueDate || birthdate` fallback, blank date, out-of-range clamp);
  photo-OR-note guard. Update `bumpDiary.test.js` for the reduced `firstEmptyWeek` role.
- Manual: walk the testing checklist below (no automated coverage on the shell/cards).

## Testing checklist
- [ ] Pregnancy mode renders a `<Tabs>` shell (Home · Appointments · Bump) styled like baby mode
- [ ] Home tab shows countdown + size card + "what the baby does" + mark-as-born
- [ ] Appointments tab = prenatal appointments (add/list/delete) — same as before, now its own tab
- [ ] Migration: `bump_photos.image_url` nullable; existing rows unaffected
- [ ] Bump entry saves with **no photo** (note-only) and renders the text-only card variant
- [ ] Bump entry still saves with a photo (portrait/landscape) as before
- [ ] Empty-everything entry is rejected (photo OR note required)
- [ ] Pregnancy screens + diary cards visually match baby-flow conventions (headers, cards, action bars, empty states)
- [ ] `BumpCard` still reusable, no S4/social regression
- [ ] Changing the Date in the bump add/edit form auto-derives the correct Week from the due date (derived-but-overridable unless decided otherwise)
- [ ] Backfilling in baby mode: setting an old date yields the correct historical week
- [ ] Edge cases: blank date, dates before wk 4 / after wk 40 (clamped sensibly)

## Out of scope
- Storybook tie-in — deferred to Storybook V2 (`plans/storybook-v2/pregnancy-track.md`). Note: S5's
  phase-flagged, date-driven bump-as-journal entries are exactly the pre-birth data that v2 chapter
  consumes — so S5 is the data half, the v2 guided chapter is the rendering half.
- Social-card image generation — `plans/social-sharing/`.
