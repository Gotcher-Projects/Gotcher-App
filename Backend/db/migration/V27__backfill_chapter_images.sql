-- Backfill image_url for first_time chapters from the linked first_times row
UPDATE storybook_chapters sc
SET image_url = (
    SELECT ft.image_url
    FROM first_times ft
    WHERE ft.baby_profile_id = sc.baby_profile_id
      AND ft.id = CAST(sc.anchor_key AS BIGINT)
      AND ft.image_url IS NOT NULL
    LIMIT 1
)
WHERE sc.anchor_type = 'first_time' AND sc.image_url IS NULL;

-- Backfill image_url for milestone chapters from the nearest journal entry (within ±3 weeks)
UPDATE storybook_chapters sc
SET image_url = (
    SELECT je.image_url
    FROM journal_entries je
    WHERE je.baby_profile_id = sc.baby_profile_id
      AND je.image_url IS NOT NULL
      AND ABS(je.week - CAST(SPLIT_PART(sc.anchor_key, '-', 1) AS INTEGER)) <= 3
    ORDER BY ABS(je.week - CAST(SPLIT_PART(sc.anchor_key, '-', 1) AS INTEGER))
    LIMIT 1
)
WHERE sc.anchor_type = 'milestone' AND sc.image_url IS NULL;

-- Backfill image_url for period chapters from the first journal entry in the period range
UPDATE storybook_chapters sc
SET image_url = (
    SELECT je.image_url
    FROM journal_entries je
    WHERE je.baby_profile_id = sc.baby_profile_id
      AND je.image_url IS NOT NULL
      AND je.week >= sc.period_start_weeks AND je.week <= sc.period_end_weeks
    ORDER BY je.entry_date
    LIMIT 1
)
WHERE sc.anchor_type = 'period' AND sc.image_url IS NULL;
