-- sv2-s9.0b: make the family tree true to the family.
-- `role` stays the DISPLAY TITLE (what the book prints, e.g. "Nana"); `role_category` is now
-- USER-SET (the relationship tier) rather than guessed from the role text. Two new columns close
-- the modelling gaps the sv2-s5 baseline left open:
--   linked_member_id — for a grandparent, WHICH parent they are the parent of, so the tree places
--                      them over the correct parent instead of by roster order (the old accident).
--   is_step          — flags a step-relation (step-parent / step-grandparent). Modelled now; rendered
--                      conservatively for later blended-family layout work.
-- Existing rows keep linked_member_id = NULL (the tree falls back to roster order) and is_step = FALSE,
-- so the change is backward compatible.
ALTER TABLE family_members
  ADD COLUMN linked_member_id BIGINT REFERENCES family_members(id) ON DELETE SET NULL,
  ADD COLUMN is_step          BOOLEAN NOT NULL DEFAULT FALSE;
