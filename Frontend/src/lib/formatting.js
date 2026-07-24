// Parse a date value into a Date in the LOCAL timezone.
//
// Date-only strings ('YYYY-MM-DD') are anchored to local NOON before parsing: `new Date('2026-04-01')`
// is interpreted as UTC midnight, which renders as the *previous* calendar day in any UTC-negative
// timezone. Anchoring to noon keeps the displayed date stable across all zones. Full ISO timestamps
// and Date objects are passed through untouched (their time component already pins the instant).
function toLocalDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T12:00:00');
  }
  return new Date(value);
}

/**
 * Format a date value as a localized ("en-US") date string. The single date formatter for the app —
 * always use this for displaying dates so timezone handling and style stay consistent.
 *
 * @param {string|Date} value                   date-only string, ISO timestamp, or Date
 * @param {object}  [opts]
 * @param {'long'|'short'} [opts.style='long']   month length — 'long' → "April", 'short' → "Apr"
 * @param {boolean} [opts.withYear=true]         include the year
 * @returns {string} formatted date, or '' for empty/invalid input
 */
export function formatDate(value, { style = 'long', withYear = true } = {}) {
  if (!value) return '';
  const d = toLocalDate(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: style === 'short' ? 'short' : 'long',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** Format a date value as "Month Year" (e.g. "April 2026") — for month grouping headers. */
export function formatMonthYear(value) {
  if (!value) return '';
  const d = toLocalDate(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Formats any date value as "Month Day, Year".
 * @deprecated thin alias kept for `lib/pdf.js`; prefer {@link formatDate}.
 */
export function formatEntryDate(date) {
  return formatDate(date);
}

/** "1:23:45" style — used for raw stopwatch durations (seconds precision). */
export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Money, from the integer cents every payments/print endpoint speaks → "$70.00". Shared by the print
 * order modal (pr8) and the order confirmation (pr9) so a total reads identically before and after checkout.
 */
export function formatCents(cents, currency = 'USD') {
  if (cents == null) return '';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

/** "1h 23m" style — used for sleep/feeding totals where sub-minute precision is unnecessary. */
export function fmtDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
