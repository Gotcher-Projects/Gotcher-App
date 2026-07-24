# Session 2 — Storybook Backend
**Status:** Complete
**Branch:** `feature/storybook`
**Depends on:** S1 (V23 migration must exist — tier + credits columns)
**Design reference:** `plans/storybook/design-decisions.md` — read this for full architectural context

## Goal
Build the full backend for the storybook feature: chapter storage, Claude API integration
(server-side), credit enforcement, and share token generation. No frontend work this session.

Latest migration before this session: V23. Next migrations: V24, V25.

## Decisions (from S0)
- AI generation is gated to `plus` and `pro` users only (tier check, not is_paid)
- Credits are **per-chapter** — each generate call costs 1 credit
- Monthly allowance model — credits reset on billing date (`credits_reset_at`)
- Partial regeneration supported — individual chapters regenerate independently
- Free users get 0 credits; plus users get N credits/month (TBD — configurable server-side)

## Files to Change
| File | Change |
|------|--------|
| `Backend/db/migration/V24__create_storybook_chapters.sql` | New table |
| `Backend/db/migration/V25__create_book_share_tokens.sql` | New table |
| `Backend/src/main/resources/application.properties` | Add `anthropic.api.key` + `anthropic.model` bindings |
| `Backend/src/main/java/com/gotcherapp/api/storybook/StorybookChapter.java` | Record |
| `Backend/src/main/java/com/gotcherapp/api/storybook/dto/ChapterResponse.java` | Response DTO |
| `Backend/src/main/java/com/gotcherapp/api/storybook/dto/UpdateChapterRequest.java` | Edit DTO |
| `Backend/src/main/java/com/gotcherapp/api/storybook/dto/UnlockRequest.java` | Unlock DTO (handles both event and period) |
| `Backend/src/main/java/com/gotcherapp/api/storybook/ClaudeClient.java` | Thin wrapper around Anthropic HTTP API |
| `Backend/src/main/java/com/gotcherapp/api/storybook/StorybookService.java` | Business logic |
| `Backend/src/main/java/com/gotcherapp/api/storybook/StorybookController.java` | REST endpoints |
| `Backend/src/main/java/com/gotcherapp/api/config/SecurityConfig.java` | Permit public book endpoint |

## Database Schema

### V24 — storybook_chapters
```sql
CREATE TABLE storybook_chapters (
  id                  BIGSERIAL PRIMARY KEY,
  baby_profile_id     BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  anchor_type         VARCHAR(20) NOT NULL,   -- 'milestone' | 'first_time' | 'period'
  anchor_key          VARCHAR(50) NOT NULL,   -- milestone key, first_time id, or period id (e.g. '0-13w')
  anchor_label        VARCHAR(255) NOT NULL,  -- human-readable name stored at creation time
  period_start_weeks  INT,                    -- null for event-anchored chapters
  period_end_weeks    INT,                    -- null for event-anchored chapters
  sort_order          INT,                    -- null = chronological default; set for user-controlled ordering
  body                TEXT,                   -- null until generated
  status              VARCHAR(20) NOT NULL DEFAULT 'unlocked',
  -- 'unlocked'  = anchor achieved / period available, chapter not yet generated
  -- 'draft'     = AI generated, pending parent approval
  -- 'published' = parent approved
  generated_at        TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (baby_profile_id, anchor_type, anchor_key)
);
```

### V25 — book_share_tokens
```sql
CREATE TABLE book_share_tokens (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE UNIQUE,
  token           VARCHAR(64) NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
One token per baby profile. Revoking = deleting the row. Re-sharing = new row with new token.
Token generation: `SecureRandom` hex, 64 characters (not UUID).

## Key Decisions

### Claude API — use RestTemplate, not a Java SDK
Use `RestTemplate` with a thin `ClaudeClient` wrapper:
```
POST https://api.anthropic.com/v1/messages
x-api-key: {ANTHROPIC_API_KEY}
anthropic-version: 2023-06-01
Content-Type: application/json

