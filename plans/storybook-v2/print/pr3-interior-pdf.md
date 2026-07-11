# Print pr3 — Interior PDF assembly

**Status:** Not started
**Est:** ~2 hours · **Depends on:** pr1, pr2 · **Blocks:** pr4, pr5
**Launch prompt:** `session-prompts.md` → pr3
**Read first:** `print-full-plan.md` → "Image handling" + "PDF renderer"

The backend service that ties pr1 (the Chrome mechanism) and pr2 (the route) together: **given a `bookId`,
produce a spec-conformant interior PDF.**

---

## What you're building

A backend endpoint/service that:
1. Resolves the book's `pageData` (live DB state — birth details, family members, milestones, etc.) the same
   way the app already does, and makes it available to the pr2 route (via the token/URL or an injected payload).
2. Drives headless Chrome (pr1) over the pr2 route for that book → **interior PDF**.
3. Confirms the output meets Lulu's spec (`lulu-spec-handoff.md`): **sRGB**, **300 PPI**, **0.125" bleed**,
   **fonts embedded**, **single-page layout** (no spreads), **transparency flattened**, **no trim/bleed marks**.

## ⚠️ Notes
- **Ownership check** — the same IDOR boundary as everywhere else: only the book's owner can render it
  (`books.baby_profile_id → baby_profiles.user_id`). Reuse the existing pattern.
- **Images** — fetch raw Cloudinary URLs server-side; do **not** use Cloudinary URL transforms (free-tier
  credit limits). Chrome embeds them at native resolution (this is why B beats the raster path).
- **Placeholder trim** until pr0 lands the real `pod_package_id`; keep trim/bleed as config.

## Done when
- [ ] `GET`/`POST` for a `bookId` returns a full interior PDF of the real book.
- [ ] Output verified against the spec (sRGB, 300 PPI, bleed, embedded fonts) — inspect a generated file.
- [ ] Ownership enforced; a non-owner can't render someone else's book.

## Not this session
The **cover** PDF (pr4 — separate file) · Lulu upload/order (pr5) · the order UI (pr8). Interior only.

## Closing note
Record the duration and the real render time for a full book — it informs whether generation is synchronous
or a short async job in pr7/pr8.
