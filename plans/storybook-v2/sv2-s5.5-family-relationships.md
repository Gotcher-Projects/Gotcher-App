# SV2-S5.5 — Family relationships & editable titles

**Status: Not started.** Refinement of the sv2-s5 family tree baseline. Captures the modelling
problems the hardcoded role→tier mapping leaves open.
**Depends on:** sv2-s5 (Family Tree — Needs Verification) + sv2-s3 (`family_members` data).
**Reference:** mockup `mockups/s5-family-tree.html`; the shipped `FamilyMember` model + `inferCategory`.

---

## Why this exists

sv2-s5 shipped a working tree, but the way people map onto it is too crude to be correct for real
families. Three problems, surfaced in review (2026-06-27):

1. **Tier placement is guessed from role text, and which *side* a grandparent belongs to is
   effectively hardcoded.** `FamilyRosterPopup.inferCategory(role)` buckets a person into
   `parent | sibling | grandparent | other` by regex on free-text role (`/(nana|pop|gran|nan|grand)/`
   → grandparent, etc.). The tree then fills grandparent **slots 0–1 = "maternal" / over Mum** and
   **slots 2–3 = "paternal" / over Dad** purely by **roster order** — there is no real "whose parent
   is this" link. So "Nana & Pop" landing under Dad vs Mum is an accident of ordering, not data. A
   parent looking at the tree can't tell the app *"Nana is Mum's mum."*

2. **No model for step-parents / step-grandparents** (or more than two parents, blended families).
   The tree assumes exactly Mum + Dad and 4 grandparents in 2 neat pairs. Step-relations, single
   parents with >2 grandparent figures, two mums/two dads, etc. have nowhere to go.

3. **Role is doing two jobs at once: the *relationship* and the *display title*.** Today `role` is one
   free-text field ("Nana"). But "Nana" is a chosen **nickname**, not the relationship — the
   relationship is *"Mum's mother."* Multiple people legitimately go by different titles for the same
   relationship (Nana / Grandma / Oma / Lola …), and parents themselves may want **Mum / Mom / Mama /
   Papa / Dad** as a display title separate from "the mother/father." The current single field can't
   express *"this person is Mum's father, and she calls him Pop."*

> The current behaviour is **a reasonable baseline** (it produces a correct-looking tree for the
> common Mum + Dad + 4-grandparents case) — this plan is the deliberate follow-up to make it *true to
> the family*, not a bug-fix of s5.

---

## The direction (to refine when this is picked up — NOT yet decided)

Sketch only; the real design discussion happens at the start of this session.

### A. Separate "relationship" from "display title"
- Keep a **display title** field (free text + presets) — what the book prints ("Nana", "Mum",
  "Pop"). This is roughly today's `role`.
- Add a **relationship** the tree actually uses for placement. Options to weigh:
  - a structured enum (`mother | father | parent | grandmother-maternal | grandfather-paternal |
    sibling | …`) — precise but rigid, awkward for blended families;
  - a **link to another member** (`parentOf` / `childOf` edges) — "Nana is the mother **of** Sarah
    (Mum)" — flexible, models steps & blends naturally, but is a bigger data + UI lift (it's a graph,
    not a flat list);
  - a hybrid: a coarse tier (parent / grandparent / sibling / other) **plus** an optional
    `side`/`linkedParentId` so grandparents attach to the right parent.
- **Lean (to confirm):** the **linked-parent** approach for grandparents (`grandparent → which
  parent`) is the smallest change that fixes problem #1 honestly, without going full graph.

### B. Step-relations & flexible parents
- Allow **>2 parent-tier people** (step-parents, two mums/dads). The tree's fixed 2-slot parent row
  and 4-slot grandparent row both need to flex (or gracefully spill to a "and more" treatment).
- A **`isStep` / relationship-qualifier** flag, or expressing it through the linked-relationship model
  above. Decide whether steps render inline in the tree or in a secondary band.

### C. Editable titles for everyone (incl. parents)
- Parents get the same **display-title** freedom as everyone else (Mum / Mom / Mama / Papa…), shown
  on People pages + the tree, decoupled from their structural role.
- Title presets stay (chips), but the structural relationship is what drives layout.

---

## Likely scope when started

| Area | Change |
|---|---|
| Schema | Add fields to `family_members` (e.g. `display_title`, `relationship`/`linked_member_id`, `is_step`) via a new migration; backfill from existing `role`/`role_category`. |
| Backend | `com.gotcherapp.api.family` DTOs + service columns; keep `roleCategory` for back-comat or derive it. |
| Roster UI | `FamilyRosterPopup`: split role into **display title** + **relationship** (and for grandparents, a "whose parent?" picker); step toggle. |
| Tree | `FamilyTreeCanvas`: place grandparents by their **linked parent** instead of slot order; handle >2 parents / step bands / overflow. |
| People page | `PeopleCanvas`: show the display title; unaffected by structural changes otherwise. |

---

## Out of scope (stays in sv2-s5 baseline)
- The tree's visual style, SVG-lines-+-HTML-nodes render approach, and PDF capture path — all keep.
- Extended family beyond grandparents (aunts/uncles/great-grandparents) — still `other`, People-page
  only, per planning.md Group D.

---

## Open questions (resolve at session start)
1. Structured enum vs linked-member edges vs hybrid for the relationship model (see §A).
2. How many parent-tier people to support, and how steps render (inline vs a separate band).
3. Migration/backfill: can we infer `linked_member_id` for existing rosters, or do users re-link?
4. Does the guided book (sv2-s7) need the richer model before it ships, or can it consume the s5
   baseline and adopt this later?
