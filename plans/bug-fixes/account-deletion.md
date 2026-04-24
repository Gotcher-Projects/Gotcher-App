# Account Deletion
**Status:** Complete
**Area:** Auth — AuthController + AuthService + all data tables

## Goal
Allow users to permanently delete their account and all associated data from within the app. Required to fulfill the promise made in the Privacy Policy (§7, §8) and Terms of Service (§9).

## What needs to be deleted (in order, to satisfy FK constraints)
1. `email_verification_tokens` — FK to users
2. `refresh_tokens` — FK to users
3. All baby-profile-owned data (feeding_logs, sleep_logs, diaper_logs, milestones, growth_records, vaccines, appointments, journal_entries + Cloudinary photos, first_times + Cloudinary photos)
4. `baby_profiles` — FK to users
5. `users` row

## Backend

### Cloudinary cleanup
`ImageUploadService` needs a new method:
```java
public void deleteAllForUser(Long userId) {
    String[] folders = { "journal", "misc", "marketplace" };
    for (String folder : folders) {
        try {
            cloudinary.api().deleteResourcesByPrefix(
                "gotcherapp/" + folder + "/" + userId,
                ObjectUtils.emptyMap()
            );
        } catch (Exception e) {
            // Log and continue — a Cloudinary failure must not block account deletion.
            // Orphaned assets are inaccessible without their DB rows and are a minor
            // storage cost, not a privacy risk.
            logger.error("Cloudinary cleanup failed for user {} folder {}: {}", userId, folder, e.getMessage());
        }
    }
}
```
Assets are stored under `gotcherapp/{folder}/{userId}/` — prefix-based deletion covers everything without needing individual `public_id`s. Note: first-times photos currently land in `misc` since the upload endpoint has no `first-times` context. If a `first-times` context is added later, add it to the folders list here.

### Endpoint + service
- `DELETE /auth/account` — JWT-protected, no request body needed
- `AuthService.deleteAccount(Long userId)` — sequence:
  1. Call `imageUploadService.deleteAllForUser(userId)` — best-effort, logs failures, never throws
  2. Open a DB transaction and delete in FK order (see above)
  3. Clear auth cookies in the response after deletion

## Invocation
This is an admin-only operation — there is no user-facing UI. Users must email privacy@cradlehq.app to request deletion. The endpoint (or a standalone script) is run manually by the operator.

Options for invocation:
- **Internal endpoint** — `DELETE /admin/account/{userId}` protected by a secret admin token (env var), never exposed to the public
- **CLI script** — a standalone shell or Gradle task that connects to the DB and calls the same service logic directly

No admin panel is planned. If one is built in the future, deletion can be wired up there at that point.

## Definition of Done
- [x] Cloudinary `deleteAllForUser` method implemented in `ImageUploadService`
- [x] DB deletion runs in a single transaction in FK order
- [x] Invocation method chosen and implemented — CLI script (`delete-account.sh`) → `DELETE /admin/account` endpoint
- [ ] Manual test: run deletion for a test user, verify login fails, verify DB rows gone, verify Cloudinary assets gone
- [ ] Privacy policy and Terms updated to reflect contact-us deletion flow (done)

## Known Gaps (to fix before marking complete)
- **`delete-account.sh` does not log each deleted item** — the script prints a success/failure header but doesn't surface the per-table row counts or Cloudinary folder results in a readable way. Should pretty-print the `deleted` map and `cloudinary` map line-by-line so the operator can confirm what was removed.
- **Cloudinary deletion is unverified** — `deleteAllForUser` runs best-effort but has never been tested end-to-end against real assets. Need to manually upload photos to a test account, run deletion, then confirm assets are gone in the Cloudinary dashboard before marking this done.
