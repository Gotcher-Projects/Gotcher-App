import React, { useState, useEffect, useRef, useMemo, useCallback, useReducer } from "react";
import { Rnd } from "react-rnd";
import { useEditor, EditorContent } from "@tiptap/react";
import { useFittedFontSize } from "@/lib/fitText";
import { Button } from "@/components/ui/button";
import { X, Plus, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, LayoutTemplate, Type, Image, Camera, Upload, Sticker, Bold, Italic, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { apiUpload } from "@/lib/api";
import { STICKERS, stickerMaskStyle, stickerColors } from "@/lib/stickers";
import { tiptapExtensions, toTiptapDoc, renderContentHTML, contentToPlainText, FONT_SIZES, fontSizeKey } from "@/lib/tiptap";

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

// Virtual page canvas — fixed 3:4 portrait, matched to LayoutRenderer so the
// editor and published view render identically (CSS-scaled to fit).
const CANVAS_W = 600;
const CANVAS_H = 800;
const BASE_FONT = Math.max(9, CANVAS_W * 0.025);
const FONT_MAP = { serif: 'font-serif', playf: 'font-playf', merri: 'font-merri', sans: 'font-sans', lato: 'font-lato', nunito: 'font-nunito', display: 'font-display' };
const FONT_OPTIONS = [
  { key: 'serif',   label: 'Georgia' },
  { key: 'playf',   label: 'Playfair' },
  { key: 'merri',   label: 'Merri' },
  { key: 'sans',    label: 'Inter' },
  { key: 'lato',    label: 'Lato' },
  { key: 'nunito',  label: 'Nunito' },
  { key: 'display', label: 'Poppins' },
];
const REVERSE_FONT_MAP = Object.fromEntries(Object.entries(FONT_MAP).map(([k, v]) => [v, k]));

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

// Ensure every block has an id, and migrate legacy plain-string text content
// to Tiptap JSON so the whole editor works in a single rich-text format.
function migrateBlock(b) {
  const block = { ...b, id: b.id || makeId() };
  if (block.type === 'text') block.content = toTiptapDoc(block.content);
  return block;
}

function initPages(chapter) {
  if (chapter.layoutData?.version === 2) {
    return (chapter.layoutData.pages || []).map(p => ({
      id: p.id || makePageId(),
      sourceKey: p.sourceKey || null,
      backgroundColor: p.backgroundColor || null,
      blocks: (p.blocks || []).map(migrateBlock),
    }));
  }
  const blocks = chapter.layoutData?.blocks?.length > 0
    ? chapter.layoutData.blocks.map(migrateBlock)
    : [];
  return [{ id: 'p-0', sourceKey: null, backgroundColor: null, blocks }];
}

function getLayoutData(thePages, isV2) {
  if (isV2 || thePages.length > 1) {
    return { version: 2, pages: thePages };
  }
  return { version: 1, blocks: thePages[0].blocks };
}

export default function LayoutEditor({ chapter, journalEntries, firsts, onSave, onPublish, onBack, publishLabel, backLabel, onChapterPhotoAdded, theme }) {
  const isV2 = chapter.layoutData?.version === 2;
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState(0);
  const [pages, setPages] = useState(() => initPages(chapter));
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAddPhotoMenu, setShowAddPhotoMenu] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [menuUploading, setMenuUploading] = useState(false);
  const [menuUploadError, setMenuUploadError] = useState(null);
  const [photoTrayFor, setPhotoTrayFor] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [activeEditor, setActiveEditor] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
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

  const scale = containerSize > 0 ? containerSize / CANVAS_W : 1;
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

  function setCurrentPageBg(color) {
    setPages(prev => {
      const next = [...prev];
      next[currentPageIndex] = { ...next[currentPageIndex], backgroundColor: color || null };
      scheduleAutoSave(next);
      return next;
    });
  }

  function updateBlock(id, patch) {
    setCurrentBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function handleFontChange(blockId, fontFamily) {
    setCurrentBlocks(prev =>
      prev.map(b => b.id === blockId ? { ...b, fontFamily: fontFamily || undefined } : b)
    );
  }

  function addStickerBlock(stickerKey) {
    const newBlock = {
      id: makeId(),
      type: 'sticker',
      stickerKey,
      x: 0.40, y: 0.42, width: 0.20, height: 0.15,
    };
    setCurrentBlocks(prev => [...prev, newBlock]);
    setSelectedBlock(newBlock.id);
    setShowStickerPicker(false);
  }

  function handleStickerColor(blockId, color) {
    setCurrentBlocks(prev =>
      prev.map(b => b.id === blockId ? { ...b, color } : b)
    );
  }

  function deleteBlock(id) {
    setCurrentBlocks(prev => prev.filter(b => b.id !== id));
  }

  function addTextBlock() {
    const newBlock = {
      id: makeId(),
      type: 'text',
      x: 0.04, y: 0.04, width: 0.92, height: 0.45,
      content: toTiptapDoc(!hasTextBlock ? cleanBody(chapter.body) : ''),
    };
    setCurrentBlocks(prev => [...prev, newBlock]);
  }

  function addPhotoBlock(overrides = {}) {
    const id = makeId();
    const newBlock = {
      id,
      type: 'photo',
      x: 0.04, y: 0.04, width: 0.92, height: 0.45,
      sourceKey: null, url: null, label: null,
      ...overrides,
    };
    setCurrentBlocks(prev => [...prev, newBlock]);
    return id;
  }

  function handleAddPhotoFromEntries() {
    const id = addPhotoBlock();
    setPhotoTrayFor(id);
    setShowAddPhotoMenu(false);
  }

  async function handleMenuUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMenuUploading(true);
    setMenuUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiUpload(`/storybook/${chapter.id}/chapter-photos`, form);
      const photo = { sourceKey: data.key, url: data.url, label: data.label || '' };
      addPhotoBlock({ sourceKey: photo.sourceKey, url: photo.url, label: photo.label });
      if (onChapterPhotoAdded) onChapterPhotoAdded(photo);
      setShowAddPhotoMenu(false);
    } catch {
      setMenuUploadError('Upload failed. Please try again.');
    } finally {
      setMenuUploading(false);
    }
  }

  function addPage() {
    const newPage = { id: makePageId(), sourceKey: null, backgroundColor: null, blocks: [] };
    setPages(prev => {
      const next = [...prev, newPage];
      scheduleAutoSave(next);
      return next;
    });
    setCurrentPageIndex(pages.length);
  }

  function movePageLeft() {
    if (currentPageIndex === 0) return;
    setPages(prev => {
      const next = [...prev];
      [next[currentPageIndex - 1], next[currentPageIndex]] = [next[currentPageIndex], next[currentPageIndex - 1]];
      scheduleAutoSave(next);
      return next;
    });
    setCurrentPageIndex(i => i - 1);
  }

  function movePageRight() {
    if (currentPageIndex === pages.length - 1) return;
    setPages(prev => {
      const next = [...prev];
      [next[currentPageIndex], next[currentPageIndex + 1]] = [next[currentPageIndex + 1], next[currentPageIndex]];
      scheduleAutoSave(next);
      return next;
    });
    setCurrentPageIndex(i => i + 1);
  }

  function applyTemplate(tpl) {
    const newBlocks = tpl.blocks.map(b => ({
      ...b,
      id: makeId(),
      content: b.type === 'text' ? toTiptapDoc(cleanBody(chapter.body)) : undefined,
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
    for (const cp of chapter.chapterPhotos || []) {
      photos.push({ sourceKey: cp.key, url: cp.url, label: cp.label || '' });
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
          {backLabel || 'Back to Review'}
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
            onClick={() => setShowAddPhotoMenu(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
          >
            <Image className="w-3.5 h-3.5" />
            Add Photo
          </button>
          <button
            onClick={() => setShowStickerPicker(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
          >
            <Sticker className="w-3.5 h-3.5" />
            Add Sticker
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

      {/* Rich-text formatting toolbar — shown only while editing a text block */}
      {editingText && activeEditor && <FormatToolbar editor={activeEditor} />}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full max-w-[480px] mx-auto border border-[#ddd0b8] rounded-xl overflow-hidden shadow-sm"
        style={{ aspectRatio: '3 / 4' }}
      >
        {containerSize > 0 && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0,
              width: CANVAS_W, height: CANVAS_H,
              transform: `scale(${scale})`, transformOrigin: 'top left',
              backgroundColor: pages[currentPageIndex]?.backgroundColor || theme?.bg || '#fdf9f2',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlock(null); }}
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
                onClick={() => setShowAddPhotoMenu(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-color-highlight/30 hover:border-color-highlight/60 hover:bg-color-warm/10 transition-colors text-sm font-medium text-foreground"
              >
                <Image className="w-4 h-4 text-color-highlight/60" />
                Add Photo
              </button>
            </div>
          </div>
        )}

        {currentBlocks.map(block => (
          <Rnd
            key={block.id}
            position={{ x: block.x * CANVAS_W, y: block.y * CANVAS_H }}
            size={{ width: block.width * CANVAS_W, height: block.height * CANVAS_H }}
            scale={scale}
            bounds="parent"
            minWidth={CANVAS_W * 0.10}
            minHeight={CANVAS_H * 0.06}
            enableResizing={editingText !== block.id}
            disableDragging={editingText === block.id}
            resizeHandleStyles={RESIZE_HANDLE_STYLES}
            onDragStop={(e, d) => updateBlock(block.id, {
              x: Math.max(0, d.x / CANVAS_W),
              y: Math.max(0, d.y / CANVAS_H),
            })}
            onResizeStop={(e, dir, ref, delta, pos) => updateBlock(block.id, {
              x: Math.max(0, pos.x / CANVAS_W),
              y: Math.max(0, pos.y / CANVAS_H),
              width: ref.offsetWidth / CANVAS_W,
              height: ref.offsetHeight / CANVAS_H,
            })}
            style={{ zIndex: editingText === block.id ? 20 : 10 }}
          >
            <div
              className="relative w-full h-full group"
              onClick={() => setSelectedBlock(block.id)}
            >
              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                className="absolute top-1 right-1 z-30 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>

              {block.type === 'text' ? (
                <TextBlock
                  block={block}
                  theme={theme}
                  isEditing={editingText === block.id}
                  isSelected={selectedBlock === block.id}
                  onStartEdit={() => { setSelectedBlock(block.id); setEditingText(block.id); }}
                  onStopEdit={(content) => {
                    setEditingText(null);
                    if (JSON.stringify(content) !== JSON.stringify(block.content)) {
                      updateBlock(block.id, { content });
                    }
                  }}
                  onFontChange={handleFontChange}
                  onEditorReady={setActiveEditor}
                />
              ) : block.type === 'sticker' ? (
                <StickerBlock
                  block={block}
                  theme={theme}
                  isSelected={selectedBlock === block.id}
                  onColorChange={handleStickerColor}
                />
              ) : (
                <PhotoBlock block={block} onAssign={() => setPhotoTrayFor(block.id)} />
              )}
            </div>
          </Rnd>
        ))}
          </div>
        )}
      </div>

      {/* Per-page background color swatches */}
      {theme && (
        <div className="flex items-center gap-2 px-1 py-0.5">
          <span className="text-xs text-muted-foreground shrink-0">Page bg:</span>
          <button
            onClick={() => setCurrentPageBg(null)}
            title="Default"
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${!pages[currentPageIndex]?.backgroundColor ? 'border-color-highlight' : 'border-border hover:border-color-highlight/50'}`}
            style={{ backgroundColor: theme.bg }}
          >
            <span className="text-[7px] text-foreground/50 leading-none font-bold">A</span>
          </button>
          {theme.palette.slice(1).map(color => (
            <button
              key={color}
              onClick={() => setCurrentPageBg(color)}
              title={color}
              className={`w-5 h-5 rounded border-2 transition-colors ${pages[currentPageIndex]?.backgroundColor === color ? 'border-color-highlight' : 'border-border hover:border-color-highlight/50'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {/* Multi-page navigation */}
      {multiPage && (
        <div className="flex items-center justify-center gap-2 py-1 border-t border-border">
          <button
            onClick={() => { setCurrentPageIndex(i => Math.max(0, i - 1)); setEditingText(null); }}
            disabled={currentPageIndex === 0}
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={movePageLeft}
            disabled={currentPageIndex === 0}
            title="Move this page earlier"
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-sm text-muted-foreground px-1">
            {getPageLabel(pages[currentPageIndex])
              ? `${getPageLabel(pages[currentPageIndex])} · `
              : ''}
            Page {currentPageIndex + 1} of {pages.length}
          </span>
          <button
            onClick={movePageRight}
            disabled={currentPageIndex === pages.length - 1}
            title="Move this page later"
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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
          {publishing ? (publishLabel ? 'Saving…' : 'Publishing…') : (publishLabel || 'Publish Chapter')}
        </Button>
      </div>

      {/* Add photo source picker */}
      {showAddPhotoMenu && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowAddPhotoMenu(false)}>
          <div
            className="w-full bg-background rounded-t-2xl p-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Add a photo</p>
              <button onClick={() => setShowAddPhotoMenu(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleAddPhotoFromEntries}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-color-highlight/50 hover:bg-color-warm/10 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-color-highlight/10 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-color-highlight" />
              </div>
              <div>
                <p className="text-sm font-medium">From journal &amp; firsts</p>
                <p className="text-xs text-muted-foreground">Choose a photo you've already added</p>
              </div>
            </button>

            <label className={`w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-color-highlight/50 hover:bg-color-warm/10 transition-colors text-left cursor-pointer ${menuUploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-color-highlight/10 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-color-highlight" />
              </div>
              <div>
                <p className="text-sm font-medium">{menuUploading ? 'Uploading…' : 'Upload from device'}</p>
                <p className="text-xs text-muted-foreground">Add a photo from your phone or computer</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleMenuUpload} disabled={menuUploading} />
            </label>

            {menuUploadError && <p className="text-xs text-destructive">{menuUploadError}</p>}
          </div>
        </div>
      )}

      {/* Sticker picker */}
      {showStickerPicker && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowStickerPicker(false)}>
          <div
            className="w-full bg-background rounded-t-2xl p-4 space-y-3 max-h-[60vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Add a sticker</p>
              <button onClick={() => setShowStickerPicker(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {STICKERS.map(s => (
                <button
                  key={s.key}
                  onClick={() => addStickerBlock(s.key)}
                  title={s.label}
                  className="aspect-square rounded-xl border border-border hover:border-color-highlight/60 hover:bg-color-warm/10 transition-colors p-2.5 flex items-center justify-center"
                >
                  <div className="w-full h-full" style={stickerMaskStyle(s.key, theme?.accent || '#9b7e5a')} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Photo tray */}
      {photoTrayFor && (
        <PhotoTray
          photos={availablePhotos}
          chapterId={chapter.id}
          onSelect={(photo) => {
            updateBlock(photoTrayFor, { sourceKey: photo.sourceKey, url: photo.url, label: photo.label });
            setPhotoTrayFor(null);
          }}
          onUploadDone={(photo) => {
            updateBlock(photoTrayFor, { sourceKey: photo.sourceKey, url: photo.url, label: photo.label });
            setPhotoTrayFor(null);
            if (onChapterPhotoAdded) onChapterPhotoAdded(photo);
          }}
          onClose={() => setPhotoTrayFor(null)}
        />
      )}
    </div>
  );
}

function TextBlock({ block, theme, isEditing, isSelected, onStartEdit, onStopEdit, onFontChange, onEditorReady }) {
  const lastTapRef = useRef(0);
  const dispRef = useRef(null);
  const fontClass = FONT_MAP[block.fontFamily] ?? theme?.fontClass ?? 'font-serif';
  const activeFontKey = block.fontFamily ?? REVERSE_FONT_MAP[theme?.fontClass ?? 'font-serif'] ?? 'serif';
  const html = useMemo(() => renderContentHTML(block.content), [block.content]);
  const isEmpty = useMemo(() => contentToPlainText(block.content).length === 0, [block.content]);
  const fittedSize = useFittedFontSize(
    dispRef, BASE_FONT, 8,
    [html, fontClass, block.width * CANVAS_W, block.height * CANVAS_H, isEditing]
  );

  // Block-level font-family picker (separate from the inline format toolbar).
  // preventDefault on mousedown keeps the contenteditable focused while editing.
  const fontPicker = (isSelected || isEditing) && (
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
          onClick={e => { e.stopPropagation(); onFontChange(block.id, activeFontKey === key && block.fontFamily ? null : key); }}
          className={`px-1.5 py-0.5 rounded text-[10px] text-white transition-colors ${activeFontKey === key ? 'bg-white/30' : 'hover:bg-white/15'}`}
        >
          <span className={FONT_MAP[key]}>{label}</span>
        </button>
      ))}
    </div>
  );

  if (isEditing) {
    return (
      <div className="relative w-full h-full">
        <RichTextEditor
          block={block}
          fontClass={fontClass}
          textColor={theme?.textColor}
          onReady={onEditorReady}
          onStopEdit={onStopEdit}
        />
        {fontPicker}
      </div>
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
      className="relative w-full h-full cursor-text select-none border border-transparent rounded"
    >
      {isEmpty ? (
        <div className={`book-rich book-rich--edit ${fontClass} w-full h-full p-3 overflow-hidden`} style={{ fontSize: BASE_FONT, lineHeight: 1.8 }}>
          <p className="text-muted-foreground/50 italic">Double-tap to edit…</p>
        </div>
      ) : (
        <div
          ref={dispRef}
          className={`book-rich ${fontClass} w-full h-full p-3 overflow-hidden`}
          style={{ fontSize: fittedSize, lineHeight: 1.8, color: theme?.textColor || undefined }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      {fontPicker}
    </div>
  );
}

function RichTextEditor({ block, fontClass, textColor, onReady, onStopEdit }) {
  const editor = useEditor({
    extensions: tiptapExtensions,
    content: toTiptapDoc(block.content),
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: `book-rich book-rich--edit ${fontClass} w-full h-full p-3 overflow-y-auto outline-none`,
        style: textColor ? `color: ${textColor}` : '',
      },
    },
    onBlur: ({ editor }) => onStopEdit(editor.getJSON()),
  });

  useEffect(() => {
    if (editor) onReady(editor);
    return () => onReady(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div
      className="w-full h-full border border-color-highlight/50 rounded bg-transparent overflow-hidden"
      style={{ fontSize: BASE_FONT, lineHeight: 1.8 }}
    >
      <EditorContent editor={editor} className="w-full h-full" />
    </div>
  );
}

function FormatToolbar({ editor }) {
  const [, force] = useReducer(x => x + 1, 0);

  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', force);
    editor.on('selectionUpdate', force);
    return () => {
      editor.off('transaction', force);
      editor.off('selectionUpdate', force);
    };
  }, [editor]);

  if (!editor) return null;

  const curSize = fontSizeKey(editor.getAttributes('textStyle').fontSize);
  const setSize = (key) => {
    const val = FONT_SIZES[key];
    if (val == null) editor.chain().focus().unsetFontSize().run();
    else editor.chain().focus().setFontSize(val).run();
  };
  const curAlign = ['center', 'right'].find(a => editor.isActive({ textAlign: a })) || 'left';

  const btn = "w-8 h-8 rounded-md flex items-center justify-center transition-colors";
  const on = "bg-color-highlight text-white";
  const off = "text-foreground hover:bg-muted";

  return (
    <div
      className="flex items-center gap-1 flex-wrap justify-center max-w-[480px] mx-auto rounded-xl border border-border bg-card px-2 py-1.5 shadow-sm"
      onMouseDown={e => e.preventDefault()}
    >
      <button className={`${btn} ${editor.isActive('bold') ? on : off}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
        <Bold className="w-4 h-4" />
      </button>
      <button className={`${btn} ${editor.isActive('italic') ? on : off}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
        <Italic className="w-4 h-4" />
      </button>

      <span className="w-px h-5 bg-border mx-0.5" />

      <button className={`${btn} ${curAlign === 'left' ? on : off}`} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">
        <AlignLeft className="w-4 h-4" />
      </button>
      <button className={`${btn} ${curAlign === 'center' ? on : off}`} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center">
        <AlignCenter className="w-4 h-4" />
      </button>
      <button className={`${btn} ${curAlign === 'right' ? on : off}`} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">
        <AlignRight className="w-4 h-4" />
      </button>

      <span className="w-px h-5 bg-border mx-0.5" />

      {[['small', 'S'], ['normal', 'M'], ['large', 'L']].map(([key, label]) => (
        <button
          key={key}
          className={`${btn} text-xs font-semibold ${curSize === key ? on : off}`}
          onClick={() => setSize(key)}
          title={`${label} text`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StickerBlock({ block, theme, isSelected, onColorChange }) {
  const colors = stickerColors(theme);
  const current = block.color || colors[0];

  function cycleColor(e) {
    e.stopPropagation();
    const idx = colors.indexOf(current);
    const next = colors[(idx + 1) % colors.length];
    onColorChange(block.id, next);
  }

  return (
    <div className="relative w-full h-full">
      <div className="w-full h-full p-1" style={stickerMaskStyle(block.stickerKey, current)} />
      {isSelected && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={cycleColor}
          title="Change color"
          className="absolute bottom-1 left-1/2 -translate-x-1/2 z-40 w-5 h-5 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: current }}
        />
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

function PhotoTray({ photos, chapterId, onSelect, onUploadDone, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiUpload(`/storybook/${chapterId}/chapter-photos`, form);
      onUploadDone({ sourceKey: data.key, url: data.url, label: data.label || '' });
    } catch {
      setUploadError('Upload failed. Please try again.');
      setUploading(false);
    }
  }

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

        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-color-highlight/40 hover:border-color-highlight/70 hover:bg-color-warm/10 cursor-pointer transition-colors text-sm text-muted-foreground ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload className="w-4 h-4 text-color-highlight/60 shrink-0" />
          {uploading ? 'Uploading…' : 'Upload a photo'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No photos added yet. Upload one above or go back to Step 2 to add photos to your entries.
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
