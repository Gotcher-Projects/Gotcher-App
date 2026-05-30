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
