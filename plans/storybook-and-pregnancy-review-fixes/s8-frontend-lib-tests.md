# s8 — Frontend Lib Test Coverage

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** s7 (so tests cover the new shared utilities too)
**Source:** `branch-review.html` → Pass 3 (P2 + P3 frontend gaps)

---

## Goal
Fill the remaining frontend lib test gaps and cover the utilities introduced in s7.

## Scope
- **`twemoji.test.js`** (new): `twemojiCode('🍌')` → `1f34c`; `U+FE0F` variation selector stripped;
  multi-codepoint / ZWJ sequence → hyphen-joined hex; `twemojiSrc` → `/images/twemoji/<code>.svg`.
- **`bumpDiary.deriveWeek`** (add to existing `bumpDiary.test.js`): null refDate or dateStr → null;
  invalid date → null; valid date resolves to the same week as `weeksPregnant` (UTC-anchored).
- **`bookCanvas` `cropStyle` / `blockBoxStyle`** (add to existing `bookCanvas.test.js`): assert the
  CSS object math for a sample crop and a sample normalized block on the 600×800 canvas.
- **`storybookPdf.downloadPdf` slug + `bookThemes.getTheme`**: kebab slug (lowercase, spaces
  collapsed, default `storybook`); `getTheme` returns match or falls back to `classic`.
- **s7 utilities**: `cleanBodyText` (photo-marker strip + blank-line collapse + trim) and
  `formatDate` (TZ-safe, style/withYear variants).

## Out of scope
- `useFittedFontSize` and `html2canvas` capture — need a real browser; covered by `renderSmoke` +
  manual checks, not brittle jsdom mocks.

## Files
- `Frontend/src/test/twemoji.test.js` (new)
- `Frontend/src/test/bumpDiary.test.js` (extend)
- `Frontend/src/test/bookCanvas.test.js` (extend)
- `Frontend/src/test/storybookPdf.test.js` (new, slug only) / `bookThemes.test.js` (new)
- `Frontend/src/test/` — tests for the new s7 utils

## Verification
1. `npm run test` — all new/extended tests pass.
