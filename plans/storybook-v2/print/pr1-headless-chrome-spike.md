# Print pr1 — Headless-Chrome infra spike + decision

**Status:** Not started
**Est:** ~2 hours · **Depends on:** nothing (can run early) · **Blocks:** pr2, pr3
**Launch prompt:** `session-prompts.md` → pr1
**Read first:** `print-full-plan.md` → "PDF renderer"

Stand up the server-side Chrome-to-PDF mechanism and **decide how Java drives it** — then prove it renders
one real page well. Goal is a proven mechanism + a decision, not the pipeline.

---

## The decision this session makes

Our backend is Java (Spring); headless-Chrome-to-PDF is most natural in Node. Two viable shapes:

| Option | What it is | Trade-off |
|---|---|---|
| **Node/Puppeteer sidecar** | A small Node service in its own container; Java POSTs it a URL, gets a PDF | Clean separation, idiomatic Puppeteer; one more service to run/deploy |
| **Playwright-Java + Chromium** | Drive Chromium from Java directly | No extra service; heavier Docker image, Playwright-Java less battle-tested than Node Puppeteer |

Decide here — pr2/pr3 build on it. Either way, **Chromium must land in the Docker image** (~300MB layer).

## The spike

Render **one real book page** (pick a text-heavy one, e.g. `letter`, and an image one, e.g. `gallery`) to
PDF via `page.pdf()` and inspect:
- [ ] **Text is vector** (selectable in the PDF, crisp at zoom) — the whole point vs the raster path.
- [ ] **Images embed at native resolution** (not down-sampled to a page raster).
- [ ] **Fonts embedded** automatically.
- [ ] File size is sane; render time per page is acceptable.

## Done when
- [ ] The sidecar-vs-Playwright-Java decision is **made and written down** (with the reason).
- [ ] A Chromium-in-Docker path is proven (image builds, Chrome launches headless).
- [ ] One real page renders to a PDF with **vector text + native-res images**.

## Not this session
The full-book route (pr2) · the backend assembly service (pr3) · bleed/trim conformance (pr2/pr3) · Lulu
(pr5). Just prove the mechanism and pick the shape.

## Closing note
Record the actual duration and **which mechanism you chose**. pr2 and pr3 both build directly on it.
