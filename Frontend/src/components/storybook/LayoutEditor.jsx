import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { X, Plus, ChevronLeft, ChevronRight, LayoutTemplate, Type, Image, Camera } from "lucide-react";

function cleanBody(body) {
  return (body || '').replace(/\[PHOTO:[^\]]+\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

const TEMPLATES = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Text above, photo below',
    blocks: [
      { type: 'text',  x: 0.04, y: 0.04, width: 0.92, height: 0.38, content: '' },
      { type: 'photo', x: 0.04, y: 0.46, width: 0.92, height: 0.50 },
    ],
  },
  {
    id: 'side-by-side',
    label: 'Side by Side',
    description: 'Text left, photo right',
    blocks: [
      { type: 'text',  x: 0.04, y: 0.04, width: 0.44, height: 0.92, content: '' },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.44, height: 0.92 },
    ],
  },
  {
    id: 'hero',
    label: 'Hero Photo',
    description: 'Full-page photo, caption overlay',
    blocks: [
      { type: 'photo', x: 0.0,  y: 0.0,  width: 1.0,  height: 1.0 },
      { type: 'text',  x: 0.04, y: 0.76, width: 0.92, height: 0.20, content: '' },
    ],
  },
  {
    id: 'gallery',
    label: 'Gallery',
    description: 'Two photos, text below',
    blocks: [
      { type: 'photo', x: 0.04, y: 0.04, width: 0.44, height: 0.44 },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.44, height: 0.44 },
      { type: 'text',  x: 0.04, y: 0.52, width: 0.92, height: 0.44, content: '' },
    ],
  },
  {
    id: 'text-only',
    label: 'Text Only',
    description: 'Full-page text',
    blocks: [
      { type: 'text', x: 0.04, y: 0.04, width: 0.92, height: 0.92, content: '' },
    ],
  },
];

// Resize handle styles — small squares at corners + edge midpoints
const HANDLE_STYLE = {
  width: 10,
  height: 10,
  background: 'white',
  border: '2px solid #9b7e5a',
  borderRadius: 2,
  zIndex: 30,
};
const RESIZE_HANDLE_STYLES = {
  topLeft:     { ...HANDLE_STYLE, top: -5,    left: -5    },
  topRight:    { ...HANDLE_STYLE, top: -5,    right: -5   },
  bottomLeft:  { ...HANDLE_STYLE, bottom: -5, left: -5    },
  bottomRight: { ...HANDLE_STYLE, bottom: -5, right: -5   },
  top:         { ...HANDLE_STYLE, top: -5,    left: '50%', transform: 'translateX(-50%)' },
  bottom:      { ...HANDLE_STYLE, bottom: -5, left: '50%', transform: 'translateX(-50%)' },
  left:        { ...HANDLE_STYLE, left: -5,   top: '50%',  transform: 'translateY(-50%)' },
  right:       { ...HANDLE_STYLE, right: -5,  top: '50%',  transform: 'translateY(-50%)' },
};

function makeId() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makePageId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

function initPages(chapter) {
  if (chapter.layoutData?.version === 2) {
    return (chapter.layoutData.pages || []).map(p => ({
      id: p.id || makePageId(),
      sourceKey: p.sourceKey || null,
      blocks: (p.blocks || []).map(b => ({ ...b, id: b.id || makeId() })),
    }));
  }
  const blocks = chapter.layoutData?.blocks?.length > 0
    ? chapter.layoutData.blocks.map(b => ({ ...b, id: b.id || makeId() }))
    : [];
  return [{ id: 'p-0', sourceKey: null, blocks }];
}

function getLayoutData(thePages, isV2) {
  if (isV2 || thePages.length > 1) {
    return { version: 2, pages: thePages };
  }
  return { version: 1, blocks: thePages[0].blocks };
}

