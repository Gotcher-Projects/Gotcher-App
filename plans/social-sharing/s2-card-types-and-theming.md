# S2 — More Card Types + Theming

**Status: Not started**
**Branch:** TBD (continue `feature/share-cards`)
**Depends on:** S1 complete (DOM→PNG pipeline + share/download util + first-times card proven).

---

## Context
With the pipeline proven on first-times (S1), this session is mostly **templating more card types**
and giving them a light, on-brand polish. Each new card is a fixed-size DOM component fed into the
existing `nodeToPngBlob` + `shareImageCard` machinery — no new infrastructure.

## Decisions
- Reuse the S1 pipeline verbatim. New cards are just new components + a share trigger.
- Keep cards **real-DOM only** (html2canvas constraints from S1 still apply).
- Light theming: pull from existing theme tokens so cards match the active book/app theme.

---

## Card types to add

### 1. Journal entry card — `JournalShareCard.jsx`
- Hero photo + a short excerpt of the entry text (truncate to fit; no rich-text drop caps — they
  won't rasterize), date, baby name, logo.
- Wire a "Share as image" action into the journal card actions (next to the existing edit/delete).

### 2. Pregnancy weekly size card — `SizeShareCard.jsx`
*(Only meaningful once pregnancy S2 ships the size dataset; the card can still be built/tested with
mock data.)*
- The illustration (or emoji fallback) + "Week {week} · about the size of {label}" + the
  development blurb + logo.
- Trigger from the pregnancy home size card (a share icon on the hero card).

### 3. Bump + size card — `BumpShareCard.jsx`
*(Depends on pregnancy S3 bump diary.)*
- The user's **bump photo** paired with the **size caption** — the signature keepsake object.
  "Week {week} · as big as {label}".
- Trigger from each bump-diary card.

---

## Theming
- A shared `ShareCardFrame` wrapper component: consistent padding, brand background, logo placement,
  and a small "made with CradleHQ" footer — so every card type is visually a family.
- Read colors/fonts from the active theme tokens (`feedback_css_import_tailwind` — tokens live in
  `index.css`, applied via `data-theme`). Ensure the off-screen render container inherits the
  `data-theme` attribute so cards match the user's chosen theme.
- Offer a **square (1080×1080)** and a **portrait/story (1080×1350)** size from the same component
  (the frame adapts; the pipeline already takes width/height).

---

## Testing checklist
- [ ] Journal card renders + shares (photo + excerpt, no drop-cap artifacts)
- [ ] Size card renders with illustration AND emoji-fallback rows
- [ ] Bump card pairs the right size caption for its week
- [ ] All three share via the S1 share/download fallbacks (mobile file share + desktop download)
- [ ] Cards pick up the active theme's colors/fonts
- [ ] Square + portrait variants both render undistorted
- [ ] Brand frame (logo + footer) consistent across all card types

## Out of scope
- Server-side OG images, deep links, referral tracking.
- Animated / video cards.
