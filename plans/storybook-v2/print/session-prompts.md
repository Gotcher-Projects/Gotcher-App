# Print (Lulu) — Session Prompts

**Sliced 2026-07-11 into ≤2h sessions**, mirroring the payments track. The old L0/L1/L2 shape (L1 was a
15–70h "session") is replaced by `pr0…pr9`. The renderer decision is **made** (headless Chrome, server-side)
and the PDF spec is answered — see `lulu-spec-handoff.md` → "✅ RESOLVED 2026-07-11".

**Canonical plan:** `print-full-plan.md`. **Spec + account setup:** `lulu-spec-handoff.md`.
**Depends on the payments track** (print's checkout is a second, variable-amount Stripe flow that reuses the
webhook/ledger patterns from Payments P1–P3).

---

## Run order & budget

| # | Session | Est. | Depends on |
|---|---|---|---|
| **pr0** | **Lulu account setup** (owner-side, no code) | — | nothing (owner task) |
| **pr0.5** | **Plan review / gap audit** (before building) | 1–1.5h | pr0 |
| pr1 | Headless-Chrome infra spike + decision | 2h | nothing (can run early) |
| pr2 | Print-view route (full book, trim+bleed) | 2h | pr1 |
| pr3 | Interior PDF assembly (backend drives Chrome) | 2h | pr1, pr2 |
| pr4 | Cover PDF (separate, spine from page count) | 1.5–2h | pr3, **pr0** (SKU) |
| pr5 | Lulu API — OAuth + upload + print job | 2h | pr3, pr4, **pr0** (creds) |
| pr6 | Cost/shipping estimate | 1.5h | pr5 |
| pr7 | Variable-amount Stripe checkout + address | 2–3h | Payments P1–P3, pr6 |
| pr8 | "Order a Book" UI + min-page gate | 2h | pr6, pr7 |
| pr9 | Order confirmation + status (opt. Lulu webhook) | 1.5h | pr7, pr8 |
| pr10 | **Lulu live cutover** (prod creds, first prod deploy, ToS gate) | 1.5–2h | pr1–pr9, **Payments P12** |

**~17–20h of dev work** (pr1–pr9) if caps hold, plus the owner-side pr0 and the pr10 go-live. pr7 is the
spill-prone one (a second checkout flow with an address); split rather than rush.

## Credential lifecycle (sandbox → prod)
Lulu sandbox and production are **separate registrations with separate keys** (like Stripe test vs live).
- **Sandbox** creds: acquired in **pr0**, used from **pr5**. Base `api.sandbox.lulu.com`. All dev/testing runs here.
- **Prod** creds: already verified (`lulu-verify.sh prod`); **swapped onto the VPS in pr10**, never used locally.
Both are exercised by `Backend/lulu-verify.sh` (`./lulu-verify.sh` = sandbox, `./lulu-verify.sh prod` = prod).

## Hard blockers (owner-side, pr0)
- **`pod_package_id` / trim size** — picks every page dimension. From Lulu's Pricing Calculator Product Sheet.
- **Credentials + sandbox** — client id/secret; integrate against sandbox first.
- **Min/max page count** — feeds pr8's "not enough content yet" gate.
Everything pr1–pr3 (the renderer + route) can be built **before** pr0 lands, against a placeholder trim size,
because the mechanism is independent of the exact dimensions. pr4–pr6 need the real SKU/creds.

## Deliberately NOT here
- **Credit packs / share unlock checkout** — that's the fixed-price digital flow in Payments (P2/P6). Print
  is a *separate*, variable-amount checkout (copies × price + shipping, needs an address).
- **Reimplementing canvases in a Java PDF library** — dropped with OpenPDF. Chrome renders the real components.

---

## pr0 — Lulu account setup (owner-side)

```
Print pr0 — external setup, no code. Follow lulu-spec-handoff.md.
Owner (likely Michael) creates the Lulu account and returns:
  - pod_package_id (trim/product) from the Pricing Calculator Product Sheet — FC (full color) book
  - client id/secret + sandbox base URL (developers.lulu.com)
  - min/max page count for the product; white-label + API-terms confirmation
Renderer + PDF spec are already resolved (see lulu-spec-handoff.md). This unblocks pr4–pr6.
```

## pr0.5 — Plan review / gap audit (1–1.5h)

```
Print pr0.5 — audit the whole print track before building. Plan: pr0.5-plan-review.md.
Walk pr1–pr10 + print-full-plan.md + lulu-spec-handoff.md; resolve/assign each seeded gap (PDF-host URL,
physical-goods sales tax, sv2-s14 hardening file, async render timing, order data model, shipping level,
US-only vs international). Every HIGH item gets resolved or an owning session; slice sv2-s14 as a stub.
```

## pr1 — Headless-Chrome infra spike + decision (2h)

