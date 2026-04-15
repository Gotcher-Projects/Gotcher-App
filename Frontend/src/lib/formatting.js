/** Formats any date value (string or Date) as "Month Day, Year". */
export function formatEntryDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}
