import React from "react";
import { FONT_MAP, FONT_OPTIONS } from "@/lib/bookCanvas";

// Floating font-family picker overlaid on a selected/editing text block.
// `preventDefault` on mousedown keeps the contenteditable focused while editing.
// Clicking the active font with an explicit override clears it (back to theme default).
export default function FontPicker({ activeFontKey, hasOverride, onChange }) {
  return (
    <div
      className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5 bg-black/60 backdrop-blur-sm rounded-lg px-1.5 py-1 z-40"
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.preventDefault()}
      onClick={e => e.stopPropagation()}
    >
      {FONT_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.preventDefault()}
          onClick={e => { e.stopPropagation(); onChange(activeFontKey === key && hasOverride ? null : key); }}
          className={`px-1.5 py-0.5 rounded text-[10px] text-white transition-colors ${activeFontKey === key ? 'bg-white/30' : 'hover:bg-white/15'}`}
        >
          <span className={FONT_MAP[key]}>{label}</span>
        </button>
      ))}
    </div>
  );
}
