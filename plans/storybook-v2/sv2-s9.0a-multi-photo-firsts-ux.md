# SV2-S4.5 — Rethink Multi-Photo First Times UX   *(was sv2-s6.5; renumbered 2026-06-27, sits with s4)*

**Status: Not started** (the *removal* below is already done — only the redesign remains)
**Depends on:** sv2-s4 shipped the data layer + a first-pass UI. NOT blocked on anything.
**Reference:** `sv2-s4-multi-photo-firsts.md` (what was built), `planning.md` Q4 (gallery pages)

> **Update 2026-06-25 — removal already applied.** The disliked in-card multi-photo editing UI
> (`MorePhotosEditor` + `GalleryStrip` + their props/handlers) has been **removed from the frontend**
> at the user's request (build + 244 tests green). First Time cards are back to the pre-s4
> single-hero-photo look. **What remains for this session is purely the redesign** (the open questions
> below). The Gallery book page and the backend data layer were intentionally **kept** (see below).

---

## Why this plan exists

sv2-s4 added multi-photo support to First Times: a `first_time_photos` table + endpoints, an
**in-card editing UI** (add / caption / reorder / remove inside a First's edit form), and a **Gallery
book page** renderer.

On first look (2026-06-25) the verdict was:

- ✅ **Gallery book page — keep as-is.** Looks good. No changes wanted. (`GalleryCanvas` + `gallery`
  template + dispatch points stay.)
- ❌ **The in-card multi-photo editing UI — remove it.** The current way of adding/managing extra
  photos inside the First Time edit form isn't the right interaction. The underlying feature idea is
  good, it just **needs to be designed properly** rather than shipped as the quick in-card manager
  that s4 produced.

This plan is the placeholder to **redesign that interaction later** — and to remove the current
version in the meantime so it isn't live in a state we don't like.

---

## Goal

1. **Remove** the current in-card multi-photo editing UI from First Times.
2. **Keep** the Gallery book page exactly as it is.
3. **Redesign** how parents add and manage multiple photos per First Time — a properly thought-through
   interaction — and decide how that data connects to the Gallery page.

This is a UX redesign session, not a data-model session. The data layer mostly already exists.

---

## What to remove (the part we don't like)

All in `Frontend/src/components/tabs/MemoriesTab.jsx` unless noted. Built in sv2-s4:

- `MorePhotosEditor` component — the "More photos (optional)" grid inside the First Time **edit form**
  (add button, per-photo caption input, ◀ ▶ reorder, remove).
- `GalleryStrip` component — the read-mode thumbnail strip on the First Time card. **Decide whether to
  keep this** (a passive strip showing extra photos may be fine even if the *editor* is removed) — see
  Open Q1.
- The `MorePhotosEditor` invocation inside `editContent`, and the three `<GalleryStrip>` placements in
  the read-mode card variants.
- The props threaded for it: `onAddFirstPhoto` / `onUpdateFirstPhotoCaption` / `onDeleteFirstPhoto` /
  `onReorderFirstPhotos` through `MemoriesTab` → `FirstTimesTab` → `FirstTimeCard`.
- The handlers in `Frontend/src/components/CradleHq.jsx`: `addFirstTimePhoto`,
  `updateFirstTimePhotoCaption`, `deleteFirstTimePhoto`, `reorderFirstTimePhotos`, `setFirstPhotos`,
  and the four props passed to `<MemoriesTab>`.

**Important — don't delete the Gallery page or the data layer when removing the UI:**
- Keep `GalleryCanvas.jsx`, the `gallery` template, and its dispatch points (ScrapbookBuilder /
  LayoutRenderer / storybookPdf / TemplateSheet).
- Keep `FirstTime.additionalPhotos` on the record (harmless if unused by the UI) **OR** decide to stop
  populating it — see Open Q2.

---

## What to keep / what stays available

- **Gallery book page** — unchanged.
- **Backend data layer** — `first_time_photos` table (migration `V38`), `FirstTimePhoto`, and the
  `/first-times/{id}/photos[...]` endpoints. **Recommendation: keep them dormant** rather than revert.
  Migrations are append-only — once `V38` is applied, "removing" the table means a *new* migration, not
  an un-apply. A dormant table + endpoints costs nothing and is ready when the redesign lands. (If we
  decide the redesign needs a different shape, we adjust then.)

---

## The redesign — open questions to work through (the actual thinking)

This is the part to flesh out together. None of it is decided yet.

1. **Where does multi-photo live?** Inside the First Time edit form (current, disliked), a dedicated
   "manage photos" view/modal for a First, a gallery-first mental model (you build a gallery, not edit a
   First), or only at book-build time? What's the parent's mental model — "this First has several
   photos" vs "here's a little album for this moment"?
2. **Hero vs gallery relationship.** Today `image_url` is the hero and `first_time_photos` are
   "additional". Is that the right split, or should all photos be peers with one flagged as the cover?
3. **Add/manage interaction.** Multi-select from the device at once? One-at-a-time with crop (current)?
   Drag-and-drop reorder (s4 used ◀ ▶ buttons for robustness) vs a proper drag surface? Captions
   inline vs a detail view?
4. **Read-mode display on the card.** Keep a passive thumbnail strip (`GalleryStrip`), a count badge
   ("+3 photos"), a lightbox on tap, or nothing on the card?
5. **Connection to the Gallery book page.** s4 left the Gallery page filling photos **manually from the
   photo tray**; binding it to a First's `additionalPhotos` was deferred to sv2-s5/s7. The redesign
   should decide the intended flow: does adding photos to a First auto-populate a Gallery page, or are
   they independent? This is the most important integration question.
6. **Scope creep check.** Is "multiple photos per First" actually the feature, or is the real desire a
   broader "photo albums / moments" concept that First Times is too narrow a home for?

---

## Suggested approach for the eventual session

1. Resolve the open questions above (design discussion first — no code).
2. Remove the s4 in-card editor per "What to remove".
3. Build the redesigned interaction.
4. Decide the Gallery-page data binding (ties into sv2-s5 / sv2-s7).

---

## Verification (for the removal step, when done)

1. First Times edit form no longer shows the "More photos" manager.
2. First Time cards render as they did pre-s4 (single hero photo).
3. The Gallery book page still works (add a Gallery layout, fill from the tray, renders + exports).
4. No console errors from dangling props/handlers.
5. Frontend build + tests still green.
