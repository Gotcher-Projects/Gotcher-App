# SV2-S7-PLAN — Design the Default Guided Book   *(was sv2-s6-plan; renumbered 2026-06-27)*

**Status: DECIDED (2026-06-27) — see "Decisions locked" below. Page counts locked at ~25 / ~30
(assumed to fit Lulu's rules).**
**Runs before:** `sv2-s7-guided-book-shell.md` (which builds the page-sequence config from this).
**Reference:** `planning.md` 2026-06-27 direction update; mockups `mockups/s6-guided-first-year-book.html`
+ `mockups/s6-guided-pregnancy-first-year-book.html`.

---

## ✅ Decisions locked (2026-06-27)

- **Model = pre-designed fill-in book** (not auto-derived). Fixed, **locked** page sequence (no
  add/remove/reorder in v1); the user **drags photos / types text** into designed slots (reusing
  ScrapbookBuilder fill mechanics). Page kinds: **auto** (fills from data), **fill** (empty designed
  page), **pick** (user chooses which First for a moment-hero slot). Per-page prompts make it "guided."
- **Two adaptive default books:**
  - **"Your First Year" ≈ 25 interior pages** (birth → 1st birthday) — the baseline.
  - **"Bump to One" ≈ 30 interior pages** — the same book with a **6-page pregnancy chapter
    front-inserted**, used automatically when the profile has pregnancy data.
  - Cover + back cover wrap *around* the interior count. Counts **locked at ~25 / ~30**.
- **The full page lists are the two mockups** (authoritative reference for the arc). Pregnancy chapter:
  A Letter Before You Arrived · The Day We Found Out · Your First Photo (ultrasound) · The Bump ×2 ·
  Getting Ready for You. First-year sections: The Beginning · Your People (+ **Family Tree**) · Firsts
  (×4 user-picked) · Watch Me Grow (quarterly spreads) · You at One · The Big Day · Closing.
- **Firsts = ~4 user-picked moment-hero pages** (no auto Firsts chapter; old moment-hero/firsts plans dropped).
- **Growth = quarterly spreads** (Months 0–3 / 3–6 / 6–9 / 9–12, ~3 larger photos each) — *not* one
  cramped 12-photo grid.
- **Size comparison = a small AUTO tag on bump photos** ("how big were you here"), not its own page.
- **Family tree is in the default book** (People section) → build `sv2-s5` before `sv2-s7`.
- **Guided book is the default/recommended mode** (small "Recommended" badge in the chooser); the
  freeform scrapbook coexists as the advanced option.

### New page types the shell needs (most reuse; some net-new)
Exist: Cover, Letter, Birth Stats, Your People, Gallery, Moment-Hero. **Build first:** Family Tree
(sv2-s5). **Net-new/simple:** Chapter-divider page; "Month-by-Month" growth spread (may reuse a
photo-grid template); prompt/fill pages ("All About You", "Hands & Feet"); a Bump page (600×800 wrapper
around a bump photo + the auto size tag).

---

*(The original 2026-06-22 design-pass draft — candidate ~9-page arc + open questions — was trimmed
2026-06-27 once the arc was locked above. It's in git history if ever needed.)*
