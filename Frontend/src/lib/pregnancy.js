const GESTATION_DAYS = 280; // 40 weeks; due date = LMP + 280d

// 'pregnancy' | 'baby' | 'incomplete'
// phase is NOT NULL on every saved row, so the stored value always wins. 'incomplete' only
// covers a brand-new user mid-onboarding (no saved profile yet) — not a persisted row.
export function profilePhase(profile) {
  return profile?.phase ?? 'incomplete';
}

// Whole weeks pregnant today, from the due date. Clamp to [0, 42].
export function weeksPregnant(dueDate, today = new Date()) {
  const due = new Date(dueDate);
  const lmp = new Date(due); lmp.setDate(lmp.getDate() - GESTATION_DAYS);
  const days = Math.floor((today - lmp) / 86400000);
  return Math.max(0, Math.min(42, Math.floor(days / 7)));
}

export function daysUntilDue(dueDate, today = new Date()) {
  return Math.ceil((new Date(dueDate) - today) / 86400000);
}

// 1 | 2 | 3 — trimester from completed weeks (1st = wk 1–13, 2nd = wk 14–27, 3rd = wk 28+).
export function trimester(week) {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}
