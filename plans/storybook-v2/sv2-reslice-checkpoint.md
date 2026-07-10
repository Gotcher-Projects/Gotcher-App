# SV2 — Re-slice checkpoint (STOP AND TALK)

**Status:** Not started
**Est:** ~1.5 hours · **No code.**
**Run:** after **Payments P5** (backend complete: migration, checkout, webhook, hardening, Radar) and
**before** `sv2-s13`, `sv2-s12`, or `sv2-s14` are started.

> **This is a deliberate stop.** The point of session-based work is chunks small enough to code *and
> verify* in one sitting. That has repeatedly not happened. This checkpoint exists to fix the remaining
> plans before they're run, using **measured** velocity instead of guessed velocity.

---

## Why it exists — the evidence

The core track was scoped as **s1 … s9: nine sessions.** What actually ran was **~22**, because the big
ones had to be split mid-flight:

- `sv2-s7` → `s7a` (books + library) + `s7b` (guided arc) + `s7-plan-default-book`
- then `s7.5a`, `s7.5b`, `s7.5c`, `s7.5d`, `s7.5e` — five follow-ups
- `sv2-s3` → `s3.5` · `sv2-s6` → `s6.5` · `sv2-s9` → `s9.0a`, `s9.0b`, `s9.1`, `s9.5`, `s9.6`
- `sv2-s10` → `s10b`

**A 2.4× fan-out.** Every one of those splits happened *after* a session had already grown too big. The
sessions weren't wrong about the work; they were wrong about the size. Splitting after the fact costs a
context reload each time.

Payments was re-sliced up front (P0–P12, ≤2h each) on 2026-07-10. **The remaining tracks were not.**

---

## What's still unsliced, and how bad

| Plan | Current est. | Sliced? | Notes |
|---|---|---|---|
| `sv2-s13-share-link.md` | 6–12h | ❌ | One plan file, one session, no split |
| `sv2-s12-print.md` L0 | 3–5h | ❌ | Blocked on Lulu account existing |
| **`sv2-s12-print.md` L1** | **15–70h** | ❌ | **The monster. Range depends on an undecided question — see below.** |
| `sv2-s12-print.md` L2 | 5–9h | ❌ | |
| `sv2-s14` hardening | 6–10h | ❌ | **Plan file does not exist yet.** |

A 15–70h "session" is not a session. It is a project.

---

## Task 1 — Calibrate against reality

Pull the real durations of **P0 through P5** (six sessions, each capped at ≤2h).

- [ ] What did each actually take?
- [ ] Is the ≤2h cap honest, or is it a cap we blow through by 1.5×?
- [ ] Apply the measured factor to every estimate below before slicing. **Do not re-guess from scratch.**

This is the whole reason the checkpoint sits after P5 rather than after P0: one data point is an anecdote,
six is a velocity.

## Task 2 — Settle the print renderer question FIRST

**This one decision swings ~30 hours.** Slicing L1 before answering it is meaningless.

`sv2-s12-print.md` mandates **OpenPDF, server-side** — reimplementing ten React canvases (**1,806 LOC**),
plus `LayoutRenderer`'s freeform fallback, plus a DOM-built cover, as Java PDF drawing calls, pixel-faithful
at 300 DPI. That's **40–70h**, and the plan admits it is "the main risk of the whole session."

