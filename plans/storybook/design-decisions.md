# Storybook — Design Decisions
*Recorded: 2026-05-03 (S2 planning). Read this before any storybook session.*

---

## Chapter Types — Both Supported

Two approaches are supported simultaneously in the same schema. A user's book can contain
chapters of both types. Long-term, the product will likely settle on one type as primary —
both exist now for A/B testing and because they may genuinely coexist (event chapters for
standout moments, period chapters for developmental arcs).

### Event-anchored (`anchor_type = 'milestone'` | `'first_time'`)
- One chapter per milestone or first time achieved
- `anchor_key`: milestone key (e.g. `'8-2'`) or first_time row id as string
- Works even with sparse data — any user with a few milestones gets chapters
- PDF: chapter title + 2–3 AI paragraphs + photo from the anchor journal entry (if any)

### Time-period (`anchor_type = 'period'`)
- One chapter per age range (0–3 months, 3–6 months, etc.)
- `anchor_key`: period identifier like `'0-13w'` (week range string)
- `period_start_weeks` / `period_end_weeks` columns hold explicit week bounds for querying
- **Late starters / sparse periods:** the frontend should require a minimum data threshold
  before offering a period for selection (e.g. ≥2 journal entries OR ≥1 milestone in range)
- **Late starters with no data for early periods:** those period options are simply not offered
- PDF: chronological event stitching (see PDF Layout section below)

---

## Chapter Ordering

- Default: **chronological** — event chapters sort by anchor week; period chapters sort by `period_start_weeks`
- `sort_order INT` nullable column on `storybook_chapters` overrides chronological when set
- User-controlled ordering UI is a future session — the column just needs to exist now
- When mixed chapter types coexist, chronological interleaving is the default

---

## Claude Prompt Design

**Text-only — photos are NOT passed to Claude.**

Why: image tokens cost significantly more than text. Photos appear in the final PDF pulled
directly from Cloudinary. Whether passing photos to Claude improves output quality enough to
justify the cost is an open question — deferred for future experimentation.

### Context for event-anchored chapters
- Baby name + age in weeks/months at the time of the anchor event
- Anchor event label (e.g. "First Smile", "Rolling Over")
- Up to 5 journal entries from ±3 weeks around the event (title + story text, no image URLs)
- First times from the same window
- Other milestones achieved in the same window (not the anchor itself)

### Context for time-period chapters
- Baby name + current age
- Period label (e.g. "Your First Three Months")
- All journal entries in the week range (title + story, up to a token budget ~800 tokens)
- All first times in the week range
- All milestones achieved in the week range

### System prompt
> "You are a warm, personal narrator writing a chapter in a baby's memory book. Write 2–3
> paragraphs in second person, addressed to the baby ('You did…' / 'We watched you…').
> Use only the details provided — do not invent specifics. Tone: heartfelt, vivid, never
> saccharine. Do not add a chapter title — just the body paragraphs."

Chapters are **standalone** — Claude receives no context from other chapters. Each chapter
should read as complete on its own. This also makes the chapters suitable as separate "mini
books" if that product direction is explored later.

---

## Claude API Configuration

- `ANTHROPIC_API_KEY` — env var only, **never in source code**. Fail fast with a clear error
  message if blank and generation is attempted.
- `ANTHROPIC_MODEL` — also configurable via env var (`anthropic.model=${ANTHROPIC_MODEL:claude-haiku-4-5-20251001}`).
  Allows upgrading to Sonnet or Opus for better prose quality without a code deploy.
- Base URL: `https://api.anthropic.com/v1/messages` (hardcoded; make configurable if a proxy
  or company Anthropic account with a different endpoint is ever needed)

---

## Share Tokens

- **SecureRandom hex, 64 characters** (not UUID — more entropy, less guessable for public URLs)
- One token per baby profile
- Revoking = deleting the `book_share_tokens` row
- Re-sharing = new row with a newly generated token

---

## PDF — Server-Side (S5 or dedicated session before S5)

The current client-side jsPDF output is insufficient for Lulu print quality.

### Library
**OpenPDF** — open-source fork of iText 2, Apache-licensed, Spring Boot compatible.
No commercial license concerns. Alternative is Apache PDFBox (more low-level, more work).

### Target format
- **Lulu trim size:** 8×10" (to be confirmed in S5 planning session)
- **Bleed:** 0.125" (standard Lulu requirement)
- **Fonts:** embedded
- **Color:** RGB (Lulu accepts RGB; no CMYK conversion needed)
- **Images:** fetch **raw Cloudinary upload URLs** — do NOT use Cloudinary transformation URLs.
  The free tier has monthly transformation credit limits. Raw phone uploads are typically
  3000+ px wide — well above 300 DPI at 8×10" print size.

### Time-period chapter layout — chronological event stitching
Events within the period are presented chronologically with photos inline.
NOT a summary block followed by a photo grid at the end.

```
[Chapter title page: "Your First Three Months"]

  Week 1 — Coming Home
    [Journal text]                         [Photo]

  Week 1 — Recognizes your voice
    [Milestone note]

  Week 3 — First bath
    [First times notes]                    [Photo]

  Week 6 — You smiled for the first time
    [Journal text]                         [Photo]
```

The PDF renderer re-queries journal entries, firsts, and milestones for the period's
week range, sorts by week/date, and interleaves photos inline at the relevant event.
The AI-generated `body` text provides narrative flow between events.

### Event-anchored chapter layout
Simpler: chapter title page → narrative body (2–3 paragraphs) → photo from the anchor
journal entry (if one exists).

### Photos are central
The product priority is: **photos first**. Parents care most about seeing pictures of their
baby. Every chapter should foreground its photos. Text supports the photos, not the other way.
