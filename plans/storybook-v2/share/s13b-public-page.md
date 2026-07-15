# Share s13b — Public read path + PublicBookPage renderer

**Status:** Complete (verified 2026-07-14) — backend `GET /book/public/{token}` + rewritten
`PublicBookPage.jsx`. 8 `PublicBookServiceTest` cases + full suite green; Vite build clean. Live e2e
against Noah's book 18 (35 published v2 chapters): first-name-only, cover subtitle baked, chapter-nested
payload, pageData correctly scoped, 0 PII hits, empty→200+`[]`, bad token→404. User confirmed it loads in
incognito. **Follow-up polish (unused space + unclear page breaks) split out to [s13d](s13d-public-polish.md).**

### Wired templateIds (closing-note list — via `LayoutRenderer`, reused by the public page)
`moment-hero-portrait` / `moment-hero-landscape` → MomentHeroCanvas · `letter` → LetterCanvas (eyebrow) ·
`gallery` → GalleryCanvas · `birth_day` → BirthDayCanvas · `people` → PeopleCanvas · `family_tree` →
FamilyTreeCanvas · `chapter_divider` → ChapterDividerCanvas · `prompts` → PromptsCanvas · `bump` →
BumpCanvas · `milestones` → MilestonesCanvas · **freeform fallback** (`renderBlocks`) covers block-based
templates with no dedicated canvas: `spotlight`, `growth-spread`, `hands-feet`, and any future one ·
**Cover** rendered separately by `CoverCard` (not via LayoutRenderer). Match drift against `storybookPdf.js`.

**Est:** ~2h (spill-prone — the renderer must match the full PDF dispatch) · **Depends on:** s13a · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → s13b
**Read first:** `../sv2-s13-share-link.md` → "PublicBookPage" + "Privacy" · `Frontend/src/lib/storybookPdf.js` (the render dispatch)

The no-auth public endpoint that serves a shared book, and the real read-only renderer that replaces the P5
placeholder in `PublicBookPage.jsx`.

---

## What you're actually doing, in one paragraph

A logged-out visitor opens `cradlehq.app/book/{token}`. `App.jsx` already routes that (Payments P5) to
`PublicBookPage`, which today is a "coming soon" shell. This session builds `GET /book/public/{token}` (public,
PII-scoped) and rewrites `PublicBookPage` to fetch it and render the book's published pages through the same
canvas dispatch the PDF exporter uses — polished enough that a grandparent wants to keep reading.

## Backend — `GET /book/public/{token}`

**No auth.** `SecurityConfig` already lists `/book/public/**` in `permitAll` (an orphan from the removed
feature) — **confirm it still does**; you shouldn't need to add it.

Resolve the token → book. If no such token, or the book is somehow not unlocked → **404** (the s13a mint gate
means an unlocked book is the only way a token exists, but check defensively). Otherwise return:

```
{
  babyName,                 // FIRST name only
  theme,                    // book theme key (for canvas theming)
  cover: { title, subtitle, coverPhotoUrl },   // subtitle RESOLVED server-side (see below)
  chapters: [               // CHAPTER-NESTED (decided 2026-07-12) — mirrors storybookPdf.js
    { anchorType, anchorLabel, pages: [ { templateId, blocks, ... layout_data } ] }
  ],
  pageData: { ... }         // conditionally scoped — see below
}
```

### Decisions locked (Michael, 2026-07-12)

1. **Chapter-nested payload.** Return `chapters: [{ anchorType, anchorLabel, pages }]`, not a flat `pages[]`.
   This mirrors `storybookPdf.js` exactly: the client walks chapters → pages, and the **letter page's eyebrow**
   comes from `chapter.anchorType === 'guided' ? chapter.anchorLabel : undefined` (see `storybookPdf.js:253`).
   No server-side eyebrow resolution needed — the client already has the rule.
2. **`pageData` scope = conditional per-template.** Scan the included published chapters' page `templateId`s and
   include each sub-object **only if** a page uses it: `birthDetails` iff a `birth_day` page is present;
   `familyMembers` iff a `people` **or** `family_tree` page is present; `achievedMilestones` iff a `milestones`
   page is present. Always include `babyName` (first only) + `coverPhotoUrl` (cover/birth_day/family_tree use them).
3. **Cover subtitle baked server-side; birthdate scoped.** Resolve the final cover subtitle string on the backend:
   if the parent set a custom `coverSubtitle`, use it; else compute `"A memory book · Born {formatted date}"`
   (mirror `buildCoverElement` / `BookCover.jsx:15`). The cover never needs raw `birthdate`. Send raw
   `birthdate` **only** when a `birth_day` page is present (that canvas formats it itself). Otherwise
   `birthdate: null`.
4. **`parentName` is NEVER sent.** Verified: no renderer consumes it — it's only AI-assist prompt context
   (`ScrapbookBuilder.jsx:97`), which the read-only public page never invokes. Omit it unconditionally.
