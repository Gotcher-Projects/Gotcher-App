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

## Done when
- [ ] `pod_package_id`, sandbox credentials, and min/max page count are known and in the server `.env`.
- [ ] White-label + terms confirmed acceptable.

## Not this session
Any code (pr1–pr9) · the renderer decision (done) · the PDF spec research (done). pr1–pr3 can be built in
parallel against a placeholder trim size while this is pending — only pr4–pr6 truly block on it.
