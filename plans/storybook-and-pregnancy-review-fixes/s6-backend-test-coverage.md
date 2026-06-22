# s6 — Backend Test Coverage (Storybook + Bump)

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** s1–s5 (so tests target the final, fixed behaviour; skip deleted share/unlock)
**Source:** `branch-review.html` → Pass 3, P1/P2

---

## Goal
Bring the two new backend packages to parity with the rest of the codebase (every other service has
a Mockito test). Model on `DiaperServiceTest` and `FeedingControllerTest`.

## Scope
### `StorybookServiceTest` (new)
Pure helpers (make package-private/static; no mocks): `extractJson`, `parseIdsCsv`/`serializeIds`
round-trip, the malformed-JSON fallbacks (`parseJsonMap`/`parseJsonObject`/`parseJsonList`/
`parseGeneratedContent` return null/`List.of()` not throw).
DB-backed (mock `JdbcTemplate` + `BabyProfileRepository`):
- `generatePages` gating: free tier → Forbidden; no profile → Forbidden; 0 entries →
  IllegalArgument; insufficient credits → InsufficientCredits.
- `generatePages` **credit refund** on Claude failure AND on JSON-parse failure (highest value).
- `generatePages` happy path: charges `totalEntries`, writes `generated_content`.
- `wizard`: missing fields → IllegalArgument; create vs update branch.
- `update`: dynamic SET — `clearLayoutData` → NULL; `layoutData` serialized; `status='published'`
  stamps `published_at`; empty patch returns current row without UPDATE.
- (If not already covered in s3) the IDOR owner-scoping.

### `BumpPhotoServiceTest` (new)
Parity with `FirstTimeServiceTest`: list → `[]` with no profile; create inserts & maps; update
applies patch; delete returns true/false on rows-affected; default values exercised.

### Controller tests (new)
`StorybookControllerTest` + `BumpPhotoControllerTest`: mock the service to throw each exception type
and assert the HTTP status mapping (403/402/404/400/500). Skip the removed share endpoints.

## Files
- `Backend/src/test/.../storybook/StorybookServiceTest.java` (new)
- `Backend/src/test/.../storybook/StorybookControllerTest.java` (new)
- `Backend/src/test/.../bump/BumpPhotoServiceTest.java` (new)
- `Backend/src/test/.../bump/BumpPhotoControllerTest.java` (new)

## Verification
1. `./gradlew test` — all new tests pass; no flakiness. ✓ (full suite green; new classes re-run with
   `--rerun-tasks` to confirm they execute, not just cache-hit.)

## Implementation notes (done)
- Made the StorybookService pure helpers package-private (`extractJson` static; `parseIdsCsv`,
  `serializeIds`, `parseJsonMap`, `parseJsonObject`, `parseJsonList`, `parseGeneratedContent`) so the
  test exercises them directly with no mocks.
- `StorybookServiceTest` broadened (kept the s3 IDOR cases): pure-helper round-trips + malformed-JSON
  fallbacks; `generatePages` gating (free→403, no-profile→403, chapter-not-found→404, 0-entries→400,
  insufficient-credits→402); **credit refund on Claude failure AND on unparseable response**; happy
  path (charges `totalEntries`, writes `generated_content`, no refund); `wizard` field validation +
  create/update branch; `update` dynamic SET (`clearLayoutData`→NULL, `layoutData` serialized,
  `published`→stamps `published_at`, empty patch selects without UPDATE, no-profile→empty).
- New `StorybookControllerTest` and `BumpPhotoControllerTest` assert HTTP status mapping per exception
  (200/201/204/400/402/403/404/500); removed share/unlock endpoints intentionally absent.
- New `BumpPhotoServiceTest` mirrors `FirstTimeServiceTest` (profile gating, "photo or note required"
  guard, dynamic patch, rows-affected delete).
