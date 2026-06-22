import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Type, Image as ImageIcon } from "lucide-react";

// A draggable content piece (text or photo). Tapping selects it for click-to-place;
// dragging (>8px) starts a drag. A matching slot then accepts either gesture.
function DraggablePiece({ kind, sourceKey, selected, used, onSelect, icon: Icon, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${kind}:${sourceKey}`,
    data: { kind, sourceKey },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      style={{ opacity: isDragging ? 0.4 : used ? 0.55 : 1 }}
      className={`flex items-start gap-2 p-2 rounded-lg border bg-background cursor-grab active:cursor-grabbing touch-none transition-shadow hover:shadow-sm ${
        selected ? 'border-color-highlight ring-2 ring-color-highlight/40' : 'border-dashed border-border'
      }`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
      <Icon className="w-3.5 h-3.5 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
      {used && (
        <span className="self-center flex-shrink-0 text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
          Used
        </span>
      )}
    </div>
  );
}

function MemoryCard({ memory, selectedSource, usedText, usedPhoto, onSelect }) {
  const badgeCls = memory.type === 'first_time'
    ? 'bg-violet-50 text-violet-700 border-violet-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';
  const bodyText = memory.aiBody || memory.preview || '';
  const textSelected = selectedSource?.kind === 'text' && selectedSource.sourceKey === memory.sourceKey;
  const photoSelected = selectedSource?.kind === 'photo' && selectedSource.sourceKey === memory.sourceKey;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0 rounded-full border font-medium ${badgeCls}`}>
          {memory.type === 'first_time' ? 'First' : 'Journal'}
        </span>
        <p className="text-sm font-semibold leading-snug truncate">
          {memory.aiTitle || memory.label}
        </p>
      </div>

      <DraggablePiece
        kind="text"
        sourceKey={memory.sourceKey}
        selected={textSelected}
        used={usedText}
        onSelect={() => onSelect('text', memory.sourceKey)}
        icon={Type}
      >
        {bodyText ? (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-snug">{bodyText}</p>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">No text generated yet</p>
        )}
      </DraggablePiece>

      {memory.photoUrl && (
        <DraggablePiece
          kind="photo"
          sourceKey={memory.sourceKey}
          selected={photoSelected}
          used={usedPhoto}
          onSelect={() => onSelect('photo', memory.sourceKey)}
          icon={ImageIcon}
        >
          <img src={memory.photoUrl} alt="" className="w-14 h-14 rounded object-cover" />
        </DraggablePiece>
      )}
    </div>
  );
}

// Left panel: the chapter's memory pieces, each draggable / tap-to-select.
export default function MemoryPanel({ memories, selectedSource, usedTextKeys, usedPhotoKeys, onSelect }) {
  return (
    <aside className="md:w-80 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-border overflow-y-auto p-4 space-y-3 max-h-[38vh] md:max-h-none">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Memories ({memories.length})
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
          Drag onto a slot — or tap to select, then tap a slot. Tap a text slot to edit it.
        </p>
      </div>
      {memories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No memories in this chapter.</p>
      ) : (
        memories.map(m => (
          <MemoryCard
            key={m.sourceKey}
            memory={m}
            selectedSource={selectedSource}
            usedText={usedTextKeys.has(m.sourceKey)}
            usedPhoto={usedPhotoKeys.has(m.sourceKey)}
            onSelect={onSelect}
          />
        ))
      )}
    </aside>
  );
}
