# S2 & S3 — Suggestions & open decisions

These are the two sessions we deferred. This doc + the two HTML mockups
(`s2-birth-stats.html`, `s3-your-people.html`, open `index.html` to browse) are here so you can pick a
direction before we build. **No app code was changed for S2/S3** — only S4 was implemented.

Decisions you already locked (carried into both): **live-read** data binding · **follow existing unit
preference** · **square crop** for people photos.

---

## S2 — Birth Stats Card

### Decision 1 — where the birth details are entered  *(the thing you flagged: "forgot all this info was needed")*
| Option | What | Verdict |
|---|---|---|
| **A · Dashboard profile card** | A "The day you arrived" card under the baby profile | ⭐ **Recommended** — discoverable, reusable outside the book, where a parent thinks "record the birth" |
| B · Health tab, beside growth | A "Birth measurements" panel next to growth records | Good for the clinical numbers, but the birth *story* note feels out of place there |
| C · Book-flow guided step | Captured while building the birth page | Lovely in-the-moment, but the data gets "trapped" in the book unless also surfaced elsewhere |

**Recommendation:** Build **A** as the canonical home (one `birth_details` row per baby, live-read by the
page). Optionally add **C** later as a *shortcut into the same data*, never a second store.

### Decision 2 — the book page design
- **Design 1 · Keepsake (Precious-Five style)** — ⭐ recommended; matches the existing moment-hero / letter
  pages (warm cream, polaroid, note card). Lowest design risk, most cohesive book.
- **Design 2 · Editorial** — more modern/magazine. Only pick this if you want to evolve moment-hero + letter
  to match too (otherwise the book looks half-redesigned).

### Fields (all optional, PATCH semantics)
Time · hospital · weight · length · head · birth type (Natural / C-section / Induced / Other) · birth story (the note).
`birthdate` stays on `baby_profiles`. I'd add a **`birth_photo_url`** to `birth_details` (simplest hero source; falls back to the cover photo).

### Build shape when you greenlight
- Migration `birth_details` (UNIQUE per baby) + `com.gotcherapp.api.birthdetails` (record, DTO, service,
  controller) + `GET`/`PUT /birth-details`. **No SecurityConfig change** (confirmed: `anyRequest().authenticated()`).
- `BirthDetailsForm` (placement per Decision 1) + `BirthDayCanvas` renderer + `birth_day` template + 3
  dispatch points (ScrapbookBuilder / LayoutRenderer / storybookPdf) + TemplateSheet thumb — the same
  template/renderer pattern S1 (letter) and S4 (gallery) used.
- Page is **added via the template picker**, stores a marker block; the renderer is fed the live
  `birth_details` for display.

### Small open calls (sensible defaults if you don't care)
1. Birth type list — confirm Natural / C-section / Induced / Other (add VBAC, etc.?).
2. Hero photo — `birth_photo_url` on `birth_details` (default) vs reuse cover photo.
3. Units — already decided: follow growth preference.

---

## S3 — Your People

### Decision 1 — the manager UI
| Option | What | Verdict |
|---|---|---|
| **A · Roster grid** | Avatar cards + add modal, "family album" feel | ⭐ **Recommended** (add a small drag handle per card for reorder) |
| B · Sortable list | Compact rows w/ explicit drag handle + side editor | Best reorder affordance, but reads "settings" not "keepsake" |

**Recommendation:** **A** for tone; borrow B's explicit drag handle so reorder is obvious. Mirrors the
move-to-reorder we just shipped for multi-photo Firsts.

### Decision 2 — the book page
- **Design 1 · Two-up profiles** — ⭐ default (2 people/page; the guided book paginates 4+).
- **Design 2 · One-per-page spotlight** — an option for a key person.
- Suggest **one renderer with a `variant` flag** supporting both. Bio is **optional** — no bio = photo + name + role.

### Data model
`family_members`: `name`, `role` (free text + preset chips), `role_category` (parent/sibling/grandparent/other,
auto-inferred + override, used by the future tree), `photo_url` (square), `bio` (shown), `bio_input` (optional
seed for the later AI assist), `sort_order`. The family-tree visualiser stays **deferred** (sv2-s9) — this
session is just the data + the "About Your People" page.

### Build shape when you greenlight
- Migration `family_members` + `com.gotcherapp.api.family` (record, DTO, service, controller) +
  `GET/POST/PATCH/DELETE /family-members`. Photos reuse `POST /upload?context=...` then store the URL —
  **no per-entity multipart endpoint** (same simplification S4 used). No SecurityConfig change.
- "Your People" manager (Decision 1) + `PeopleCanvas` renderer + `people` template + 3 dispatch points +
  thumb.

### Small open calls
1. Preset roles to surface — Mum, Dad, Nana, Pop, Grandad, Grandma, Grandpa, Brother, Sister, Step-Dad,
   Step-Mum, Carer, Other (add/remove?).
2. Keep both `bio` + `bio_input`, or collapse to a single `bio` (drop the AI seed split)?

---

## Suggested sequencing
S2 and S3 are independent; either can go first. S3's data is a prerequisite for the family tree (sv2-s9)
and feeds the guided book (sv2-s6), so doing **S3 before sv2-s6** is the natural order. S2 is the most
self-contained and the highest standalone value (parents want to record birth details regardless of the book).
