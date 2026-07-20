# Print pr3 — Interior PDF assembly

**Status:** Complete — built + verified end-to-end 2026-07-16 (owner-triggered render → persist →
unauthenticated fetch, byte-identical to pr2; IDOR + token boundaries green); user confirmed. See "Build result".
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

## Decisions from pr0.5 (2026-07-16)
- **Render timing = PRE-CHECKOUT (gap #4).** The interior + cover PDFs are generated when the user *places the
  order* (pr8, with a loading state), **before** the Stripe charge — not in the webhook, not post-payment. So a
  full-book Chrome render never blocks the pr7 webhook (which must return fast), and we **never charge for a
  book we can't produce**. This service is therefore invoked at order-placement, and its output is **persisted**
  (see host below) so pr5/pr7 can hand Lulu a URL without re-rendering.
- **PDF host = signed backend endpoint, not Cloudinary/S3 (gap #1).** Lulu's Print API fetches the interior/cover
  from a **public `source_url`** (it does not accept a binary upload in the create-job call). We serve the
  persisted PDF from a **backend endpoint at an unguessable token path** (e.g. `/print/pdf/{opaqueToken}`),
  **no auth header** (Lulu fetches server-side, unauthenticated), **short TTL**, single-use-ish. Rationale:
  these are **baby-photo PDFs** — the URL must be unguessable + short-lived; a backend endpoint keeps it under
  our control (revoke/expire) with no new vendor. pr3 persists the PDF + mints the token; **pr5 gives Lulu the
  URL.** Store the token/TTL on the `print_orders` row (table defined in pr7).

## Decisions from pr3 planning (2026-07-16)
Two distinct tokens: a **render token** (authorizes the payload fetch *during* rendering; minutes-long, internal)
and a **PDF-fetch token** (the unguessable path *Lulu* fetches the finished PDF from; short TTL, external).
- **D1 — Render token = short-lived signed JWT** (reuse `JwtUtil`). Claims `{bookId, purpose:"print-render"}`,
  ~5-min expiry; the real `GET /print/payload/{token}` verifies signature + expiry + purpose and returns the
  unfiltered payload for that book. Stateless, no table/cleanup; exposure window is tiny (render ~4s). Minted
  only after the owner IDOR check. Replaces pr2's throwaway `PrintDevController`.
- **D2 — Finished PDF = Postgres `bytea`, served by a signed endpoint.** New `print_pdfs` migration:
  `id, token (opaque, unguessable), book_id, kind (interior|cover), bytes (bytea), content_type, created_at,
  expires_at`. Standalone now; pr7's `print_orders` references a `print_pdfs` row via FK (decouples artifact from
  order). **Fetch token** = opaque 32-byte URL-safe random (reuse `BookShareService.generateToken()` approach,
  NOT a JWT — Lulu just needs an unguessable URL, and DB storage lets us expire/revoke). **Endpoint**
  `GET /print/pdf/{token}` (under `/print/**` permitAll, no auth — Lulu fetches server-side) streams
  `application/pdf`, 404 on missing/expired. **TTL ~24h** — must span render→pay→webhook→Lulu-fetch (Lulu fetches
  the `source_url` at job creation in pr5); a periodic sweep deletes expired rows. Chosen over a filesystem volume
  (transactional, identical dev/prod, no volume ops); Cloudinary already ruled out in pr0.5. Trade-off noted:
  PDFs land in DB backups (same data already in the DB; TTL keeps the table small).
- **D3 — Build pr3 WHOLE** (not pre-split into pr3a/pr3b). One session covers: `print_pdfs` migration; render-JWT
  mint/verify; real `GET /print/payload/{token}` (delete `PrintDevController`); sidecar HTTP client; owner-triggered
  `POST /print/book/{bookId}/interior` → render → persist → returns `{pdfUrl, expiresAt}`; `GET /print/pdf/{token}`
  + TTL sweep; config + spec check. Split only if it grows past ~3h.

## Done when
- [x] `POST /books/{bookId}/print/interior` (owner) → renders + persists → `{pdfUrl, expiresAt}`; the PDF is a
      full interior of the real book.
- [x] Output verified against the spec — inspect a generated file (sRGB/ICCBased, bleed MediaBox 630×810pt,
      embedded fonts, native-res images). See note below.
- [x] Ownership enforced; a non-owner can't render someone else's book (book 17 → 404 IDOR).

## Build result (2026-07-16)
- **Migration:** `V50__add_print_pdfs.sql` (`print_pdfs`: opaque token, book_id, kind, `bytea`, expires_at).
- **Backend (`com.gotcherapp.api.print`):** `PrintRenderService` (owner check → mint render JWT → drive sidecar →
  persist → return fetch URL), `PrintSidecarClient` (own RestTemplate, long read timeout), `PrintPdfStore`
  (persist/fetch + hourly `@Scheduled` TTL sweep; `@EnableScheduling` added to the app class), `PrintController`
  (`POST /books/{bookId}/print/interior`, JWT-protected), `PrintPublicController` (`GET /print/payload/{token}`
  verifies the render JWT → unfiltered payload; `GET /print/pdf/{token}` streams the bytea). `JwtUtil` gained
  `generatePrintRenderToken`/`getPrintRenderBookId`. `PrintDevController` (pr2 throwaway) deleted. Config in
  `application.properties` (`app.print.sidecar-url`/`frontend-base`/`render-timeout-ms`/`pdf-ttl-hours`).
- **Frontend:** `PrintBookPage` now fetches `GET /print/payload/{token}` (the render JWT), not the dev path.
- **Verified end-to-end:** login as demo (owner of book 5) → `POST /books/5/print/interior` → **200 in 5.1s**,
  `{pdfUrl, expiresAt +24h}`. Fetching that URL **unauthenticated** (as Lulu) → 200, `application/pdf`, **30
  pages, MediaBox 630×810pt, 6 embedded fonts, 35 images**, byte-identical (2,546,224 B) to the pr2 render.
  Boundaries: unauth trigger → 401; owner rendering book 17 (not theirs) → **404 IDOR**; bogus payload/pdf token
  → 404. `gradlew compileJava` ✓, `vite build` ✓.
- **300-PPI note:** images embed at native resolution (proven in pr1 — Image XObject, not a page raster). Phone
  photos are 3000px+, which exceeds 300 PPI at the ~8" print width, so full-bleed images clear the spec.

## Not this session
The **cover** PDF (pr4 — separate file) · Lulu upload/order (pr5) · the order UI (pr8). Interior only.

## Closing note
Render time: **~5.1s** for a 30-page book (sidecar ~3.8s + payload fetch + persist). Well within a synchronous
order-placement request (pr0.5 pre-checkout render), so no async job needed. `PrintRenderService.renderInterior`
is what pr7/pr8 call at order placement; `renderCover` (pr4) will be its sibling.