5. **v2-only; classic chapters skipped.** Include only chapters whose `layoutData.version === 2`. Legacy
   classic `chapter.body` chapters (pre-v2, removed feature) are **not** rendered on the public page — keeps
   this session bounded. If every published chapter is classic, the book resolves to empty → "still being
   written." (No shared-eligible book is expected to be all-classic.)

### Published-only
`status = 'published'` is a **CHAPTER-level** field — `storybookPdf.js:204` filters `chapters.filter(c => c.status
=== 'published')`; `ScrapbookBuilder.jsx:552` sets it via `onUpdate(chapter.id, { …, status:'published' })`.
Return only **published chapters** (and, per decision 5, only those with `layoutData.version === 2`). Never
expose drafts. If a valid token's book has **no** qualifying chapters, return an empty `chapters: []` the
frontend shows as "still being written" — **not** a 404.

### ⚠️ PII: SCOPE, don't censor (decided 2026-07-12)
Assemble `pageData` server-side (the frontend builds it from several calls today —
`StorybookTab.jsx:113`: `{ birthDetails, familyMembers, achievedMilestones, babyName, parentName, birthdate,
coverPhotoUrl }`). For the public payload:

- **Include** only what the book's included published pages actually render — e.g. `birthDetails` **only if** a
  `birth_day` page is present; `familyMembers` **only if** a `people`/`family_tree` page is present;
  `achievedMilestones` only if a `milestones` page is present; `babyName` (first only); cover fields.
- **Omit** account-level data no page shows: the parent's **email**, other babies/books, unpublished pages, and
  `parentName` / `birthdate` **when no included page uses them**.
- **Do NOT redact** content the parent deliberately placed on a shared page — a Birth Stats page's date/hospital
  or a "Your People" page's names are there because the parent curated the book to share them. Stripping those
  would visibly break the pages the parent chose to publish.

Net: the public response is a *projection scoped to the shared pages*, not a censored copy of the account.

## Frontend — `PublicBookPage.jsx` (replace the P5 shell)

`PublicBookPage.jsx` today is a placeholder. Rebuild it to:

1. Fetch `GET /book/public/{token}` (no auth header). The payload is **chapter-nested** (`chapters[].pages[]`).
2. Walk **chapters → pages in order** and render each page via `LayoutRenderer` + the `*Canvas` set — **match the
   dispatch in `storybookPdf.js` (read it; don't enumerate from memory).** The letter page's `eyebrow` comes
   from `chapter.anchorType === 'guided' ? chapter.anchorLabel : undefined` (same rule as `storybookPdf.js:253`).
   As of 2026-07-09 that's `moment-hero`
   (portrait + landscape), `letter`, `gallery`, `birth_day`, `people`, `family_tree`, `chapter_divider`,
   `prompts`, `bump`, `milestones`, **plus the `LayoutRenderer` freeform fallback, plus the Cover** (which
   `storybookPdf.js` builds as raw DOM, not a canvas). The data-driven canvases (`BirthDayCanvas`,
   `PeopleCanvas`, `FamilyTreeCanvas`, `MilestonesCanvas`) take the served `pageData` prop.
3. **Light / cream outward-facing theme** (this is not the app UI). Header: "{Baby}'s Story" with the CradleHQ
   logo; footer: "Created with CradleHQ — track your baby's story at cradlehq.app".
4. States: **404 token** → "This link is no longer active. Ask the parent to share a new one." · **valid but no
   published pages** → "This story is still being written — check back soon." No app internals exposed.

⚠️ Reuse `useCanvasScale` / `captureElement`-adjacent shared utils where the app already does (see
`project_shared_frontend_utils`); don't re-inline canvas scaling.

## Done when

- [ ] Pasting a link in a private/incognito window loads the public book with baby name + pages.
- [ ] **Every** page type renders (all templates + moment-hero variants + freeform fallback + cover) — compared
      against the `storybookPdf.js` dispatch, not this doc.
- [ ] Data-driven pages (birth/people/family-tree/milestones) receive `pageData` and render.
- [ ] The response contains **no** email / other-baby / unpublished data; `parentName` **always** absent;
      `birthdate` absent unless a `birth_day` page is present (cover subtitle is baked server-side).
- [ ] Empty (no published pages) and 404 (bad token) states render their messages.
- [ ] Direct load of `/book/{token}` works (SPA fallback — Vite dev has it; verify Caddy for prod in P12/deploy).

## Not this session

The token endpoints (s13a) · the in-app share UI (s13c) · Caddy prod SPA config (verify at deploy/P12, noted in
`../sv2-s13-share-link.md`).

## Closing note

Record the actual duration and **list every `templateId` you wired**, so a future page type doesn't silently
fail to render on the public page (the classic drift between the app renderer and this one).
