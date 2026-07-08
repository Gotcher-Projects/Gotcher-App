import React from "react";
import { ChevronDown, BookMarked } from "lucide-react";

// Quiet header control that names the current book and opens the "Your Books" shelf (sv2-s7a).
export default function BookSwitcher({ title, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 group text-left"
      title="Switch books"
    >
      <BookMarked className="w-4 h-4 text-muted-foreground/70 shrink-0" />
      <span className="font-display font-semibold text-foreground text-lg leading-tight truncate max-w-[260px]">
        {title}
      </span>
      <ChevronDown className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}
