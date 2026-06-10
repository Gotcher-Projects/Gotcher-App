# SV2-S6 — Guided Book Shell

**Status: Not started**
**Depends on:** sv2-s1 through sv2-s5 complete (or at minimum sv2-s1 and sv2-s2)
**Reference:** `planning.md` Q1 — lives in Book tab as a distinct section; whole-book editor long-term vision

---

## Goal

Build the **Guided Book shell** — the container UI that presents the predetermined chapter arc, lets users navigate the full book as one continuous experience, and surfaces the "fill in this moment" entry points for each section. This session is the structural layer; the individual page types (LetterPage, BirthDayPage, PeoplePage, MomentHeroPage) already exist from earlier sessions.

---

## Concept

The guided book is not a chapter-by-chapter list. It's a **page-flow view** of the entire book at once — like flipping through a real book — with "fill in" placeholders for sections the user hasn't completed yet.

Entry point: a "Guided Book" button/section in the existing Book tab, separate from the scrapbook chapter list. Long-term this may become the primary book view; for now it coexists.

---

## Book Arc (config-driven)

The chapter arc is defined in a config file, not hardcoded in the component:

```js
// Frontend/src/lib/guidedBookArc.js
export const GUIDED_BOOK_ARC = [
  {
    id: 'cover',
    title: 'Cover',
    type: 'cover',
    required: true,
  },
  {
    id: 'about_you',
    title: 'About You',
    subtitle: 'Where your story begins',
    type: 'chapter_divider',
    icon: 'heart',
    sections: [
      { id: 'letter_pre_birth', type: 'letter', letterTypeId: 'pre_birth', title: 'A Letter Before You Arrived' },
      { id: 'people',           type: 'people',  title: 'Your People' },
    ],
  },
  {
    id: 'birth',
    title: 'Birth',
    subtitle: 'The day we met you',
    type: 'chapter_divider',
    icon: 'sparkle',
    sections: [
      { id: 'birth_day', type: 'birth_day', title: 'The Day We Met You' },
    ],
  },
  {
    id: 'firsts',
    title: 'First Times',
    subtitle: 'Every new beginning',
    type: 'chapter_divider',
    icon: 'star',
    sections: [
      { id: 'firsts_chapter', type: 'firsts_chapter', title: 'Your Firsts' },
    ],
  },
  // Future: Month 1, Year 1, Pregnancy (when pregnancy track lands)
];
```

The arc is additive — new chapters can be appended without touching the shell component.

### 2. `ChapterDividerPage.jsx` component
New file: `Frontend/src/components/storybook/ChapterDividerPage.jsx`

Fixed layout. Props:
```js
{
  chapterNumber: Number,
  title: String,
  subtitle: String,
  icon: String,   // 'heart' | 'sparkle' | 'star' etc.
  theme: BookTheme,
}
```

Layout:
- "CHAPTER N" small caps label with horizontal rules either side
- Section icon badge (circle with icon inside, accent color fill)
- Large bold chapter title
- Italic subtitle
- Floating decorative elements in corners (hearts, sparkles, small shapes) — CSS-positioned, accent/gold colors
- Generous whitespace, centered composition

The floating decoratives are the polish piece. Options:
- CSS pseudo-elements (won't work in html2canvas — must use real DOM elements)
- Absolutely positioned spans with emoji or SVG icons
- SVG element in the component

Use absolutely positioned spans (consistent with html2canvas constraints documented in `feedback_html2canvas_limitations.md`).

### 3. `GuidedBook.jsx` shell component
New file: `Frontend/src/components/storybook/GuidedBook.jsx`

Full-screen view (same pattern as `ScrapbookBuilder.jsx`). Contains:
- **Left panel:** book outline/navigation — chapter list with completion indicators; click to jump to a section
- **Right panel:** book page viewer — displays the current page, navigated with prev/next arrows
- **Page sequence:** built dynamically from `GUIDED_BOOK_ARC` + user's data (skips empty sections or shows placeholders)

Page sequence builder: for each arc section, resolve what pages to render:
- `letter` → LetterPage (or placeholder if not generated)
- `birth_day` → BirthDayPage (or placeholder)
- `people` → one or more PeoplePages
- `firsts_chapter` → sequential MomentHeroPage + GalleryPage pairs
- `chapter_divider` → ChapterDividerPage

Placeholder page: "Fill in this section" card with a CTA to add the relevant data. Shown when a section's data is missing or not yet generated.

### 4. Entry point in StorybookTab

Add a "Guided Book" button/card to `StorybookTab.jsx` — launches `GuidedBook` as a full-screen overlay (same pattern as `builderChapter` → `ScrapbookBuilder`). A `guidedBookOpen` state boolean controls this.

### 5. Completion indicators

Left panel shows each section as:
- ✅ Complete (data exists + page generated)
- 🟡 In progress (data partial)
- ⬜ Not started (placeholder)

Derived from the user's data — no separate "completion" state stored.

---

## Data storage for guided book state

The guided book is largely **derived** — it reads from existing data (first_times, birth_details, family_members, storybook_chapters) and renders pages. The only thing stored is generated AI content (letters, notes) which live in storybook_chapters as before.

No new "guided book" table needed. The arc config + user data = the book.

---

## Files to touch

| File | Change |
|---|---|
| `Frontend/src/lib/guidedBookArc.js` | New — book arc config |
| `Frontend/src/components/storybook/ChapterDividerPage.jsx` | New — chapter divider renderer |
| `Frontend/src/components/storybook/GuidedBook.jsx` | New — guided book shell |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Add guided book entry point + guidedBookOpen state |

---

## Open questions (resolve at session start)

1. **Floating decoratives on chapter dividers:** SVG icons, emoji, or CSS-positioned spans with Unicode characters? Must work in html2canvas.
2. **Placeholder pages:** Should a section with no data show a "fill in" placeholder page in the book view, or simply be skipped?
3. **Navigation:** Prev/next arrows, or a scrollable vertical flow? Prev/next is closer to real book feel.
4. **Pregnancy chapter:** Arc has no pregnancy section yet. Add a commented-out placeholder for when the pregnancy track lands?
5. **PDF from guided book:** Does the guided book have its own "Download PDF" button, or does it reuse the existing StorybookTab PDF export?

---

## Verification

1. "Guided Book" button in Book tab launches the GuidedBook full-screen view.
2. Chapter divider pages render correctly with floating decoratives.
3. All existing page types (LetterPage, BirthDayPage, PeoplePage, MomentHeroPage) render correctly in the page sequence.
4. Empty sections show placeholder pages with CTAs.
5. Left panel navigation jumps to the correct section.
6. Close button returns to the main Book tab.
