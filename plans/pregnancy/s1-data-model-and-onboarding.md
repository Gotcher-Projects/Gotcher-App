# S1 — Data Model + Onboarding Phase Choice

**Status: Complete**
**Branch:** `pregnancy-updates`
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
- **`phase` is `NOT NULL`** with a `CHECK (phase IN ('pregnancy','baby'))` constraint and **no
  default** — every INSERT must state the phase explicitly (onboarding always knows it).
  - Migrated in three steps: add column nullable → backfill all existing rows to `'baby'` (the only
    phase we support today) → `SET NOT NULL`.
  - Because no row can ever have a null phase, there is **no date-derived fallback** in
    `profilePhase`. The only "no phase" case is a brand-new user mid-onboarding (`needsOnboarding`),
    not a saved row.
- **`due_date` stays nullable** — a baby-mode profile has no due date; only `phase` is `NOT NULL`.
- New-user onboarding asks "expecting" or "already have your baby", sets the initial `phase`, and
  collects the matching date.
- **No casual swap control.** Phase changes happen through exactly three deliberate paths:
  onboarding, "mark as born", and a guarded settings-only undo. There is no always-visible toggle —
  flipping phase should be hard to do, and impossible to do by accident.
- **"Mark as born"** sets `birthdate` (keeps `due_date`) **and** swaps `phase` to `baby`. It is a
  deliberate, confirmed milestone action, not a toggle.
- **Switching the whole app back to pregnancy mode (baby → pregnancy) is a guarded correction, not a
  feature.** It lives buried in settings behind its own confirmation ("Undo birth announcement? This
  puts CradleHQ back into pregnancy mode."). It exists for mistakes (wrong date, fat-finger,
  early/late birth), not nostalgia.
- **Viewing/keeping up pregnancy content ≠ swapping phase.** After birth, the bump diary +
  pregnancy journal entries stay **fully accessible and editable from inside baby mode** via a
  dedicated pregnancy view (built in S3) — they are **not** made read-only. So "look back at (or add
  to) my bump photos" never requires switching the whole app back to pregnancy mode. Placement is
  decided: a **"Bump"/"Pregnancy" pill in the Memories tab**, data-gated on the profile having
  pregnancy data (see S2). S1 only establishes the principle.
- Both `birthdate` and `due_date` are **protected on the profile-form upsert** (`COALESCE` —
  see Backend) so a form save in one mode never wipes the other mode's date. Clearing a date is its
  own deliberate action, never a side effect of saving the form.

---

## Backend

