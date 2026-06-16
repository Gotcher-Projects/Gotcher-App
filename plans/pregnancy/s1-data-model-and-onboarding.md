# S1 — Data Model + Onboarding Phase Choice

**Status: Not started**
**Branch:** TBD (suggest `feature/pregnancy-mode`)
**Depends on:** nothing — this is the foundation. No pregnancy UI/content ships here.

---

## Context
CradleHQ starts at birth. To support "one profile, two phases" we give `baby_profiles` a `due_date`
and an explicit, **user-controlled `phase`** field, and let a *new* user declare up front whether
they are **expecting** or **already have their baby**. The phase is something the user *swaps*, not
something inferred from the birthdate — so a late/early birth, or wanting to revisit the bump diary
after birth, never traps them in the wrong mode. This session is plumbing only — the pregnancy home
screen and content come in S2. Verify by toggling a profile's phase and seeing the right mode load
(even if pregnancy mode is just a placeholder for now).

## Decisions (confirmed 2026-06-16 — do not re-litigate)
- One profile, two phases. `due_date` **and** `phase` added to the existing `baby_profiles` row (no
  new table).
- **Phase is a stored, user-controlled field — NOT auto-derived from the birthdate.** `birthdate`
  and `due_date` are data; the active mode is whatever `phase` says.
  - `phase = 'pregnancy'` → pregnancy mode; `phase = 'baby'` → baby mode.
  - Legacy/empty `phase` → fall back to a derived guess (`birthdate` → `baby`, else `due_date` →
    `pregnancy`, else `incomplete`) so existing users are unaffected.
- New-user onboarding asks "expecting" or "already have your baby", sets the initial `phase`, and
  collects the matching date.
- A **swap control** lets the user move between modes at any time.
- "Mark as born" sets `birthdate` (keeps `due_date`) **and** swaps `phase` to `baby` — but the swap
  is reversible.

---

## Backend

### Migration — `V35__add_pregnancy_fields_to_baby_profiles.sql`
(Use the next free V-number; V34 is the latest at time of writing.)
```sql
ALTER TABLE baby_profiles ADD COLUMN due_date DATE;
ALTER TABLE baby_profiles ADD COLUMN phase    VARCHAR(16);  -- 'pregnancy' | 'baby' | NULL (legacy)
```
Both nullable. Existing baby-mode profiles keep `due_date = NULL` and `phase = NULL`; the frontend
fallback (see helper) treats a null `phase` with a birthdate as baby mode, so they're unaffected.

### `com.gotcherapp.api.baby` (BabyProfile)
- Add `dueDate` (`LocalDate`) and `phase` (`String`) to the `BabyProfile` record.
- Repository: include `due_date` + `phase` in the SELECT column list, the INSERT, and the UPDATE
  (the profile upsert). Map both in the `RowMapper`.
- Service / controller: thread `dueDate` + `phase` through the `/baby-profile` GET response and the
  create/update request DTO. No new endpoints — the existing upsert handles the swap (the frontend
  just PATCHes `phase`).

> ⚠️ The profile is an **upsert** keyed on `user_id` (UNIQUE). Make sure adding columns to the
> UPDATE branch does not blow away `birthdate` / `due_date` / `phase` when only one is supplied —
> patch semantics: only overwrite a column when the request actually carries a value. (The phase
> swap must not wipe the dates.)

---

## Frontend

### Date / phase helpers — `Frontend/src/lib/pregnancy.js` (new)
```js
const GESTATION_DAYS = 280; // 40 weeks; due date = LMP + 280d

// 'pregnancy' | 'baby' | 'incomplete'
// The stored phase wins; fall back to a date-derived guess only for legacy profiles
// that predate the phase column (phase == null).
export function profilePhase(profile) {
  if (profile?.phase === 'pregnancy' || profile?.phase === 'baby') return profile.phase;
  if (profile?.birthdate) return 'baby';
  if (profile?.dueDate) return 'pregnancy';
  return 'incomplete';
}

// Whole weeks pregnant today, from the due date. Clamp to [0, 42].
export function weeksPregnant(dueDate, today = new Date()) {
  const due = new Date(dueDate);
  const lmp = new Date(due); lmp.setDate(lmp.getDate() - GESTATION_DAYS);
  const days = Math.floor((today - lmp) / 86400000);
  return Math.max(0, Math.min(42, Math.floor(days / 7)));
}

export function daysUntilDue(dueDate, today = new Date()) {
  return Math.ceil((new Date(dueDate) - today) / 86400000);
}
```
Add unit tests in `Frontend/src/test/pregnancy.test.js` (pure functions — easy to cover, unlike the
render paths).

### `CradleHq.jsx`
- Extend the `profile` state object with `dueDate: ""` and `phase: ""`.
- `/baby-profile` fetch + `saveProfile()`: read/write `dueDate` + `phase` (snake/camel per existing
  pattern).
- Compute `phase = profilePhase(data.profile)` and pass it down. For S1, pregnancy mode can render a
  simple placeholder ("Pregnancy mode — coming in S2") gated on `phase === 'pregnancy'`; baby mode
  is the existing app unchanged.
- Add a lightweight `swapPhase(next)` that PATCHes `phase` to `/baby-profile` and updates local
  state — used by the swap control and "mark as born".

### Onboarding — phase choice
The onboarding gate today is `needsOnboarding` (null=loading / true=no profile / false=has profile).
Update the onboarding form (wherever `needsOnboarding === true` renders) to a two-step start:

1. **"Where are you in the journey?"** → two big choices: **Expecting** / **Already have my baby**.
2. Based on the choice, set `phase` (`pregnancy` / `baby`) and collect either a **due date**
   (expecting) or a **birthdate** (have baby), plus the existing baby/parent fields. Save via the
   existing `/baby-profile` upsert.

Result: an "expecting" user lands in pregnancy mode (placeholder for now); a "have baby" user lands
in the current app exactly as today.

### Phase swap control
Add a small control (placeholder location for S1; S2 gives it a real home) that calls
`swapPhase(...)` to move between pregnancy and baby mode at will. This is the user-controlled switch
— the mode follows `phase`, never the birthdate.

### "Mark as born" transition
Add an action available in pregnancy mode (placeholder location for S1; S2 gives it a real home)
that prompts for the birthdate, saves it, **and** swaps `phase` to `baby`. It is **reversible** via
the swap control. Confirm `due_date` is preserved and the swap doesn't wipe any dates.

---

## Testing checklist
- [ ] Migration applies; existing profiles read back with `due_date`/`phase = null` and still work
- [ ] `/baby-profile` GET returns `dueDate` + `phase`; upsert round-trips them without clobbering
      `birthdate` / each other
- [ ] `profilePhase` returns the stored phase when set; falls back correctly when `phase` is null
- [ ] `weeksPregnant` / `daysUntilDue` unit tests pass
- [ ] New user picking "Expecting" + due date → `phase = pregnancy` → loads pregnancy placeholder
- [ ] New user picking "Already have my baby" + birthdate → `phase = baby` → current app unchanged
- [ ] Swap control moves between modes both directions; dates preserved each way
- [ ] "Mark as born" sets birthdate, preserves due_date, swaps to baby mode — and is reversible
- [ ] Existing baby-mode users (null phase) see no behavior change

## Out of scope
- Pregnancy home screen, size card, dataset, illustrations — S2.
- Bump diary, storybook tie-in — S3.
