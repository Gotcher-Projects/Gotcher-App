import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Type, Image as ImageIcon, ChevronDown } from "lucide-react";

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

const BADGE_CLS = {
  first_time: 'bg-violet-50 text-violet-700 border-violet-200',
  bump:       'bg-rose-50 text-rose-700 border-rose-200',
  journal:    'bg-blue-50 text-blue-700 border-blue-200',
};
const BADGE_LABEL = { first_time: 'First', bump: 'Bump', journal: 'Journal' };

function MemoryCard({ memory, selectedSource, usedTextKeys, usedPhotoKeys, onSelect }) {
  const badgeCls = BADGE_CLS[memory.type] || BADGE_CLS.journal;
  const bodyText = memory.aiBody || memory.preview || '';
  // Photos: guided memories carry a photos[] (hero + extras + bump); freeform memories carry a single
  // photoUrl on the memory's own sourceKey — synthesise a one-item list so both render the same way.
  const photos = memory.photos && memory.photos.length
    ? memory.photos
    : (memory.photoUrl ? [{ sourceKey: memory.sourceKey, url: memory.photoUrl, label: memory.label }] : []);
  // Bump memories have no draggable text piece (hasText === false). Freeform memories leave hasText
  // undefined, so the text slot still shows (matches the pre-s7.5a behaviour).
  const showText = memory.hasText !== false;
  const textSelected = selectedSource?.kind === 'text' && selectedSource.sourceKey === memory.sourceKey;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0 rounded-full border font-medium ${badgeCls}`}>
          {BADGE_LABEL[memory.type] || 'Journal'}
        </span>
        <p className="text-sm font-semibold leading-snug truncate">
          {memory.aiTitle || memory.label}
        </p>
      </div>

      {showText && (
        <DraggablePiece
          kind="text"
          sourceKey={memory.sourceKey}
          selected={textSelected}
          used={usedTextKeys.has(memory.sourceKey)}
          onSelect={() => onSelect('text', memory.sourceKey)}
          icon={Type}
        >
          {bodyText ? (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-snug">{bodyText}</p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">No text generated yet</p>
          )}
        </DraggablePiece>
      )}

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <DraggablePiece
              key={photo.sourceKey}
              kind="photo"
              sourceKey={photo.sourceKey}
              selected={selectedSource?.kind === 'photo' && selectedSource.sourceKey === photo.sourceKey}
              used={usedPhotoKeys.has(photo.sourceKey)}
              onSelect={() => onSelect('photo', photo.sourceKey)}
              icon={ImageIcon}
            >
              <img src={photo.url} alt="" className="w-14 h-14 rounded object-cover" />
            </DraggablePiece>
          ))}
        </div>
      )}
    </div>
  );
}

// Guided (sv2-s7.5a): the memory pool grouped into collapsible time-bucket sections. The page's
// defaultOpenBucket starts expanded (its curation); the rest are one tap away. Generic pages pass a
// null defaultOpenBucket, so everything opens collapsed.
function BucketedPanel({ buckets, defaultOpenBucket, selectedSource, usedTextKeys, usedPhotoKeys, onSelect }) {
  const [open, setOpen] = useState(() => new Set(defaultOpenBucket ? [defaultOpenBucket] : []));
  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const total = buckets.reduce((n, b) => n + b.memories.length, 0);

  return (
    <aside className="md:w-80 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-border overflow-y-auto p-4 space-y-2 max-h-[38vh] md:max-h-none">
      <div className="mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your Memories ({total})
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
          Open a time period, then drag a photo or note onto a slot — or tap to select, then tap a slot.
        </p>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No journals, firsts, or bump photos yet.</p>
      ) : (
        buckets.map((bucket) => {
          const isOpen = open.has(bucket.id);
          return (
            <div key={bucket.id} className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => toggle(bucket.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
              >
                <span className="text-xs font-semibold text-foreground">
                  {bucket.label} <span className="text-muted-foreground font-normal">({bucket.memories.length})</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="p-2 space-y-2 bg-background">
                  {bucket.memories.map((m) => (
                    <MemoryCard
                      key={m.sourceKey}
                      memory={m}
                      selectedSource={selectedSource}
                      usedTextKeys={usedTextKeys}
                      usedPhotoKeys={usedPhotoKeys}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </aside>
  );
}

// Left panel: the chapter's memory pieces, each draggable / tap-to-select. Guided books pass
// `buckets` (grouped by time) and render the collapsible view; freeform passes a flat `memories` list.
export default function MemoryPanel({ memories, buckets, defaultOpenBucket, selectedSource, usedTextKeys, usedPhotoKeys, onSelect }) {
  if (buckets) {
    return (
      <BucketedPanel
        buckets={buckets}
        defaultOpenBucket={defaultOpenBucket}
        selectedSource={selectedSource}
        usedTextKeys={usedTextKeys}
        usedPhotoKeys={usedPhotoKeys}
        onSelect={onSelect}
      />
    );
  }

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
            usedTextKeys={usedTextKeys}
            usedPhotoKeys={usedPhotoKeys}
            onSelect={onSelect}
          />
        ))
      )}
    </aside>
  );
}
