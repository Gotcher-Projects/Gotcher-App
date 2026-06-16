# Social Sharing (Image Cards) — Plan Overview

## Goal
Turn CradleHQ memories into **beautiful, shareable image cards** ready to post to Instagram /
Facebook / iMessage — a journal entry, a first-time, or a pregnancy size/bump card rendered as a
styled PNG, not just a text link. This is **organic marketing**: people *post* these, and every card
carries the app's look.

## Why this is its own plan
Sharing is **cross-cutting**, not pregnancy-specific. The pregnancy size+bump card makes the need
obvious, but the same machinery serves journal entries and first-times across the whole app. It also
has a meaningful tech surface (DOM→image rendering, share-sheet file support) that deserves to be
sequenced independently of the pregnancy keepsake work.

## What already exists (build on this, don't reinvent)
- `Frontend/src/lib/share.js` → `shareFirstTime()` — **text/link** sharing via the Web Share API
  with a clipboard fallback. The share *trigger* + desktop fallback pattern is already proven.
- **html2canvas is already a dependency** (the storybook PDF export renders DOM→image with it). The
  hard part — rasterizing styled DOM to an image — is already solved in this codebase. See
  `feedback_html2canvas_limitations` for what it can't render (pseudo-elements, `mask-image`,
  `position:fixed` bleed) and the correct **off-screen render pattern**.

So this plan is mostly: a styled card component + a DOM→image util + a share/download util that can
attach an image **file** to the native share sheet, with the existing text/link path as the fallback.

## Strategy
- **Prove the pipeline on one card type first** (first-times — it already has a share button), then
  template more card types. Don't build a card framework before a single card ships.
- Image-file sharing degrades gracefully: `navigator.canShare({ files })` → share sheet with PNG;
  else offer **Download** + copy the existing text/link. No silent failures.
- Respect the html2canvas constraints from day one (no `::before`/`::first-letter`, no
  `mask-image` — use real DOM elements; render off-screen at a fixed pixel size).

## Sessions
| Session | Scope | Status |
|---------|-------|--------|
| S1 | Share-card foundation: off-screen DOM→PNG util + share/download util + first-times card | Not started |
| S2 | More card types: journal entry, pregnancy size card, bump+size card; light theming | Not started |

## Out of scope
- Server-side / OpenGraph image generation (this is client-side html2canvas).
- Deep-link landing pages, referral tracking, "share to unlock" mechanics.
- Video / animated cards.
