# Session opening prompts

Copy-paste the relevant block to start a session. Each assumes the reviewer doc
`branch-review.html` and this plan folder are available.

---

## s1 — Frontend dead code
> Work `plans/storybook-and-pregnancy-review-fixes/s1-frontend-dead-code.md`. Remove the
> frontend dead code from Pass 1 of the review. Confirm current state, then implement and
> run `npm run test` + a manual smoke of the book/wizard before marking Needs Verification.

## s2 — Backend dead code & API removal
> Work `s2-backend-dead-code-removal.md`. Remove `StorybookChapter`, the sharing feature
> (keep migration V25), the `/storybook/unlock` endpoint, and `skipGeneration`. Run
> `./gradlew test` and a manual wizard/book smoke.

## s3 — Security: IDOR
> Work `s3-security-idor.md`. Owner-scope the journal/first-time reads in page generation and
> validate selected IDs at `wizard()`. Add a regression test proving cross-tenant IDs are rejected.

## s4 — Credits + error handling
> Work `s4-credits-and-error-handling.md`. Make the credit decrement atomic and add a
> `@RestControllerAdvice` (or wrap `reorder`/`getAll`). Add tests.

## s5 — Upload validation + cleanup
> Work `s5-upload-validation-and-cleanup.md`. Add MIME/size validation to uploads and fix the
> account-deletion folder taxonomy. Add tests.

## s6 — Backend test coverage
> Work `s6-backend-test-coverage.md`. Add `StorybookServiceTest`, `BumpPhotoServiceTest`, and
> controller status-mapping tests. Model on `DiaperServiceTest` / `FeedingControllerTest`.

## s7 — Shared utilities / dedup
> Work `s7-shared-utilities-dedup.md`. Extract the HIGH+MED duplication from Pass 2 into shared
> helpers and update all call sites. Run `npm run test` and smoke photo upload everywhere.

## s8 — Frontend lib tests
> Work `s8-frontend-lib-tests.md`. Add the missing frontend lib tests (twemoji, deriveWeek,
> cropStyle/blockBoxStyle, downloadPdf/getTheme) plus tests for the new s7 utilities.

## s9 — Builder: extract helpers
> Work `s9-builder-extract-helpers.md`. Extract ScrapbookBuilder's pure helpers
> (splitTextParts, initPages, buildLayoutData, migrateBlock) into a lib module and unit-test them.

## s10 — Builder: component split
> Work `s10-builder-component-split.md`. Split ScrapbookBuilder into shell + sub-components/hooks
> with no behaviour change. Verify drag/click-place, l-wrap, moment-hero, autosave, publish.

## s11 — Documentation
> Work `s11-documentation.md`. Rewrite `storybook-context.md` against current code, flesh out
> `CLAUDE.md`, and add the inline contract comments. Verify accuracy against the code.

## s12 — Polish (optional)
> Work `s12-polish.md`. Modal a11y, import consistency, PDF wait tuning, and vestigial-field removal.
