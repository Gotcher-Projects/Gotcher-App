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

## S3 — Bump Photo Diary + Storybook Tie-in
```
S2 of the pregnancy plan is complete. We're starting S3: plans/pregnancy/s3-bump-diary-and-storybook.md
Goal: build the bump photo diary (a weekly belly-photo series, each photo paired with the baby's
size that week) reusing the existing photo upload/crop flow, and wire bump photos + pregnancy
journal/first-time entries into the existing storybook so the book runs continuously from bump to
baby. Follow the plan step by step.
```
