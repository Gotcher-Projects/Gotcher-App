import { useState } from "react";
import { twemojiSrc } from "@/lib/twemoji";

// Renders the bundled Twemoji SVG for an emoji (consistent across devices), falling back to the
// native OS glyph if the asset is ever missing. `className` styles the <img>; `fallbackClassName`
// styles the native-glyph span (defaults to `className`). Pass `decorative` when adjacent text
// already conveys the meaning — the image is then aria-hidden with an empty alt.
export default function TwemojiImage({ emoji, label, className = "", fallbackClassName, decorative = false }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={fallbackClassName ?? className} role="img" aria-label={label}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={twemojiSrc(emoji)}
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