**But the existing pipeline doesn't draw anything.** `Frontend/src/lib/storybookPdf.js` renders the real
React canvases off-screen, screenshots them with `html2canvas` at `scale: 2`, and drops JPEGs into jsPDF.
Every page is a raster. The virtual canvas is 600×800, so `scale: 2` → 1200px across a 150mm (5.91") page
= **~203 DPI**. Lulu wants 300. `scale: 3` → ~305 DPI.

So the real question is **resolution and print-fidelity, not a rendering port.** Three options:

| Option | Est. | Verdict |
|---|---|---|
| Bump `html2canvas` `scale` to 3, stay client-side | 4–8h | Cheapest. Known `html2canvas` limits (pseudo-elements, `mask-image`, bleed don't render); JPEG-lossy; RGB only; ~17MB/page on the customer's phone. Likely fails a print house. |
| **Headless Chrome server-side (`page.pdf()`)** | **12–25h** | **Probably right.** Reuses 100% of the existing React components, so no fidelity gap by construction. Emits **vector text + images embedded at native resolution** — strictly better than any raster path. Bleed via CSS `@page`. Cost: a headless browser in the Docker image. **The plan never considered this.** |
| OpenPDF reimplementation | 40–70h | What the plan says. Precise control, no browser dependency. Not worth 40h here. |

- [ ] **Spike headless Chrome print-to-PDF for one page.** A couple of hours to potentially save thirty.
- [ ] Blockers: **bleed** and **CMYK**. Both are open, both depend on Lulu's spec, which is unconfirmed
      (`lulu-print-handoff.md` Q8 — trim size is still a guess, and the doc contradicts itself: 6×9" in one
      place, 8×10" in another).

> **Related, and it undermines the plan's own reasoning:** `sv2-s12` says "phone uploads are 3000+ px —
> sufficient for 300 DPI." **The raster pipeline defeats that.** Photos get composited into a 1200px-wide
> page image before reaching the PDF. That argument only holds if the PDF embeds images *as images* —
> which Chrome's print-to-PDF does and the current path does not.

## Task 3 — Slice everything remaining to ≤2h

Using the calibrated factor from Task 1 and the renderer decision from Task 2.

- [ ] **`sv2-s13`** → likely 4–6 sessions: token schema + endpoints · PII-filtered `pageData` payload ·
      `PublicBookPage` · share UI + upsell · states (404 / empty / branding).
      ⚠️ **The renderer is nearly free** — `LayoutRenderer` *already* dispatches all ten templates plus the
      freeform fallback, takes `layout`/`theme`/`pageData`, and has no auth or edit coupling. The plan's
      warning to "read the dispatch in `storybookPdf.js`" points at the wrong file: `storybookPdf.js`
      duplicates that switch only because it captures pages off-screen without the pager chrome.
      **The real work is the PII payload** — `familyMembers` is names and photos of real relatives;
      `birthDetails` includes hospital and time of birth. Deciding what a stranger with a URL sees is a
      security task, not plumbing.
- [ ] **`sv2-s12` L1** → slice only *after* Task 2. Under headless Chrome it's roughly: renderer service ·
      data path for `pageData` · print-spec conformance (bleed/DPI/fonts) · Lulu OAuth + print-job ·
      cost/shipping estimate · min-page-count gate.
- [ ] **`sv2-s14`** → **write the plan file; it doesn't exist.** Cover: webhook idempotency replay ·
      declined payments · refunds (esp. share unlocked on the wrong book) · Lulu order rejection below min
      page count · low-balance alert on the Anthropic card · **book-ownership authz on the share purchase
      (IDOR)** · **enforce `email_verified`** (read but never enforced — makes `sv2-grant`'s cap a promotion,
      not an abuse control).
      **Already done, don't re-litigate:** `AiAssistService.java:88` refunds the credit on a failed Claude call.

## Task 4 — Fix the habit, not just the plans

- [ ] **No plan file gets a Status of "Not started" while carrying an estimate over 2 hours.** If it does,
      it isn't a session, and it gets split before anyone runs it.
- [ ] Every session ends by recording its **actual** duration. Six data points beat any estimate.
- [ ] When a session spills, **stop and split** rather than pushing through. `s7` → `s7a`/`s7b`/`s7.5a–e`
      is what pushing through looks like.

---

## Done when

- [ ] Measured velocity from P0–P5 is written down, and every downstream estimate is adjusted by it.
- [ ] The print renderer question is **decided**, with the spike run — not deferred again.
- [ ] `sv2-s13`, `sv2-s12` L1/L2, and `sv2-s14` all have plan files with **no session over 2 hours**.
- [ ] `sv2-s14` exists at all.
- [ ] `planning.md` §3's session map reflects the new slices.
