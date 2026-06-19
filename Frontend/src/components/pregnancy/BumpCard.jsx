import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { sizeForWeek } from "../../lib/pregnancySizes";
import { twemojiSrc } from "../../lib/twemoji";

// Small inline size emoji — bundled Twemoji SVG with native-glyph fallback (matches PregnancyHome).
function SizeEmoji({ emoji, label }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span role="img" aria-label={label}>{emoji}</span>;
  return (
    <img
      src={twemojiSrc(emoji)}
      alt=""
      aria-hidden="true"
      className="inline-block w-5 h-5 align-text-bottom"
      onError={() => setFailed(true)}
    />
  );
}

function formatDate(takenDate) {
  if (!takenDate) return "";
  const d = new Date(takenDate + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
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

  return (
    <Card className="overflow-hidden rounded-2xl shadow-md shadow-color-highlight/15 flex flex-col">
      <div className={`w-full ${aspect} overflow-hidden bg-muted`}>
        {imageUrl && <img src={imageUrl} alt={`Bump at week ${week}`} className="w-full h-full object-cover" />}
      </div>
      <CardContent className="p-4 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap leading-tight">
          <span className="font-semibold text-foreground">Week {week} ·</span>
          <span className="font-display font-bold text-primary">{size.label}</span>
          <SizeEmoji emoji={size.emoji} label={size.label} />
        </div>
        {dateStr && <p className="text-sm text-muted-foreground mt-1">{dateStr}</p>}
        {note && <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">{note}</p>}
      </CardContent>
      {actions}
    </Card>
  );
}
