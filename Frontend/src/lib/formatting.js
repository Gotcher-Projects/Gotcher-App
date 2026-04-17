/** Formats any date value (string or Date) as "Month Day, Year". */
export function formatEntryDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}

/** "1:23:45" style — used for raw stopwatch durations (seconds precision). */
export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "1h 23m" style — used for sleep/feeding totals where sub-minute precision is unnecessary. */
export function fmtDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
