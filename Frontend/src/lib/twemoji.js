// Map an emoji string to its Twemoji asset filename (lowercase, hyphen-joined codepoints, with
// the U+FE0F variation selector stripped — matching Twemoji's filename convention).
export function twemojiCode(emoji) {
  return [...emoji]
    .map(ch => ch.codePointAt(0).toString(16))
    .filter(hex => hex !== "fe0f")
    .join("-");
}

// Local path to the bundled Twemoji SVG (see scripts/fetch-twemoji.mjs).
export function twemojiSrc(emoji) {
  return `/images/twemoji/${twemojiCode(emoji)}.svg`;
}
