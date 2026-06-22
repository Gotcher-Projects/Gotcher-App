// Strip the [PHOTO:…] placeholder markers the AI generator embeds, and collapse runs of 3+ newlines
// down to a single blank line. The one place this cleanup lives — used wherever stored chapter or
// generated body text is shown, laid out, or exported.
export function cleanBodyText(s) {
  return (s || '').replace(/\[PHOTO:[^\]]+\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
