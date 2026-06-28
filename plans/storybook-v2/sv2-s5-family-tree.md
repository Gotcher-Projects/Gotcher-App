# SV2-S5 — Family Tree (book page)   *(was sv2-s9; renumbered 2026-06-27)*

**Status: Needs Verification** (implemented 2026-06-27 — `FamilyTreeCanvas` built, wired into builder/
read/PDF + TemplateSheet thumb; frontend build + 248 tests pass. Verify in-app: add it as a page in the
scrapbook builder with people in "Your People", check tree render + PDF export, then mark Complete.)

**Post-baseline fixes (2026-06-27, after first in-app test):**
- **"Edit people" from the tree** — the Family Tree page now shows the same Edit-people button as the
  People page; opens `FamilyRosterPopup` in a new `mode="roster"` (no per-page selection/variant UI).
- **Published/PDF tree was missing grandparents** — `StorybookTab` only fetched `family_members` on
  mount, so people added inside the builder never reached `pageData`. Fixed: it now re-pulls
  birth/family data **on builder close** (`loadPageData`). This fixed both the published view and PDF.
- **Circular avatars in PDF** — added `border-radius:50%` on the `<img>` itself (html2canvas doesn't
  reliably clip a rounded parent's overflow). Re-verify the PDF circles after this.

**Known-rough / deferred → [`sv2-s5.5-family-relationships.md`](sv2-s5.5-family-relationships.md):** the
role→tier mapping is guessed from free-text role and grandparent *side* is roster-order only (Nana/Pop
landing under Dad is hardcoded-ish, not modelled); no step-parent/step-grandparent model; `role` conflates
relationship with display title. That refinement is its own plan.

The family tree is a **page in the default guided book** (the People section —
see the mockups + `planning.md` 2026-06-27 direction update), so it's built **before the shell (sv2-s7)**.
Build it as a book page type (the family-member data
already exists from sv2-s3); a standalone/interactive tree view can come later if wanted.
**Depends on:** sv2-s3 (Your People data — shipped). No longer blocked on the shell.
**Reference:** `planning.md` Q6 + 2026-06-27 direction update.
**Mockup:** `mockups/s5-family-tree.html` (2 designs — classic three-tier + a siblings/initial-fallback
variant; full 600×800 page ratio). Authoritative for the page design.

---

## Decisions locked (2026-06-27)
- **Render scope:** grandparents → parents → baby **+ siblings beside the baby** (Design 2 in the mockup).
  The renderer handles the sibling row + missing-slot / no-photo **initial-circle** fallbacks as data-driven
  behaviour, not a separate variant.
- **Rendering:** inline `<svg>` for connector lines + circular avatars. **No `foreignObject`** (won't
  capture in html2canvas → wouldn't export to PDF).

## Goal

Build a visual family tree that renders the "Your People" data (from sv2-s3) as a connected org-chart style tree: grandparents → parents → baby. This is a dedicated book page type within the guided book's "About You" chapter.

Deferred because it's a significant standalone build and the guided book delivers value without it. The `family_members` data is already collected in sv2-s3.

---

## Concept (from Precious Five research)

The tree shows:
- **Tier 1 (top):** 4 grandparents — maternal grandmother, maternal grandfather, paternal grandmother, paternal grandfather
- **Tier 2 (middle):** 2 parents (or however many are defined in family_members)
- **Tier 3 (bottom):** baby at center

Each node: circular avatar (photo or initial), name below, role label below name.
Connecting lines run between nodes showing the relationships.

---

## Key design questions (resolve before starting)

1. **Rendering approach:**
   - **HTML/CSS flexbox tree** — boxes + CSS borders for lines. Simple, works in html2canvas, limited to symmetric layouts.
   - **SVG** — full control over line drawing, handles asymmetric trees, works in html2canvas. More code.
   - **Canvas/D3** — overkill for this fixed structure.
   - Recommendation: SVG for the connecting lines, HTML nodes for the boxes.

2. **How does the tree know which family_members map to which tier?**
   - `role_category` column (from sv2-s3) — `'grandparent'` | `'parent'` | `'other'`
   - The tree places members by `role_category` and `sort_order`
   - Handles fewer than 4 grandparents (empty slots in the tier)

3. **Extended family (siblings, others):**
   - Siblings appear as a row below or beside the baby node
   - Others (aunts, uncles) are not shown in the tree — they appear only in People pages

4. **What if there's no photo for a family member?**
   - Show a circle with their initial (same as Precious Five's approach)

---

## Scope (when this session is started)

### 1. `FamilyTreePage.jsx` component

Fixed layout. Props:
```js
{
  members: FamilyMember[],
  babyName: String,
  theme: BookTheme,
}
```

Renders:
- Page title "Family Tree"
- SVG tree with HTML nodes overlaid (or pure SVG — decide at session)
- Responsive within the 600px canvas width

### 2. Integration into guided book

Add to `GUIDED_BOOK_ARC` under the "About You" chapter:
```js
{ id: 'family_tree', type: 'family_tree', title: 'Family Tree' }
```

Show only if `family_members` has at least 2 members with `role_category = 'parent'` or `'grandparent'`.

### 3. PDF export

SVG-based trees render in html2canvas as long as SVG is inline (not external file). The `foreignObject` SVG element does NOT work in html2canvas — avoid it.

---

## Files to touch (when ready)

| File | Change |
|---|---|
| `Frontend/src/components/storybook/FamilyTreePage.jsx` | New — tree renderer |
| `Frontend/src/lib/guidedBookArc.js` | Add family_tree section to About You chapter |
| `Frontend/src/components/storybook/GuidedBook.jsx` | Handle family_tree page type |
| `Frontend/src/lib/storybookPdf.js` | Handle family_tree in PDF |

---

## Verification

1. Family tree renders correctly with 4 grandparents + 2 parents + baby.
2. Handles fewer grandparents (some slots missing) without breaking layout.
3. Initial circles show for members with no photo.
4. Tree renders correctly in PDF (SVG captured by html2canvas).
5. Tree is skipped/hidden if fewer than 2 parents/grandparents are defined.
