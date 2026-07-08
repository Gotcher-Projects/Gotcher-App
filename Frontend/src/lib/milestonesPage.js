// Shared helpers for the Storybook "How You Grew" milestones page (sv2-s6.5).
// The page is a HYBRID: milestone NAMES come from the baby's achieved milestones (data-driven),
// each row's DATE is prefill (seeded from when it was marked, editable in the builder), and there
// are two photo slots (fill). These helpers are shared by MilestonesCanvas (render) and
// ScrapbookBuilder (the "Refresh from data" action) so the seeding logic lives in one place.

import { MILESTONES } from '@/lib/babyData';
import { formatDate } from '@/lib/formatting';

// The fixed design (Panel F) fits seven milestones in the left column beside the polaroids.
export const MAX_MILESTONE_ROWS = 7;

// Resolve a stable milestone key ("36-1") → its display name via the MILESTONES dataset.
export function milestoneName(key) {
  if (!key) return '';
  const [groupStr, idxStr] = String(key).split('-');
  const group = Number(groupStr);
  const idx = Number(idxStr);
  return MILESTONES[group]?.[idx] || String(key);
}

// Normalize the raw `/milestones` `achieved` array ([{ key, achievedAt }]) into the page shape:
// [{ key, name, achievedAt }], oldest-first. Threaded into pageData by StorybookTab.
export function buildAchievedMilestones(rawAchieved = []) {
  return [...rawAchieved]
    .filter(a => a && a.key)
    .map(a => ({ key: a.key, name: milestoneName(a.key), achievedAt: a.achievedAt || null }))
    .sort((a, b) => String(a.achievedAt || '').localeCompare(String(b.achievedAt || '')));
}

// The seeded (fallback) date string shown for row i when its date block hasn't been edited.
// Short, year-less to match the Panel F design ("March 2").
export function seededMilestoneDate(achievedMilestones = [], i) {
  return formatDate(achievedMilestones[i]?.achievedAt, { style: 'long', withYear: false });
}
