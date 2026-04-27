# Session 2 — Storybook Backend
**Status:** Not started
**Branch:** `feature/storybook`
**Depends on:** S1 (V23 migration must exist)

## Goal
Build the full backend for the storybook feature: chapter storage, Claude API integration
(server-side), and share token generation. No frontend work this session — just the API.

Latest migration before this session: V23. Next migrations: V24, V25.

## Files to Change
| File | Change |
|------|--------|
| `Backend/db/migration/V24__create_storybook_chapters.sql` | New table |
| `Backend/db/migration/V25__create_book_share_tokens.sql` | New table |
| `Backend/build.gradle` | No new dependencies — use RestTemplate for Anthropic API calls |
| `Backend/src/main/resources/application.properties` | Add `anthropic.api.key` binding |
| `Backend/src/main/java/com/gotcherapp/api/storybook/StorybookChapter.java` | Record |
| `Backend/src/main/java/com/gotcherapp/api/storybook/dto/ChapterResponse.java` | Response DTO |
| `Backend/src/main/java/com/gotcherapp/api/storybook/dto/UpdateChapterRequest.java` | Edit DTO |
| `Backend/src/main/java/com/gotcherapp/api/storybook/ClaudeClient.java` | Thin wrapper around Anthropic HTTP API |
| `Backend/src/main/java/com/gotcherapp/api/storybook/StorybookService.java` | Business logic |
| `Backend/src/main/java/com/gotcherapp/api/storybook/StorybookController.java` | REST endpoints |
| `Backend/src/main/java/com/gotcherapp/api/config/SecurityConfig.java` | Permit public book endpoint |

## Database Schema

### V24 — storybook_chapters
```sql
CREATE TABLE storybook_chapters (
  id               BIGSERIAL PRIMARY KEY,
  baby_profile_id  BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  anchor_type      VARCHAR(20) NOT NULL,   -- 'milestone' | 'first_time'
  anchor_key       VARCHAR(50) NOT NULL,   -- milestone key (e.g. "8-2") or first_time id
  anchor_label     VARCHAR(255) NOT NULL,  -- human-readable name stored at generation time
  body             TEXT,                   -- null until generated
  status           VARCHAR(20) NOT NULL DEFAULT 'unlocked',
  -- 'unlocked' = anchor achieved, not yet generated
  -- 'draft'    = AI generated, pending parent approval
  -- 'published' = parent approved
  generated_at     TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

## Key Decisions

### Claude API — use RestTemplate, not a Java SDK
The Anthropic Java SDK is relatively new and less battle-tested than our Spring stack.
Use `RestTemplate` with a thin `ClaudeClient` wrapper. The Anthropic API is straightforward:
POST to `https://api.anthropic.com/v1/messages` with `x-api-key` and `anthropic-version` headers.

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
Use `claude-haiku-4-5-20251001` — it's fast and cheap for this use case (short narrative prose).
Response body: `content[0].text`.

### application.properties
```
anthropic.api.key=${ANTHROPIC_API_KEY:}
```
Add `ANTHROPIC_API_KEY` to the VPS `.env` file during deployment. Locally, set it in the
shell or a `.env.local` that is gitignored. Fail fast on startup if the key is blank and
storybook generation is attempted (throw a clear error, don't silently skip).

### Prompt design
When generating a chapter, pass Claude:
- Baby's name and age (in weeks/months) at the time of the anchor event
- The anchor event label ("First Smile", "Rolling Over", etc.)
- Up to 5 journal entries from the ±3 weeks around the event (title + story text only, no URLs)
- Up to 3 first times from the same period
- Any milestones achieved in the same period (other than the anchor)

Keep the prompt under ~1000 tokens of input to control cost. System prompt:
> "You are a warm, personal narrator writing a chapter in a baby's memory book. Write 2–3
> paragraphs in second person, addressed to the baby ('You did...' / 'We watched you...'). 
> Use only the details provided — do not invent specifics. Tone: heartfelt, vivid, never 
> saccharine. Do not add a chapter title — just the body paragraphs."

### Who can call generate?
The `/storybook/generate/{chapterId}` endpoint must verify:
1. The chapter belongs to this user's baby profile
2. `is_paid = true` on the users record — return 403 if not

### Endpoints
```
GET    /storybook                      → list all chapters for this user's baby (all statuses)
POST   /storybook/unlock               → create an 'unlocked' chapter row when a milestone is achieved
POST   /storybook/generate/{id}        → call Claude, set status=draft, return updated chapter
PATCH  /storybook/{id}                 → update body text and/or status ('draft'→'published' or edit text)
DELETE /storybook/{id}                 → delete chapter row (allows regeneration from scratch)
GET    /storybook/share                → create or return existing share token for this baby
DELETE /storybook/share                → revoke share token

GET    /book/public/{token}            → public, no auth — return published chapters + baby first name only
```

### /book/public/{token} response
Return only:
- Baby first name (no last name, no parent info)
- All chapters with `status = 'published'`, ordered by `created_at`
- Each chapter: `anchor_label`, `body`, `published_at`

Do NOT return baby birth date, parents' names, email, or any tracking data.

### SecurityConfig
Add `/book/public/**` to the `permitAll()` list so it bypasses JWT auth filter.

### Unlock trigger
`POST /storybook/unlock` is called by the frontend when a milestone is toggled ON or a
first time is saved. Body: `{ anchorType, anchorKey, anchorLabel }`.
If a row already exists for that anchor, return it as-is (idempotent).
Do NOT auto-generate — that's a separate user-initiated action.

### Paid check in service layer
In `StorybookService.generate()`, query `SELECT is_paid FROM users WHERE id = ?` using the
`userId` from the JWT principal. Throw a custom `ForbiddenException` if false. The controller
maps this to 403.

## Verification
- [ ] V24 and V25 migrations apply cleanly on fresh DB
- [ ] `POST /storybook/unlock` creates a chapter row with status `unlocked`
- [ ] Calling unlock again for the same anchor returns existing row (no duplicate)
- [ ] `POST /storybook/generate/{id}` with a paid user calls Claude and sets `status=draft`
- [ ] `POST /storybook/generate/{id}` with a free user returns 403
- [ ] `PATCH /storybook/{id}` updates body text and can set status to `published`
- [ ] `GET /storybook/share` returns a token; calling again returns the same token
- [ ] `DELETE /storybook/share` removes the token; `GET /storybook/share` after returns a new one
- [ ] `GET /book/public/{token}` returns published chapters with no sensitive user data
- [ ] `GET /book/public/{token}` returns 404 for an unknown token
- [ ] Public endpoint is accessible without a JWT (no 401)
- [ ] ANTHROPIC_API_KEY missing → clear startup error or graceful 500 on generate attempt
