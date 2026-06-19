// Pure helpers for the bump diary (extracted from BumpDiary.jsx so they're unit-testable).

import { weeksPregnant } from "./pregnancy";

// Derive the pregnancy week from an entry's date (S5). One-directional: Date drives Week.
// `refDate` is the due date when known, else the birthdate (≈ due date) — baby mode always has a
// birthdate, so backfilling old photos by their date still resolves the right week. Returns null
// when we can't derive (no reference date or no/invalid date) so callers can leave the week as-is.
export function deriveWeek(refDate, dateStr) {
  if (!refDate || !dateStr) return null;
  // Parse as UTC midnight to align with how weeksPregnant parses the (date-only) reference, so the
  // day math is exact and timezone-independent.
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  return weeksPregnant(refDate, d);
}

// First week 4–40 without a photo. Used as the add-form default in baby mode (backfilling old
// photos, where the current pregnancy week is meaningless). Falls back to 40 when every week is used.
export function firstEmptyWeek(photos) {
  const used = new Set(photos.map(p => p.week));
  for (let w = 4; w <= 40; w++) if (!used.has(w)) return w;
  return 40;
}

// Group photos into { week, items[] } sections for the divider timeline, sorted week ASC then by
// taken date. Multiple photos in one week share a section (no unique-per-week constraint).
export function groupByWeek(photos) {
  const sorted = [...photos].sort(
    (a, b) => a.week - b.week || (a.takenDate || "").localeCompare(b.takenDate || "")
  );
  const groups = [];
  for (const p of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.week === p.week) last.items.push(p);
    else groups.push({ week: p.week, items: [p] });
  }
  return groups;
}
