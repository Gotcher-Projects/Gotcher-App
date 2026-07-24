-- sv2-s8.5: retire the freeform "period chapter" model. A freeform book is now a single flat page
-- sequence (one storybook_chapters row per book, anchor_type='freeform'); the period wizard and its
-- anchor_type='period' chapters are gone. Pre-prod clean break (D4) — existing period chapters are
-- deleted, not converted. Guided chapters (anchor_type='guided') are untouched.
DELETE FROM storybook_chapters WHERE anchor_type = 'period';

-- Any freeform book whose only content was period chapters is now an empty shell; drop those so the
-- freeform tab never opens a chapterless book. New freeform books get their 'freeform' chapter seeded
-- at creation (BookService.seedFreeformChapter). Guided books always keep their materialised arc rows.
DELETE FROM books b
 WHERE b.type = 'freeform'
   AND NOT EXISTS (SELECT 1 FROM storybook_chapters c WHERE c.book_id = b.id);