{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 600,
  "messages": [{ "role": "user", "content": "..." }]
}
```
Use `claude-haiku-4-5-20251001` — fast and cheap for short narrative prose.
Response body: `content[0].text`.

### application.properties
```
anthropic.api.key=${ANTHROPIC_API_KEY:}
anthropic.model=${ANTHROPIC_MODEL:claude-haiku-4-5-20251001}
```
`ANTHROPIC_API_KEY` — env var only, never in source code. Fail fast with a clear error if
blank and generation is attempted.
`ANTHROPIC_MODEL` — configurable so upgrading to Sonnet/Opus is an env var change, not a
code deploy. Default to Haiku (fast, cheap, sufficient for short narrative prose).

### Prompt design
**Text-only — do NOT include image URLs in the Claude prompt.** Photos are included in the
PDF directly from Cloudinary. See `design-decisions.md` for full rationale.

**Event-anchored context:**
- Baby's name and age (in weeks/months) at the time of the anchor event
- The anchor event label ("First Smile", "Rolling Over", etc.)
- Up to 5 journal entries from ±3 weeks around the event (title + story text only, no URLs)
- Up to 3 first times from the same period
- Any milestones from the same period (other than the anchor)

**Period context:**
- Baby's name + age range label (e.g. "Your First Three Months")
- All journal entries in the week range (title + story, up to ~800 token budget)
- All first times in the week range
- All milestones in the week range

Keep the prompt under ~1000 tokens of input to control cost. System prompt:
> "You are a warm, personal narrator writing a chapter in a baby's memory book. Write 2–3
> paragraphs in second person, addressed to the baby ('You did...' / 'We watched you...').
> Use only the details provided — do not invent specifics. Tone: heartfelt, vivid, never
> saccharine. Do not add a chapter title — just the body paragraphs."

### Generate branching
`StorybookService.generate(userId, chapterId)` looks up the chapter, then branches on
`anchor_type`:
- `'milestone'` or `'first_time'` → query journal/firsts/milestones in ±3 week window
  around the anchor event's week (parse from milestone key or look up first_time occurred_date)
- `'period'` → query all journal/firsts/milestones between `period_start_weeks` and
  `period_end_weeks`

Baby age in weeks is computed from `baby_profiles.birthdate`. Always join `baby_profiles`
to get the baby name and birthdate before building the prompt.

### Who can generate? — tier + credit check
In `StorybookService.generate()`:
```sql
SELECT tier, ai_credits_remaining FROM users WHERE id = ?
```
1. If `tier = 'free'` → throw `ForbiddenException` ("Upgrade to Plus to generate chapters")
2. If `ai_credits_remaining <= 0` → throw `InsufficientCreditsException` (HTTP 402)
3. Decrement credit **before** calling Claude:
   ```sql
   UPDATE users SET ai_credits_remaining = ai_credits_remaining - 1 WHERE id = ?
   ```
4. If the Claude call fails → refund the credit:
   ```sql
   UPDATE users SET ai_credits_remaining = ai_credits_remaining + 1 WHERE id = ?
   ```

This is per-chapter — regenerating one chapter costs 1 credit regardless of book size.
Partial regeneration is fully supported; only the requested chapter is touched.

### Endpoints
```
GET    /storybook                      → list all chapters for this user's baby (all statuses)
POST   /storybook/unlock               → create an 'unlocked' chapter row when a milestone is achieved
POST   /storybook/generate/{id}        → call Claude, set status=draft, return updated chapter
PATCH  /storybook/{id}                 → update body text and/or status ('draft'→'published' or edit)
DELETE /storybook/{id}                 → delete chapter row (allows regeneration from scratch)
GET    /storybook/share                → create or return existing share token for this baby
DELETE /storybook/share                → revoke share token

GET    /book/public/{token}            → public, no auth — return published chapters + baby first name
```

### /book/public/{token} response
Return only:
- Baby first name (no last name, no parent info)
- All chapters with `status = 'published'`, ordered by `created_at`
- Each chapter: `anchor_label`, `body`, `published_at`

Do NOT return baby birth date, parents' names, email, or any tracking data.

### SecurityConfig
Add `/book/public/**` to the `permitAll()` list so it bypasses the JWT auth filter.

### Unlock trigger
`POST /storybook/unlock` is called by the frontend when a milestone is toggled ON, a first
time is saved, or a user selects a time period to add as a chapter.

**Event-anchored body:** `{ anchorType, anchorKey, anchorLabel }`
**Period body:** `{ anchorType: "period", anchorKey: "0-13w", anchorLabel: "Your First Three Months", periodStartWeeks: 0, periodEndWeeks: 13 }`

Use `UnlockRequest.java` DTO. `periodStartWeeks` / `periodEndWeeks` are required when
`anchorType = "period"`, null otherwise.

If a row already exists for that anchor, return it as-is (idempotent).
Do NOT auto-generate — that's a separate user-initiated action.
Free users CAN have unlocked chapter rows — they just can't generate them.

### Controller error mapping
```
ForbiddenException        → 403
InsufficientCreditsException → 402
```
Wrap all Claude/external calls in try/catch — do not let exceptions dispatch to /error
(see Spring Security / Error Dispatch Pattern in MEMORY.md).

## Verification
- [ ] V24 and V25 migrations apply cleanly on fresh DB
- [ ] `POST /storybook/unlock` creates a chapter row with status `unlocked`
- [ ] Calling unlock again for the same anchor returns existing row (no duplicate)
- [ ] `POST /storybook/generate/{id}` with a free user returns 403
- [ ] `POST /storybook/generate/{id}` with a paid user and 0 credits returns 402
- [ ] `POST /storybook/generate/{id}` with a paid user and credits > 0 calls Claude, sets status=draft, decrements credit
- [ ] Claude call failure refunds the credit (credit count unchanged after failed generate)
- [ ] `PATCH /storybook/{id}` updates body text and can set status to `published`
- [ ] `GET /storybook/share` returns a token; calling again returns the same token
- [ ] `DELETE /storybook/share` removes the token; `GET /storybook/share` after returns a new one
- [ ] `GET /book/public/{token}` returns published chapters with no sensitive user data
- [ ] `GET /book/public/{token}` returns 404 for an unknown token
- [ ] Public endpoint is accessible without a JWT (no 401)
- [ ] ANTHROPIC_API_KEY missing → clear error on generate attempt
- [ ] `POST /storybook/unlock` with `anchorType=period` creates a chapter row with `period_start_weeks` + `period_end_weeks` populated
- [ ] `POST /storybook/generate/{id}` on a period chapter queries all journal/firsts/milestones in the week range
- [ ] `sort_order` column exists and is returned in ChapterResponse (null by default)
