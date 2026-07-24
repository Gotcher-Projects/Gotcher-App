# Pregnancy Mode — Session Entry Prompts

## S1 — Data Model + Onboarding Phase Choice
```
We're starting S1 of the pregnancy plan: plans/pregnancy/s1-data-model-and-onboarding.md
Goal: add `due_date` to baby_profiles end-to-end (migration + BabyProfile record/repo/service/controller),
add a phase-derivation helper (pregnancy vs baby), update onboarding so new users pick
"expecting" or "already have your baby," and add a "mark as born" transition. No pregnancy
content/UI yet — S2 builds the home screen. Follow the plan step by step.
```

## S2 — Pregnancy Home + Size/Development Dataset
```
S1 of the pregnancy plan is complete. We're starting S2: plans/pregnancy/s2-pregnancy-home-and-size-dataset.md
Goal: build the pregnancy home screen for profiles in pregnancy mode — due-date countdown, the
weekly "size of your baby" card with simple illustrations, and the week-by-week development blurb,
all driven by one ~37-row size dataset. Surface the existing appointments feature as prenatal
visits. Follow the plan step by step.
```

## S3 — Bump Photo Diary
```
S2 of the pregnancy plan is complete. We're starting S3: plans/pregnancy/s3-bump-diary.md
Goal: build the bump photo diary (a weekly belly-photo series, each photo paired with the baby's
size that week) reusing the existing photo upload/crop flow. New bump_photos table + a `bump`
package mirroring `firsttimes`, and one editable BumpDiary component mounted on the pregnancy home
and as a data-gated "Bump" pill in the Memories tab. Storybook tie-in is now S4. Follow the plan
step by step.
```

## S4 — Storybook Pregnancy Tie-in — DEFERRED → Storybook V2
```
S4 is no longer built here. The pregnancy → storybook tie-in is built against the v2 Guided Book
(data-derived, fixed-layout page types), where it mirrors the Firsts chapter instead of retrofitting
the scrapbook wizard + L-Wrap. See plans/storybook-v2/pregnancy-track.md. It depends on the v2 guided
book shell (sv2-s6) and the Letter component (sv2-s1), and consumes the phase-flagged pre-birth
journal data produced by pregnancy S5. Re-discuss as part of the v2 re-talk before speccing sessions.
```

## S5 — Pregnancy Flow Alignment + Polish
```
We're starting S5 of the pregnancy plan: plans/pregnancy/s5-pregnancy-flow-alignment.md
Goal: bring pregnancy mode (PregnancyHome + bump diary) visually/structurally in line with the
established baby flow, and derive the bump-entry Week from its Date (via weeksPregnant(dueDate, date)).
Independent of S4. START by settling the shell/structure question and the derived-vs-overridable Week
behavior with Michael before coding. Follow the plan step by step.
```
