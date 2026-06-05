# S12 — Templates, Photo Cropping & General Polish (discussion → spec)

**Status: Not started**
**Type:** Discussion / scoping session — **decide before coding** (see `feedback_discuss_before_coding`,
`feedback_dont_invent_features`). Capture decisions here, then break into implementable tasks.
**Branch:** same as S7
**Depends on:** S8–S10 verified
**Roadmap:** builder-rewrite roadmap; wraps up **Phase 1**

---

## Purpose

Michael wants to adjust how a few builder pieces work — templates, the photo picker / cropping, and
some general changes. This session is to **talk through those adjustments and decide**, not to
implement blind. The plan below records the current state and the open questions for each area so the
discussion is grounded; once decisions are made we'll spell out the concrete tasks (possibly S12.1+).

> After **S11** (the "already-in-the-book" indicators) and this round of polish land, we expect to
> **mark Phase 1 done** and start **Phase 2**.

---

## Area 1 — Template adjustments

**Current state:** 16 fixed templates in `lib/storybookTemplates.js`, each a set of normalized
(0–1) block boxes with `contentSource` (text piece or photo index) and `memoryCount` /
`minPhotos` / `maxPhotos` used by `autoSuggestGroups` / `pickTemplate`. Thumbnails are generated
generically from the boxes (`TemplateThumb` in `ScrapbookBuilder`).

**To discuss / decide:**
- Which templates to **add, remove, or re-proportion** (slot sizes, text-vs-photo balance, margins)?
- Any new layout archetypes wanted (e.g. full-bleed photo + small caption, polaroid grid, title
  banner + body)?
- Should templates carry richer metadata (a named header slot, caption slot, decorative frame)?
- Do the auto-suggest constraints (`memoryCount` / `minPhotos` / `maxPhotos`) still match the
  desired groupings, or should the suggestion rules change?

**Open questions for Michael:** which specific templates feel wrong today, and what should they
become? Bring examples/screenshots if possible.

### Notes from Michael (2026-06-04)

- **All templates are "boxy" and fill the full space.** Every layout tiles slots edge-to-edge with
  uniform margins — nothing with breathing room, asymmetry, or whitespace as a design element.
- **`two-up-photo` leaves dead space at the bottom** — the two text/photo blocks only cover ~88% of
  the page height with nothing below.
- **Not enough variety in layout logic** overall — most templates are just stacked or side-by-side
  rectangles; no diagonal splits, offset blocks, or asymmetric compositions.
- **New template wanted — "L-wrap" (single memory):** top-left = text block, top-right = photo,
  bottom full-width = continuation of the same text. One entry, text wraps around the photo.
  Rough proportions to work out at implementation time.

---

## Area 2 — Photo picker & cropping

**Current state (two inconsistent paths):**
- **Wizard step 2** "Add/Replace photo" → `openCropModal(file, onComplete, onCancel)` in
  `lib/imageUtils.jsx`. Crops to a **fixed aspect** (landscape `4/3` or portrait `3/4`) — *not* the
  template slot's shape.
- **Builder `PhotoTray`** (`components/storybook/PhotoTray.jsx`) → uploads via `apiUpload`
  **with no crop step at all**.
- Placed photos render `object-cover` (`lib/bookCanvas.jsx`) — a **center crop** with no user
  control over zoom or position inside the slot. Photo blocks store only `{ url, sourceKey, label }`,
  so there's nowhere to persist a crop/offset today.

**Problems this creates:**
- A photo dropped into a tall slot vs. a wide slot is silently center-cropped differently, and the
  user can't fix the framing.
- Inconsistent UX: cropping in the wizard, none in the builder.

**Options to discuss:**
1. **Crop-to-slot on placement** — when a photo lands in a slot, offer a crop/reposition step using
   the slot's actual aspect ratio; persist the crop on the block (e.g. `objectPosition` / focal point
   or a stored crop rect).
2. **Focal-point only** — keep `object-cover` but let the user drag a focal point per placed photo
   (cheaper; store `objectPosition`).
3. **Unify the upload path** — make `PhotoTray` use the same crop modal as the wizard so all
   uploads are cropped consistently (regardless of slot fit).
4. Combine: unify upload cropping **and** add per-slot reposition.

**Related debt (from memory):** First Times photo uploads still have no cropping UI
(`project_first_times_followup`); decide whether to fold that in here.

**Open questions for Michael:** do you want true per-slot crop (control the frame), or just consistent
upload cropping? Should an existing placed photo be re-croppable from the slot's camera button?

---

## Area 3 — General changes

Placeholder for Michael's other adjustments — to be enumerated at session start. Candidate buckets
to prompt on:
- Builder UX (slot affordances, selected/placed states, page nav, empty states).
- Wizard copy / step flow tweaks now that Scrapbook vs Quick Build are the two paths.
- Theme / typography / spacing on the page canvas.
- Anything noted while using S8–S10 that felt rough.

**Open question for Michael:** list the specific "general changes" you have in mind so we can scope them.

---

## Process
1. Walk each area, capture concrete decisions in this file (replace the open questions with answers).
2. Re-scope into implementable tasks — small enough to verify; split into S12.1 / S12.2 if needed.
3. Implement, build, verify per the usual loop; mark **Needs Verification** then **Complete**.

## Out of scope (Phase 2 candidates)
- Anything large enough to be its own initiative (print-on-demand, shareable links, decorative
  auto-population, sticker auto-suggest, re-generation for paged chapters — see `s6.4-improvements.md`
  "Ideas captured for later"). Note these as Phase 2 rather than expanding S12.