export default function LayoutEditor({ chapter, journalEntries, firsts, onSave, onPublish, onBack }) {
  const isV2 = chapter.layoutData?.version === 2;
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState(0);
  const [pages, setPages] = useState(() => initPages(chapter));
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [photoTrayFor, setPhotoTrayFor] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [publishing, setPublishing] = useState(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerSize(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const cs = containerSize || 400;
  const currentBlocks = pages[currentPageIndex]?.blocks || [];
  const hasTextBlock = currentBlocks.some(b => b.type === 'text');

  const scheduleAutoSave = useCallback((nextPages) => {
    setSaveStatus('unsaved');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await onSave(getLayoutData(nextPages, isV2));
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    }, 1000);
  }, [onSave, isV2]);

  function setCurrentBlocks(updater) {
    setPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      page.blocks = typeof updater === 'function' ? updater(page.blocks) : updater;
      next[currentPageIndex] = page;
      scheduleAutoSave(next);
      return next;
    });
  }

  function updateBlock(id, patch) {
    setCurrentBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function deleteBlock(id) {
    setCurrentBlocks(prev => prev.filter(b => b.id !== id));
  }

  function addTextBlock() {
    const newBlock = {
      id: makeId(),
      type: 'text',
      x: 0.04, y: 0.04, width: 0.92, height: 0.45,
      content: !hasTextBlock ? cleanBody(chapter.body) : '',
    };
    setCurrentBlocks(prev => [...prev, newBlock]);
  }

  function addPhotoBlock() {
    const newBlock = {
      id: makeId(),
      type: 'photo',
      x: 0.04, y: 0.04, width: 0.92, height: 0.45,
      sourceKey: null, url: null, label: null,
    };
    setCurrentBlocks(prev => [...prev, newBlock]);
  }

  function addPage() {
    const newPage = { id: makePageId(), sourceKey: null, blocks: [] };
    setPages(prev => {
      const next = [...prev, newPage];
      scheduleAutoSave(next);
      return next;
    });
    setCurrentPageIndex(pages.length);
  }

  function applyTemplate(tpl) {
    const newBlocks = tpl.blocks.map(b => ({
      ...b,
      id: makeId(),
      content: b.type === 'text' ? cleanBody(chapter.body) : undefined,
      sourceKey: b.type === 'photo' ? null : undefined,
      url: b.type === 'photo' ? null : undefined,
      label: b.type === 'photo' ? null : undefined,
    }));
    setPages(prev => {
      const next = [...prev];
      next[currentPageIndex] = { ...next[currentPageIndex], blocks: newBlocks };
      scheduleAutoSave(next);
      return next;
    });
    setShowTemplatePicker(false);
  }

  const availablePhotos = useMemo(() => {
    const photos = [];
    for (const id of chapter.selectedJournalIds || []) {
      const entry = journalEntries.find(e => e.id === id);
      if (!entry) continue;
      const url = chapter.photoOverrides?.[`journal:${id}`] || entry.image_url;
      if (url) photos.push({ sourceKey: `journal:${id}`, url, label: entry.title });
    }
    for (const id of chapter.selectedFirstTimeIds || []) {
      const ft = firsts.find(f => f.id === id);
      if (!ft) continue;
      const url = chapter.photoOverrides?.[`first_time:${id}`] || ft.imageUrl;
      if (url) photos.push({ sourceKey: `first_time:${id}`, url, label: ft.label });
    }
    return photos;
  }, [chapter, journalEntries, firsts]);

  function getPageLabel(page) {
    if (!page.sourceKey) return null;
    const [type, idStr] = page.sourceKey.split(':');
    const id = parseInt(idStr);
    if (type === 'journal') return journalEntries.find(e => e.id === id)?.title || null;
    if (type === 'first_time') return firsts.find(f => f.id === id)?.label || null;
    return null;
  }

  async function handlePublish() {
    setPublishing(true);
    clearTimeout(saveTimerRef.current);
    try {
      await onSave(getLayoutData(pages, isV2));
      await onPublish();
    } catch {
      setPublishing(false);
    }
  }

  const saveLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : 'Saved ✓';
  const multiPage = pages.length > 1;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Review
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={addTextBlock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
          >
            <Type className="w-3.5 h-3.5" />
            Add Text
          </button>
          <button
            onClick={addPhotoBlock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
          >
            <Image className="w-3.5 h-3.5" />
            Add Photo
          </button>
          {isV2 && (
            <button
              onClick={addPage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Page
            </button>
          )}
          <button
            onClick={() => setShowTemplatePicker(v => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
            title="Start from a template"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-xs text-muted-foreground">{saveLabel}</span>
      </div>

      {/* Template picker (optional shortcut) */}
      {showTemplatePicker && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Start from a template</p>
            <button onClick={() => setShowTemplatePicker(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Replaces the current page's layout.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => applyTemplate(tpl)}
                className="flex flex-col items-center p-3 rounded-lg border border-border hover:border-color-highlight/50 hover:bg-color-warm/10 transition-all gap-2 text-left"
              >
                <TemplatePreview templateId={tpl.id} />
                <div className="w-full">
                  <p className="text-sm font-medium leading-tight">{tpl.label}</p>
                  <p className="text-xs text-muted-foreground">{tpl.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full bg-white border border-[#ddd0b8] rounded-xl overflow-hidden shadow-sm"
        style={{ aspectRatio: '1 / 1' }}
      >
        {/* Empty state */}
        {currentBlocks.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
            <p className="text-sm text-muted-foreground">Your page is blank — add a text or photo block to get started.</p>
            <div className="flex gap-3">
              <button
                onClick={addTextBlock}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-color-highlight/30 hover:border-color-highlight/60 hover:bg-color-warm/10 transition-colors text-sm font-medium text-foreground"
              >
                <Type className="w-4 h-4 text-color-highlight/60" />
                Add Text
              </button>
              <button
                onClick={addPhotoBlock}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-color-highlight/30 hover:border-color-highlight/60 hover:bg-color-warm/10 transition-colors text-sm font-medium text-foreground"
              >
                <Image className="w-4 h-4 text-color-highlight/60" />
                Add Photo
              </button>
            </div>
          </div>
        )}

        {containerSize > 0 && currentBlocks.map(block => (
          <Rnd
            key={block.id}
            position={{ x: block.x * cs, y: block.y * cs }}
            size={{ width: block.width * cs, height: block.height * cs }}
            bounds="parent"
            minWidth={cs * 0.10}
            minHeight={cs * 0.08}
            enableResizing={editingText !== block.id}
            disableDragging={editingText === block.id}
            resizeHandleStyles={RESIZE_HANDLE_STYLES}
            onDragStop={(e, d) => updateBlock(block.id, {
              x: Math.max(0, d.x / cs),
              y: Math.max(0, d.y / cs),
            })}
            onResizeStop={(e, dir, ref, delta, pos) => updateBlock(block.id, {
              x: Math.max(0, pos.x / cs),
              y: Math.max(0, pos.y / cs),
              width: ref.offsetWidth / cs,
              height: ref.offsetHeight / cs,
            })}
            style={{ zIndex: editingText === block.id ? 20 : 10 }}
          >
            <div className="relative w-full h-full group">
              {/* Delete button */}
              <button
                onClick={() => deleteBlock(block.id)}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                className="absolute top-1 right-1 z-30 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>

              {block.type === 'text' ? (
                <TextBlock
                  block={block}
                  cs={cs}
                  isEditing={editingText === block.id}
                  onStartEdit={() => setEditingText(block.id)}
                  onStopEdit={(content) => {
                    setEditingText(null);
                    if (content !== block.content) updateBlock(block.id, { content });
                  }}
                />
              ) : (
                <PhotoBlock block={block} onAssign={() => setPhotoTrayFor(block.id)} />
              )}
            </div>
          </Rnd>
        ))}
      </div>

      {/* Multi-page navigation */}
      {multiPage && (
        <div className="flex items-center justify-center gap-3 py-1 border-t border-border">
          <button
            onClick={() => { setCurrentPageIndex(i => Math.max(0, i - 1)); setEditingText(null); }}
            disabled={currentPageIndex === 0}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {getPageLabel(pages[currentPageIndex])
              ? `${getPageLabel(pages[currentPageIndex])} · `
              : ''}
            Page {currentPageIndex + 1} of {pages.length}
          </span>
          <button
            onClick={() => { setCurrentPageIndex(i => Math.min(pages.length - 1, i + 1)); setEditingText(null); }}
            disabled={currentPageIndex === pages.length - 1}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Publish */}
      <div className="flex gap-2 pt-1">
        <Button
          onClick={handlePublish}
          disabled={publishing}
          className="flex-1 bg-color-highlight hover:bg-color-highlight/90"
        >
          {publishing ? 'Publishing…' : 'Publish Chapter'}
        </Button>
      </div>

      {/* Photo tray */}
      {photoTrayFor && (
        <PhotoTray
          photos={availablePhotos}
          onSelect={(photo) => {
            updateBlock(photoTrayFor, { sourceKey: photo.sourceKey, url: photo.url, label: photo.label });
            setPhotoTrayFor(null);
          }}
          onClose={() => setPhotoTrayFor(null)}
        />
      )}
    </div>
  );
}

function TextBlock({ block, cs, isEditing, onStartEdit, onStopEdit }) {
  const [localContent, setLocalContent] = useState(block.content || '');
  const lastTapRef = useRef(0);
  const fontSize = Math.max(9, cs * 0.025);

  useEffect(() => {
    if (!isEditing) setLocalContent(block.content || '');
  }, [block.content, isEditing]);

  if (isEditing) {
    return (
      <textarea
        autoFocus
        value={localContent}
        onChange={e => setLocalContent(e.target.value)}
        onBlur={() => onStopEdit(localContent)}
        className="w-full h-full resize-none p-3 bg-transparent font-serif text-foreground/85 outline-none border border-color-highlight/50 rounded"
        style={{ fontSize, lineHeight: 1.8 }}
      />
    );
  }

  function handleTouchEnd() {
    const now = Date.now();
    if (now - lastTapRef.current < 350) onStartEdit();
    lastTapRef.current = now;
  }

  return (
    <div
      onDoubleClick={onStartEdit}
      onTouchEnd={handleTouchEnd}
      className="w-full h-full p-3 overflow-hidden cursor-text select-none border border-transparent rounded"
    >
      {block.content ? (
        block.content.split('\n\n').map((para, i) => (
          <p
            key={i}
            className="font-serif text-foreground/85"
            style={{ fontSize, lineHeight: 1.8, marginTop: i > 0 ? fontSize : 0 }}
          >
            {para.trim()}
          </p>
        ))
      ) : (
        <p className="font-serif text-muted-foreground/50 italic" style={{ fontSize }}>
          Double-tap to edit…
        </p>
      )}
    </div>
  );
}

function PhotoBlock({ block, onAssign }) {
  if (block.url) {
    return (
      <div className="relative w-full h-full overflow-hidden rounded">
        <img src={block.url} alt={block.label || ''} className="w-full h-full object-cover" />
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={onAssign}
          className="absolute top-1.5 left-1.5 z-20 p-1 rounded-full bg-white/80 shadow-sm hover:bg-white transition-colors"
        >
          <Camera className="w-3.5 h-3.5 text-foreground/70" />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onAssign}
      className="w-full h-full border-2 border-dashed border-color-highlight/30 rounded flex flex-col items-center justify-center gap-1 hover:border-color-highlight/60 hover:bg-color-warm/10 transition-colors"
    >
      <Image className="w-5 h-5 text-color-highlight/50" />
      <span className="text-xs text-muted-foreground text-center px-2">Tap to add photo</span>
    </button>
  );
}

function PhotoTray({ photos, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-background rounded-t-2xl p-4 space-y-3 max-h-[60vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Choose a photo</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No photos were added in the wizard. Go back to Step 2 to add photos to your entries.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-safe">
            {photos.map(photo => (
              <button
                key={photo.sourceKey}
                onClick={() => onSelect(photo)}
                className="group relative rounded-lg overflow-hidden aspect-square"
              >
                <img src={photo.url} alt={photo.label || ''} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
                {photo.label && (
                  <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center px-1 py-0.5 leading-tight line-clamp-1">
                    {photo.label}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatePreview({ templateId }) {
  const textCls = "bg-color-warm/30 border border-color-highlight/20";
  const photoCls = "bg-color-highlight/20 border border-color-highlight/30";

  if (templateId === 'classic') return (
    <div className="w-16 h-16 bg-[#fdf9f2] border border-[#ddd0b8] rounded p-1 flex flex-col gap-1">
      <div className={`flex-[2] rounded-sm ${textCls}`} />
      <div className={`flex-[3] rounded-sm ${photoCls}`} />
    </div>
  );
  if (templateId === 'side-by-side') return (
    <div className="w-16 h-16 bg-[#fdf9f2] border border-[#ddd0b8] rounded p-1 flex gap-1">
      <div className={`flex-1 rounded-sm ${textCls}`} />
      <div className={`flex-1 rounded-sm ${photoCls}`} />
    </div>
  );
  if (templateId === 'hero') return (
    <div className="w-16 h-16 bg-[#fdf9f2] border border-[#ddd0b8] rounded p-1 relative">
      <div className={`absolute inset-1 rounded-sm ${photoCls}`} />
      <div className="absolute bottom-2 left-2 right-2 h-2.5 rounded-sm bg-white/70" />
    </div>
  );
  if (templateId === 'gallery') return (
    <div className="w-16 h-16 bg-[#fdf9f2] border border-[#ddd0b8] rounded p-1 flex flex-col gap-1">
      <div className="flex gap-1 flex-1">
        <div className={`flex-1 rounded-sm ${photoCls}`} />
        <div className={`flex-1 rounded-sm ${photoCls}`} />
      </div>
      <div className={`flex-1 rounded-sm ${textCls}`} />
    </div>
  );
  if (templateId === 'text-only') return (
    <div className="w-16 h-16 bg-[#fdf9f2] border border-[#ddd0b8] rounded p-1">
      <div className={`w-full h-full rounded-sm ${textCls}`} />
    </div>
  );
  return null;
}
