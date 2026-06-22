# s2 — Backend Dead Code & API Surface Removal

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** none (do before s3–s6 to avoid editing soon-deleted code)
**Source:** `branch-review.html` → Pass 1, sections A & B

> **Implemented 2026-06-19.** Deleted `StorybookChapter.java`, `UnlockRequest.java`; removed the
> sharing + unlock + `/book/public` surfaces (controller + service + records + helpers + unused
> imports); dropped `skipGeneration` from `WizardRequest` and `StorybookWizard.buildPayload()`.
> Kept `V25__create_book_share_tokens.sql` **unmodified** (initially added a comment, but that broke
> Flyway checksum validation on startup — reverted; applied migrations are immutable).
>
> **Pre-existing stale tests also fixed (per Michael's go-ahead):** the branch's backend test suite
> didn't compile due to 13 errors in `AuthControllerTest`, `BabyProfileControllerTest`,
> `BabyProfileServiceTest` (DTO/method signatures changed during the pregnancy work). Updated those
> tests to the current `UserDto`(+tier,+credits), `BabyProfileRequest`/`BabyProfileResponse`
> (+sex/dueDate/phase), `refresh`/`logout`(+body), and mock-based cookie/`getUser` expectations.
> **`./gradlew test` is now fully green: 193 passed, 0 failures.** `bootRun` validates all 37
> migrations successfully (only blocked locally by the dev server already holding port 3001).
> Awaiting Michael's manual end-to-end check of `GET /storybook` + wizard.

---

## Goal
Remove unused backend code and two unreachable API surfaces (sharing, unlock). Both removals were
confirmed with Michael.

## Scope
- **Delete** `Backend/.../storybook/StorybookChapter.java` — unused record; the service maps rows
  to `ChapterResponse` directly.
- **Remove the sharing feature** (no frontend caller; stale — serves legacy `body`, not
  `layout_data`):
  - Controller: `GET /storybook/share`, `DELETE /storybook/share`, `GET /book/public/{token}`.
  - Service: `getOrCreateShareToken`, `revokeShareToken`, `getPublicBook`, `generateSecureToken`,
    `extractFirstName`, and the `PublicBookResponse` / `PublicChapter` records.
  - **Keep** migration `V25__create_book_share_tokens.sql` (cheap to recreate; one durable piece).
    ⚠ Do **not** edit the migration file to add a comment — it's already applied locally + in prod,
    and Flyway validates applied migrations by checksum (editing it crashes startup with a checksum
    mismatch). The "reserved for the future sharing rebuild" note lives here / in s11 docs instead.
- **Remove `/storybook/unlock`** (superseded by the period wizard):
  - Controller `unlock` endpoint; service `unlock` + `validateUnlockRequest`; DTO `UnlockRequest`.
- **Remove `skipGeneration`** — drop from `WizardRequest` (never read by the service) and from
  `StorybookWizard.buildPayload()` on the frontend.

## Out of scope
- Vestigial data fields `generatedAt` / `supplementaryNotes` — s12.
- IDOR / credits / uploads — s3–s5.

## Files
- `Backend/.../storybook/StorybookChapter.java` (delete)
- `Backend/.../storybook/StorybookController.java`
- `Backend/.../storybook/StorybookService.java`
- `Backend/.../storybook/dto/UnlockRequest.java` (delete)
- `Backend/.../storybook/dto/WizardRequest.java`
- `Frontend/src/components/storybook/StorybookWizard.jsx` (buildPayload)

## Verification
1. `cd Backend && ./gradlew test` — green (no test references the removed code).
2. App builds and starts; `GET /storybook` and the wizard still work end to end.
3. Confirm `book_share_tokens` table/migration is untouched.
