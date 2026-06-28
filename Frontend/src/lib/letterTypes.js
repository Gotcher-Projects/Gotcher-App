// Letter type registry — the extensibility point for the "Letter" page.
//
// A letter is a layout-system page (the `letter` template + LetterCanvas renderer); adding a new
// letter *type* is purely additive: append an entry here. A type maps an id to the title shown on
// the page. Consumers:
//   • Guided Book (sv2-s6) — its arc references a letterTypeId and seeds the title block from `title`.
//   • Scrapbook — a generic "Letter" page today; a type can pre-seed the title when selected.
//   • AI assist (sv2-ai-assist, later) — `promptTemplate` seeds the optional "write this for me" field.
//
// The renderer/storage are type-agnostic, so this stays a thin config — no structural coupling.

export const LETTER_TYPES = [
  {
    id: 'pre_birth',
    title: 'A Letter Before You Arrived',
    description: 'Written before or just after birth — your hopes, dreams and what you were feeling.',
    suggestedTiming: 'Any time — can be written retroactively',
    // Seed for the later AI assist only. (baby, parent, input) → prompt string.
    promptTemplate: (baby, parent, input) =>
      `Write a heartfelt letter from ${parent || 'a parent'} to their baby ${baby || ''}, who has ` +
      `not yet arrived (or has just arrived). Warm, personal, first person. Use these notes as ` +
      `inspiration: ${input || ''}`,
  },
  // Future types (additive — no renderer/storage changes):
  //   { id: 'six_months',     title: 'A Letter to You at 6 Months', … }
  //   { id: 'first_birthday', title: 'A Letter on Your First Birthday', … }
  //   { id: 'for_when_youre_older', title: "A Letter for When You're Older", … }
];

export function getLetterType(id) {
  return LETTER_TYPES.find(t => t.id === id) ?? null;
}
