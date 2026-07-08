import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/formatting";
import { Star, ImageOff } from "lucide-react";

// Pick-a-First dialog (sv2-s7b). Lists the baby's First Times so the user can choose which one to
// feature on a guided moment_hero page. Choosing seeds the page (see seedMomentHeroFromFirst). Firsts
// already featured elsewhere in this book get a soft "Already featured" hint — not a hard block.
export default function FirstPicker({ firsts = [], featuredIds, onChoose, onClose }) {
  const featured = featuredIds || new Set();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a First to feature</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Its photo and details fill the page — you can edit everything after.
          </p>
        </DialogHeader>

        {firsts.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <Star className="w-10 h-10 text-color-highlight/30" />
            <p className="text-sm font-medium text-foreground">No Firsts logged yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Add a First in the Firsts tab, or close this and fill the page in by hand.
            </p>
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-2">
            {firsts.map((f) => {
              const isFeatured = featured.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => onChoose?.(f)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border bg-color-warm/10 hover:border-color-highlight/50 hover:bg-color-warm/20 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                    {f.imageUrl ? (
                      <img src={f.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff className="w-5 h-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{f.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.occurredDate ? formatDate(f.occurredDate) : ""}
                    </p>
                  </div>
                  {isFeatured && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                      Already featured
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
