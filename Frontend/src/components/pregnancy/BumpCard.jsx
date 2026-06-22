import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { sizeForWeek } from "../../lib/pregnancySizes";
import { formatDate } from "@/lib/formatting";
import TwemojiImage from "@/components/ui/TwemojiImage";

// Small inline size emoji — bundled Twemoji SVG with native-glyph fallback (see TwemojiImage).
function SizeEmoji({ emoji, label }) {
  return (
    <TwemojiImage
      emoji={emoji}
      label={label}
      className="inline-block w-5 h-5 align-text-bottom"
      decorative
    />
  );
}

/**
 * Shared, reusable bump-photo card: photo-forward, caption below.
 * Pure presentational — pass an `actions` node (edit/delete) for the diary; omit it for
 * storybook / social-card reuse. Orientation switches only the photo aspect (3:4 vs 3:2).
 */
export default function BumpCard({ imageUrl, imageOrientation = "portrait", week, takenDate, note, actions }) {
  const size = sizeForWeek(week);
  const aspect = imageOrientation === "landscape" ? "aspect-[3/2]" : "aspect-[3/4]";
  const dateStr = formatDate(takenDate);
  const hasImage = !!imageUrl;

  const caption = (
    <CardContent className="p-4 flex-1">
      <div className="flex items-center gap-1.5 flex-wrap leading-tight">
        <span className="font-semibold text-foreground">Week {week} ·</span>
        <span className="font-display font-bold text-primary">{size.label}</span>
        <SizeEmoji emoji={size.emoji} label={size.label} />
      </div>
      {dateStr && <p className="text-sm text-muted-foreground mt-1">{dateStr}</p>}
      {note && <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">{note}</p>}
    </CardContent>
  );

  // Text-only variant (no photo): a story moment ("we found out", "first kick"). Mirrors the baby
  // journal's no-image card — left accent border, caption carries the entry.
  if (!hasImage) {
    return (
      <Card className="overflow-hidden rounded-2xl shadow-md shadow-color-highlight/15 flex flex-col border-l-2 border-l-color-highlight/40">
        {caption}
        {actions}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl shadow-md shadow-color-highlight/15 flex flex-col">
      <div className={`w-full ${aspect} overflow-hidden bg-muted`}>
        <img src={imageUrl} alt={`Bump at week ${week}`} className="w-full h-full object-cover" />
      </div>
      {caption}
      {actions}
    </Card>
  );
}