```
Print pr1 — stand up server-side Chrome-to-PDF and DECIDE the mechanism.
Plan: print-full-plan.md (PDF renderer) + pr1-headless-chrome-spike.md

Decide: Node/Puppeteer sidecar vs Playwright-Java + Chromium in the Docker image. Render ONE real
book page to PDF and inspect: vector text, image resolution, fonts embedded, file size.
Goal is a proven mechanism + a decision, not the full pipeline.
```

## pr2 — Print-view route (2h)

```
Print pr2 — a frontend route that renders a FULL book for Chrome to load.
Plan: pr2-print-view-route.md

All pages in order at trim+bleed dims, print CSS (@page, 0.125" bleed, 300 PPI sizing), no app chrome,
fed the same pageData the data-driven canvases already take (birth-day/people/family-tree/milestones).
LayoutRenderer already dispatches every template + freeform — this is assembly, not new canvases.
```

## pr3 — Interior PDF assembly (2h)

```
Print pr3 — backend service: given a bookId, drive Chrome over the pr2 route -> interior PDF.
Plan: pr3-interior-pdf.md
Output to spec: sRGB, 300 PPI, 0.125" bleed, fonts embedded, single-page layout, transparency flattened.
```

## pr4 — Cover PDF (1.5–2h)

```
Print pr4 — separate cover PDF. Spine width from page count + pod_package_id (Lulu cover-dim calc).
Plan: pr4-cover-pdf.md. Needs the real SKU from pr0.
```

## pr5 — Lulu API: OAuth + upload + print job (2h)

```
Print pr5 — Lulu client. OAuth client-credentials, upload interior + cover, POST a PAID print job (sandbox).
Plan: pr5-lulu-api.md. Needs creds from pr0. Config: LULU_API_BASE / CLIENT_ID / CLIENT_SECRET / POD_PACKAGE_ID.
Also define the kill switch app.print.enabled=${PRINT_ENABLED:false} and make the paid-job submit HARD-REFUSE
when off (deepest backstop — set PRINT_ENABLED=true locally to test). Also fold in the cover-dim cross-check
(pr4 follow-up). Test via a THROWAWAY owner-guarded dev endpoint + a tunnel (BACKEND_URL=<ngrok>) so Lulu can
fetch the localhost PDFs; STOP at the client — no print_orders/address/checkout (that's pr7).
```

## pr6 — Cost/shipping estimate (1.5h)

```
Print pr6 — Lulu pricing/shipping API -> estimate (copies × price + shipping + delivery) BEFORE checkout.
Plan: pr6-cost-estimate.md — read its "Starting point from pr5" FIRST (endpoints already mapped, LuluClient
exists; add a cost method + a backend endpoint).
FIRST decide the single shipping level: pr0.5's "GROUND" is INVALID for this SKU->US (REJECTED). Pick MAIL
($5.69, cheap/slow) vs GROUND_HD ($13.74, FedEx Home/traceable) — owner call — then hardcode it.
Cost endpoint POST /print-job-cost-calculations/ returns total_cost_incl_tax = the exact amount pr7 charges.
Set the retail markup here on top of Lulu's quoted cost. Multi-copy (qty>1) is first-class. US-only.
```

## pr7 — Variable-amount Stripe checkout + address (2–3h)

```
Print pr7 — a SECOND Stripe checkout, variable amount, with a shipping address.
Plan: pr7-print-checkout.md. Reuses the Payments P1–P3 webhook/ledger patterns; NOT the fixed-price SKU flow.
Amount = copies × unit + shipping (from pr6). Webhook success -> submit the Lulu order (pr5).
Gate checkout-session-create on app.print.enabled (no charge when print is off).
```

## pr8 — "Order a Book" UI + min-page gate (2h)

```
Print pr8 — the order UI. Quantity picker, address form, estimate display, checkout.
Plan: pr8-order-ui.md. Gate: below Lulu's min page count -> "not enough content yet" (from pr0).
Any user can order — no tier gate. Physical good, so the button may ship on native (Apple 3.1.3(e)).
Show the "Order a Printed Book" entry point only when app.print.enabled is true (flag from /auth/me).
```

## pr9 — Order confirmation + status (1.5h)

```
Print pr9 — confirmation screen after a successful order; optional Lulu shipped-webhook -> notify user.
Plan: pr9-order-confirmation.md.
```

## pr10 — Lulu live cutover (1.5–2h)

```
Print pr10 — go live. Sibling of payments P12. Plan: pr10-live-cutover.md.
Swap Lulu sandbox->prod creds on the VPS (LULU_API_BASE=api.lulu.com); first-ever prod deploy of the
headless-Chrome renderer (confirm Chromium runs in the prod image); confirm Lulu company card on file;
clear the ToS go-live gate (privacy disclosure of 3rd-party printing + physical-order refund policy);
real-address smoke order. Depends on Payments P12 (Stripe live) being done.
Deploy with PRINT_ENABLED=false (dormant); flip on deliberately after the smoke test — leave OFF for vacation.
```
