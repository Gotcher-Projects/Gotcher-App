import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Layers } from "lucide-react";

// The new-book chooser (sv2-s7a). Guided is the recommended default; freeform is the advanced option.
// In s7a both create an empty book — the guided arc is materialised in s7b.
export default function NewBookChooser({ onCreate, onClose, dismissable = true }) {
  function handleOpenChange(open) {
    if (!open && dismissable) onClose?.();
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        onInteractOutside={(e) => { if (!dismissable) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!dismissable) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Start a new book</DialogTitle>
          <p className="text-sm text-muted-foreground">How would you like to build it?</p>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => onCreate('guided')}
            className="relative text-left p-4 rounded-xl border border-border bg-color-warm/10 hover:border-color-highlight/50 hover:bg-color-warm/20 transition-all"
          >
            <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-color-highlight/15 text-color-highlight border border-color-highlight/30">
              Recommended
            </span>
            <BookOpen className="w-7 h-7 text-color-highlight/70 mb-2" />
            <p className="font-semibold text-foreground">Guided book</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              A ready-made keepsake with labelled pages — just add your photos and words.
            </p>
          </button>

          <button
            onClick={() => onCreate('freeform')}
            className="text-left p-4 rounded-xl border border-border bg-color-warm/10 hover:border-color-highlight/50 hover:bg-color-warm/20 transition-all"
          >
            <Layers className="w-7 h-7 text-color-highlight/70 mb-2" />
            <p className="font-semibold text-foreground">Freeform book</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              A blank canvas — build your own chapters and arrange pages however you like.
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
