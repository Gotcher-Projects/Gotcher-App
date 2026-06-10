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
