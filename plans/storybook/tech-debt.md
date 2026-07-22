# Storybook — Tech Debt & Deferred Items

Items deliberately deferred. Revisit when there's more user feedback or a clear need.

---

## 1. Duplicate Page / Duplicate Chapter

**What:** "Duplicate this page" button in the layout editor. Possibly also "Duplicate chapter."
**Why deferred:** Low immediate value. Users can recreate layouts quickly enough.
**When to revisit:** If users ask for it, or when we have enough power users to justify the UX complexity.

**Implementation sketch (when ready):**
- Duplicate page: deep-clone `pages[currentPageIndex]`, assign new IDs to all blocks, insert after current page
- Duplicate chapter: POST to a new `/storybook/{id}/duplicate` endpoint; returns new chapter in draft state

---

## 2. Collaborative / Family Editing

**What:** Allow a partner or grandparent to edit the book (not just view via S7 share link).
**Why deferred:** Significant complexity — needs multi-user session management, conflict resolution, and permissions model.
**When to revisit:** Post-v1, once the core product is stable and there's clear demand.

**Implementation sketch (when ready):**
- Invite system: `book_collaborators` table (book_id, user_id, role: editor|viewer)
- Invited users can log in and see/edit the book
- Or: passwordless magic-link editor access tied to a chapter token (simpler but less secure)

---

## 4. Auto-Suggest Template Logic — Doesn't Distinguish Between Same-Constraint Templates

**What:** `autoSuggestGroups` / `pickTemplate` selects templates by matching `memoryCount`, `minPhotos`, and `maxPhotos` only. When multiple templates share identical constraints (e.g. Classic, Photo First, Spotlight, and L-Wrap all require 1 memory + 1 photo), whichever appears first in the `TEMPLATES` array wins every time. New templates added in S12 will never be auto-suggested.
**Why deferred:** Not user-visible until the template set is finalized. Suggestion quality is a nice-to-have; users can always swap manually.
**When to revisit:** After S12 template set is locked. Options: add a `weight`/`priority` field, mark certain templates as `manualOnly`, or introduce simple heuristics (e.g. prefer Spotlight for entries tagged as milestones).

---

## 3. Temporary Claude Request/Response Logging  →  scheduled for removal in S9

**What:** S5.46 adds `[CLAUDE-DEBUG]` logging in `ClaudeClient` that prints the full system
prompt, user prompt, and Claude response to debug batched page generation.
**Why it's debt:** those payloads contain real journal/first-time content (personal family
data) and must not stay in the product.
**When to revisit:** once batched generation is trusted — tracked as its own plan,
`plans/storybook/s9-remove-claude-logging.md`.

---

## 5. Print — a failed order has NO recovery path but a refund  (storybook-v2, print track)

**What:** When Lulu rejects a paid print order, s14a-1/a-2 detect it, alert the operator and refund the
customer — but nothing can *fix* the order and actually deliver the book. Three separate constraints:

1. **A retry reuses the same stored PDFs.** `PrintOrderFulfilmentService.resubmitParked` hands Lulu the
   `interior_pdf_url`/`cover_pdf_url` already on the row and never re-renders, so it can only recover a
   *fetch* failure (dead url, Lulu outage, misconfig) — never a *content* rejection like pr5's transparency
   bug, which would regenerate identically.
2. **The PDFs are hard-`DELETE`d after 24h** (`app.print.pdf-ttl-hours`, swept hourly by `PrintPdfStore`)
   and there is **no admin re-render** — `/books/{bookId}/print/interior|cover` are scoped to
   `principal.userId()`. A 2am rejection is unrecoverable by 8am. ⚠ The short TTL is *deliberate privacy
   protection* (infant photos living in Postgres), so this is a genuine tradeoff, not an oversight. Likely
   fix: stop sweeping PDFs attached to `paid`/`failed` orders, keeping the aggressive TTL for everything else.
3. **The customer is promised a refund the instant the order fails** (`PrintCustomerEmail.orderFailed` fires
   from the `failed` transition), which forecloses a quiet retry even when one would work.

**Why deferred:** Michael's call, 2026-07-21. Print ships **dormant** (`PRINT_ENABLED=false`) at go-live while
he's away, so there are no real orders to recover. ⛔ **This is NOT a pr10 blocker but it IS the gate on
flipping the switch ON.**

**Manual stopgap that works today** (fetch-type failure, inside the 24h TTL) — re-arms the sweep's resume path:
```sql
UPDATE print_orders SET status='paid', lulu_job_id=NULL, parked_reason='print_disabled',
       failure_reason=NULL, submit_attempts=0, last_checked_at=NULL WHERE id = <order>;
```
Fix the root cause first; needs `pdf_expires_at` in the future and `PRINT_ENABLED=true`. Then contact the
customer by hand — they are expecting a refund.

**When to revisit:** before `PRINT_ENABLED` is flipped on in production. Tracked as **s14e** in
`plans/storybook-v2/sv2-s14-print-hardening.md` → "Deferred candidates".
