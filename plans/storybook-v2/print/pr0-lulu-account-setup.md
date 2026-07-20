# Print pr0 — Lulu account setup (owner-side)

**Status:** Not started — **owner task, no code**
**Est:** external (days–weeks of account/vendor lead time, not dev hours) · **Depends on:** nothing · **Blocks:** pr4, pr5, pr6 (and full end-to-end)
**Launch prompt:** `session-prompts.md` → pr0
**Full detail:** `lulu-spec-handoff.md`

The one external dependency for print. The **renderer and PDF spec are already resolved** (headless Chrome,
sRGB, 300 PPI, 0.125" bleed — see `lulu-spec-handoff.md`), so this session is *only* the account-level
things that can't be known from Lulu's public docs.

---

## What the owner brings back

- [ ] **A Lulu account** + confirmed access to the **Print API** (developers.lulu.com / "Lulu Direct").
- [ ] **`pod_package_id` (trim size / product)** — the single most important value; it fixes every page
      dimension. Get it from Lulu's **Pricing Calculator → download the Product Sheet**. Want **FC (full
      color)**; trim (8×10 / 8.5×8.5 square) is a cost/feel decision. Format:
      `[TrimSize].[Color].[Quality].[Binding].[Paper].[CoverFinish]`.
- [ ] **Credentials** — client id/secret (OAuth client-credentials) for **sandbox and production**.
- [ ] **Min/max page count** for the chosen product (feeds pr8's "not enough content yet" gate).
- [ ] **White-label** confirmation (package arrives unbranded, not "Lulu") and **API terms** OK for our
      use case (automated order submission, no reselling restriction).

Store credentials in the server `.env` only (never committed):
```
LULU_API_BASE=...        # sandbox base first, then prod
LULU_CLIENT_ID=...
LULU_CLIENT_SECRET=...
LULU_POD_PACKAGE_ID=...   # the confirmed product
```

## Already answered (don't re-research — from Lulu docs, `lulu-spec-handoff.md`)
Color = **sRGB accepted** (no CMYK work) · Resolution = **300 PPI** · Bleed = **0.125"/side** · Fonts =
**embedded/outlined** · Cover = **separate PDF**. Renderer = **headless Chrome**.

## Resolved (2026-07-16)
- **`pod_package_id` = `0850X1100FCPREPB080CW444GXX`** — 8.5×11 full-color, premium, perfect-bound, gloss
  cover (calculator form `0850X1100.FC.PRE.PB.080CW444.GXX`). Chosen because pages render on a fixed 3:4
  portrait canvas (`bookCanvas.jsx` 600×800 ≈ 0.75); 8.5×11 (0.773) is the closest standard Lulu trim.
  Stored dot-less in `Backend/.env` (API form). In `.env`.
- **Page count: min 32, max 800.** Feeds pr8's "not enough content yet" gate (books < 32 pages can't order).
- **Verification:** `Backend/lulu-verify.sh` (OAuth token + `/print-jobs/` reachability).

## Done when
- [x] `pod_package_id` and min/max page count known and in the server `.env`.
- [x] Account verified live — **production** creds pass `lulu-verify.sh prod` (token + `/print-jobs/`, 2026-07-16).
- [x] **Sandbox** creds (separate Lulu registration at developers.sandbox.lulu.com) in `.env` — `lulu-verify.sh`
      (sandbox) green 2026-07-18 (OAuth token OK, `/print-jobs/` reachable, count 0). **pr5 unblocked.**
- [x] **API terms reviewed & acceptable** (developers.lulu.com/terms-and-conditions, rev. 2018-05-23, read 2026-07-16).
      Nothing prohibits our use: reselling *printed books* OK (resale ban is on the *Services/Data*, not books);
      automated order submission from an app is the intended model ("Licensee Application" + "end users");
      no subscription/app-model restriction. Scraping/robot bans are scoped to the *Website*, not the API.
- [ ] **White-label NOT addressed in the ToS** — confirm unbranded shipping via Lulu product docs/help (non-blocking).

## Go-live obligations from the ToS (feed pr7 + privacy/refund policy — NOT build blockers)
- **Merchant-of-record + §13 liability cap:** Lulu's liability to us is capped at what *we* paid them (≈ print cost),
  not what the customer paid us. A defective/lost book → **we refund the customer and absorb the gap.** Needs a
  physical-order refund/reserve policy (distinct from the digital "move the share unlock" policy).
- **No SLA; API may change/deprecate w/ 30-day termination (§9/§11):** build defensively; **don't promise delivery dates.**
- **Content + data consent (§2/§8):** we warrant rights to transmitted content and must get user consent before
  sending personal data. **CradleHQ ToS/privacy must disclose baby photos + shipping address go to a 3rd-party printer**
  before go-live. Privacy-sensitive (infant photos).

## Not this session
Any code (pr1–pr9) · the renderer decision (done) · the PDF spec research (done). pr1–pr3 can be built in
parallel against a placeholder trim size while this is pending — only pr4–pr6 truly block on it.