### Migration — `V35__add_pregnancy_fields_to_baby_profiles.sql`
(Use the next free V-number; V34 is the latest at time of writing.)
```sql
ALTER TABLE baby_profiles ADD COLUMN due_date DATE;          -- nullable: baby profiles have no due date

-- phase: add nullable, backfill every existing row to 'baby' (the only phase we support today),
-- then lock it to NOT NULL. No default — every INSERT must state the phase explicitly.
ALTER TABLE baby_profiles ADD COLUMN phase VARCHAR(16);
UPDATE baby_profiles SET phase = 'baby' WHERE phase IS NULL;
ALTER TABLE baby_profiles ALTER COLUMN phase SET NOT NULL;
ALTER TABLE baby_profiles ADD CONSTRAINT phase_valid CHECK (phase IN ('pregnancy','baby'));
```
`due_date` stays nullable. After the backfill no profile row can have a null `phase`, so the
frontend needs no legacy fallback. The whole migration runs in one transaction — if any row still
had a null phase after the backfill, `SET NOT NULL` fails and the migration rolls back (won't happen
given the backfill, but that's the failure mode).

### `com.gotcherapp.api.baby` (`BabyProfileService` + DTOs)
The existing service already establishes the pattern we want: alongside the big `upsert`, it has
narrow single-column writers (`updateBookTheme`, `uploadCoverPhoto`, `updateCoverSubtitle`) that
change one field without disturbing the rest. Phase changes follow that precedent — they are **not**
routed through the upsert.

- Add `dueDate` (`String`/ISO) + `phase` to `BabyProfileResponse`, `BabyProfileRequest`, and the
  `SELECT` + `mapRow` in `getProfile`.

- **`upsert` — INSERT carries `phase`; UPDATE never touches it; both dates are COALESCE-protected.**
  ```sql
  INSERT INTO baby_profiles (user_id, baby_name, birthdate, parent_name, phone, sex, due_date, phase)
  VALUES (?, ?, ?::date, ?, ?, ?, ?::date, ?)
  ON CONFLICT (user_id) DO UPDATE SET
      baby_name   = EXCLUDED.baby_name,
      birthdate   = COALESCE(EXCLUDED.birthdate, baby_profiles.birthdate),
      due_date    = COALESCE(EXCLUDED.due_date,  baby_profiles.due_date),
      parent_name = EXCLUDED.parent_name,
      phone       = EXCLUDED.phone,
      sex         = EXCLUDED.sex,
      updated_at  = NOW()              -- NOTE: phase deliberately absent from the UPDATE list
  RETURNING ...
  ```
  - `phase` is in the INSERT (onboarding is the first save → INSERT path; `phase` is `NOT NULL` with
    no default, so it must be supplied) but **omitted from the UPDATE** — a normal profile-form save
    can never change phase.
  - Both dates use `COALESCE(EXCLUDED.x, baby_profiles.x)`: a baby-mode form save (no due date)
    won't wipe a preserved `due_date`, and a pregnancy-mode save (no birthdate) won't wipe a
    `birthdate`. The form only ever *sets* a date it actually carries.
  - Validate `phase ∈ {pregnancy, baby}` and non-null in the service before the upsert (mirror the
    existing `VALID_THEMES` guard → clean 400, with the DB `CHECK` as backstop).

- **`updatePhase(userId, phase)`** — dedicated narrow writer, a copy of `updateBookTheme`
  (incl. `VALID_PHASES` validation): `UPDATE baby_profiles SET phase = ?, updated_at = NOW()
  WHERE user_id = ?`. Backend primitive for the guarded settings-only reversal. Not wired to any
  casual toggle.

- **`markAsBorn(userId, birthdate)`** — one statement, sets birthdate + swaps to baby in a single
  write, preserves `due_date` by not touching it:
  ```sql
  UPDATE baby_profiles SET birthdate = ?::date, phase = 'baby', updated_at = NOW() WHERE user_id = ?
  ```

- Controller: add the two small endpoints (locked 2026-06-17): `POST /baby-profile/mark-born`
  (body `{ birthdate }`) → `markAsBorn`, and `POST /baby-profile/phase` (body `{ phase }`) →
  `updatePhase` (guarded reversal). No phase ever flows through the `/baby-profile` upsert's update path.

---

## Frontend

### Date / phase helpers — `Frontend/src/lib/pregnancy.js` (new)
```js
const GESTATION_DAYS = 280; // 40 weeks; due date = LMP + 280d

// 'pregnancy' | 'baby' | 'incomplete'
// phase is NOT NULL on every saved row, so the stored value always wins. 'incomplete' only
// covers a brand-new user mid-onboarding (no saved profile yet) — not a persisted row.
export function profilePhase(profile) {
  return profile?.phase ?? 'incomplete';
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
- Add two small action helpers that hit the dedicated endpoints (NOT the profile upsert) and update
  local state: `markBorn(birthdate)` → `markAsBorn` endpoint; `undoBirth()` → `updatePhase('pregnancy')`.
  These are the only client-side paths that change phase post-onboarding. There is no generic
  always-available `swapPhase` toggle.

### Onboarding — phase choice
The onboarding gate today is `needsOnboarding` (null=loading / true=no profile / false=has profile).
Update the onboarding form (wherever `needsOnboarding === true` renders) to a two-step start:

1. **"Where are you in the journey?"** → two big choices: **Expecting** / **Already have my baby**.
2. Based on the choice, set `phase` (`pregnancy` / `baby`) and collect either a **due date**
   (expecting) or a **birthdate** (have baby), plus the existing baby/parent fields. Save via the
   existing `/baby-profile` upsert.

Result: an "expecting" user lands in pregnancy mode (placeholder for now); a "have baby" user lands
in the current app exactly as today.

### "Mark as born" transition
An action available in pregnancy mode (placeholder location for S1; S2 gives it a real home) that
**confirms**, prompts for the birthdate, then calls `markBorn(birthdate)`. It sets `birthdate`,
swaps `phase` to `baby`, and preserves `due_date`. This is a deliberate milestone — confirmation
required, not a toggle.

### Guarded reversal (baby → pregnancy)
There is **no casual swap control.** The only way back is a buried, settings-only action behind its
own confirmation ("Undo birth announcement? This puts CradleHQ back into pregnancy mode.") that calls
`undoBirth()` → `updatePhase('pregnancy')`. It exists for mistakes, not nostalgia; "look back at bump
photos" is handled later (S2/S3) as read-only history inside baby mode, without re-entering pregnancy
mode. For S1 a placeholder location is fine — just ensure it's confirmed and not prominent.

---

## Testing checklist
- [ ] Migration applies; existing profiles backfill to `phase = 'baby'` with `due_date = null` and
      still work; CHECK constraint rejects any phase outside `('pregnancy','baby')`
- [ ] `/baby-profile` GET returns `dueDate` + `phase`; upsert round-trips them without clobbering
      `birthdate` / each other
- [ ] `profilePhase` returns the stored phase for any saved row; `'incomplete'` only pre-onboarding
- [ ] `weeksPregnant` / `daysUntilDue` unit tests pass
- [ ] New user picking "Expecting" + due date → `phase = pregnancy` → loads pregnancy placeholder
- [ ] New user picking "Already have my baby" + birthdate → `phase = baby` → current app unchanged
- [ ] Profile-form save in baby mode does NOT wipe a preserved `due_date`; save in pregnancy mode
      does NOT wipe `birthdate` (both COALESCE-protected); profile save never changes `phase`
- [ ] "Mark as born" sets birthdate, preserves due_date, swaps to baby mode (via dedicated endpoint)
- [ ] Guarded settings-only undo returns to pregnancy mode; no casual/always-visible swap exists
- [ ] Existing baby-mode users (backfilled to `phase = 'baby'`) see no behavior change

## Out of scope
- Pregnancy home screen, size card, dataset, illustrations — S2.
- Bump diary, storybook tie-in — S3.
