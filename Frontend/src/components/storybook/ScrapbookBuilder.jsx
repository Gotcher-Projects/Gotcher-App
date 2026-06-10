import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  DndContext, DragOverlay, useDroppable, useDraggable,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight,
  X, Plus, GripVertical, Type, Image as ImageIcon, LayoutTemplate, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/lib/storybookTemplates";
import PhotoTray from "@/components/storybook/PhotoTray";
import RichTextEditor from "@/components/storybook/RichTextEditor";
import FormatToolbar from "@/components/storybook/FormatToolbar";
import FontPicker from "@/components/storybook/FontPicker";
import { buildMemoryList, extractPieceText } from "@/lib/storybookGrouping";
import { toTiptapDoc, contentToPlainText } from "@/lib/tiptap";
import {
  CANVAS_W, CANVAS_H, FONT_MAP, REVERSE_FONT_MAP, RenderedText, blockBoxStyle,
} from "@/lib/bookCanvas";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makePageId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

function cleanBody(body) {
  return (body || '').replace(/\[PHOTO:[^\]]+\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// Split text into n parts at natural boundaries (paragraph → sentence → word).
function splitTextParts(text, n) {
  if (n <= 1) return [text];
  const paras = text.split(/\n\n+/).filter(Boolean);
  if (paras.length >= n) {
    const mid = Math.ceil(paras.length / n);
    return [paras.slice(0, mid).join('\n\n'), paras.slice(mid).join('\n\n')];
  }
  const mid = Math.floor(text.length / 2);
  const sentenceEnd = text.indexOf('. ', mid);
  if (sentenceEnd > 0 && sentenceEnd < text.length - 2) {
    return [text.slice(0, sentenceEnd + 1).trim(), text.slice(sentenceEnd + 2).trim()];
  }
  const wordBound = text.indexOf(' ', mid);
  if (wordBound > 0) {
    return [text.slice(0, wordBound).trim(), text.slice(wordBound).trim()];
  }
  return [text, ''];
}

// Ensure every block has an id; migrate plain-string text content to Tiptap JSON.
function migrateBlock(b) {
  const block = { ...b, id: b.id || makeId() };
  if (block.type === 'text') block.content = toTiptapDoc(block.content);
  return block;
}

function initPages(chapter) {
  if (chapter.layoutData?.version === 2) {
    return (chapter.layoutData.pages || []).map(p => ({
      id: p.id || makePageId(),
      sourceKeys: p.sourceKeys || (p.sourceKey ? [p.sourceKey] : []),
      templateId: p.templateId || null,
      backgroundColor: p.backgroundColor || null,
      blocks: (p.blocks || []).map(migrateBlock),
    }));
  }
  // v1 / empty — fold into a single page.
  const blocks = (chapter.layoutData?.blocks || []).map(migrateBlock);
  return [{ id: makePageId(), sourceKeys: [], templateId: null, backgroundColor: null, blocks }];
}

function buildLayoutData(thePages) {
  return {
    version: 2,
    pages: thePages.map(p => ({
      id: p.id,
      sourceKeys: p.sourceKeys || [],
      templateId: p.templateId || null,
      backgroundColor: p.backgroundColor || null,
      blocks: p.blocks,
    })),
  };
}

const TYPE_LABELS = { period: 'Time Period', milestone: 'Milestone', first_time: 'First Time' };

// ── Memory panel ──────────────────────────────────────────────────────────────

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

// ── Template thumbnail + picker ───────────────────────────────────────────────

// Generic preview built from a template's normalized block boxes — works for any
// template without per-id markup.
function TemplateThumb({ template }) {
  return (
    <div className="relative bg-[#fdf9f2] border border-[#ddd0b8] rounded overflow-hidden" style={{ width: 58, height: 77 }}>
      {template.blocks.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-[1px] ${
            b.overlay ? 'bg-black/60' :
            b.type === 'photo' ? 'bg-color-highlight/45' : 'bg-color-highlight/20'
          }`}
          style={{
            left: `${b.x * 100}%`, top: `${b.y * 100}%`,
            width: `${b.width * 100}%`, height: `${b.height * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

const FILTER_PILLS = [
  { id: 'all',      label: 'All',               match: () => true },
  { id: '1-memory', label: '1 Memory',           match: t => t.memoryCount === 1 },
  { id: 'multi',    label: 'Multiple Memories',  match: t => t.memoryCount >= 2 },
  { id: 'photo',    label: 'Photo Only',         match: t => t.memoryCount === 0 },
];

function TemplateSheet({ currentTemplateId, onSelect, onClose }) {
  const [filter, setFilter] = useState('all');
  const activeFilter = FILTER_PILLS.find(p => p.id === filter);
  const visible = TEMPLATES.filter(activeFilter.match);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-background rounded-t-2xl md:rounded-2xl p-4 space-y-4 max-h-[72vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Choose a layout</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_PILLS.map(pill => (
            <button
              key={pill.id}
              onClick={() => setFilter(pill.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === pill.id
                  ? 'bg-color-highlight text-white'
                  : 'bg-color-warm/20 text-muted-foreground hover:bg-color-warm/40'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {visible.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                currentTemplateId === t.id
                  ? 'border-color-highlight bg-color-warm/10'
                  : 'border-transparent hover:border-color-highlight/30 hover:bg-color-warm/5'
              }`}
            >
              <TemplateThumb template={t} />
              <span className="text-[11px] font-medium text-center leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page canvas (droppable + editable slots) ──────────────────────────────────

function SlotPlaceholder({ kind, armed }) {
  const Icon = kind === 'photo' ? ImageIcon : Type;
  const label = kind === 'photo' ? 'Add a photo' : 'Drop a memory';
  return (
    <div className={`w-full h-full border-2 border-dashed rounded flex flex-col items-center justify-center gap-1.5 transition-colors ${
      armed ? 'border-color-highlight bg-color-warm/20' : 'border-color-highlight/30 bg-color-warm/5'
    }`}>
      <Icon className={`w-6 h-6 ${armed ? 'text-color-highlight' : 'text-color-highlight/40'}`} />
      <span className="text-sm text-muted-foreground/70 text-center px-2">
        {armed ? 'Tap to place' : label}
      </span>
    </div>
  );
}

// One block rendered as a droppable, editable slot. Accepts matching content via
// drag or click-to-place; text slots become rich-text editors when activated;
// photo slots open the photo tray.
function Slot({
  block, theme, selectedSource, isEditing,
  onActivate, onStopEdit, onFontChange, onEditorReady, onOpenTray,
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: block.id, data: { type: block.type } });
  const draggingKind = active?.data?.current?.kind;
  const dragMatches = draggingKind === block.type;
  const clickMatches = selectedSource?.kind === block.type;
  const fontClass = FONT_MAP[block.fontFamily] ?? theme?.fontClass ?? 'font-serif';
  const activeFontKey = block.fontFamily ?? REVERSE_FONT_MAP[theme?.fontClass ?? 'font-serif'] ?? 'serif';

  let inner;
  if (block.type === 'text') {
    if (isEditing) {
      inner = (
        <div className="relative w-full h-full">
          <RichTextEditor
            block={block}
            fontClass={fontClass}
            textColor={theme?.textColor}
            onReady={onEditorReady}
            onStopEdit={(content) => onStopEdit(block.id, content)}
          />
          <FontPicker
            activeFontKey={activeFontKey}
            hasOverride={!!block.fontFamily}
            onChange={(key) => onFontChange(block.id, key)}
          />
        </div>
      );
    } else {
      const hasText = contentToPlainText(block.content).trim().length > 0;
      inner = hasText
        ? <RenderedText block={block} fontClass={fontClass} textColor={theme?.textColor} />
        : <SlotPlaceholder kind="text" armed={clickMatches} />;
    }
  } else {
    inner = block.url ? (
      <div className="relative w-full h-full">
        <img src={block.url} alt={block.label || ''} className="w-full h-full object-cover" />
        <button
          onClick={(e) => { e.stopPropagation(); onOpenTray(block.id); }}
          className="absolute top-1.5 left-1.5 z-20 p-1 rounded-full bg-white/80 shadow-sm hover:bg-white transition-colors"
        >
          <Camera className="w-3.5 h-3.5 text-foreground/70" />
        </button>
      </div>
    ) : (
      <SlotPlaceholder kind="photo" armed={clickMatches} />
    );
  }

  const ring = (isOver && dragMatches) ? 'ring-2 ring-color-highlight ring-offset-1' : '';

  return (
    <div
      ref={setNodeRef}
      onClick={isEditing ? undefined : () => onActivate(block.id)}
      style={blockBoxStyle(block)}
      className={`${ring} ${isEditing ? '' : 'cursor-pointer'} rounded`}
    >
      {inner}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScrapbookBuilder({ chapter, journalEntries, firsts, theme, onUpdate, onClose }) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState(0);
  const [pages, setPages] = useState(() => initPages(chapter));
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null); // { kind, sourceKey }
  const [activeDrag, setActiveDrag] = useState(null);          // { kind, sourceKey }
  const [photoTrayFor, setPhotoTrayFor] = useState(null);      // block id
  const [editingBlockId, setEditingBlockId] = useState(null);  // block id
  const [activeEditor, setActiveEditor] = useState(null);
  const [extraPhotos, setExtraPhotos] = useState([]);          // photos uploaded this session
  const [saveStatus, setSaveStatus] = useState('saved');       // saved | unsaved | saving
  const [publishing, setPublishing] = useState(false);
  const saveTimerRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

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
  const currentPage = pages[currentPageIndex];
  const currentBlocks = currentPage?.blocks || [];
  const currentTemplate = TEMPLATES.find(t => t.id === currentPage?.templateId) || null;

  // Memories with the AI title/body overlaid for the cards.
  const memories = useMemo(() => {
    const base = buildMemoryList({
      journalIds: chapter.selectedJournalIds,
      firstTimeIds: chapter.selectedFirstTimeIds,
      journalEntries: journalEntries || [],
      firsts: firsts || [],
      photoOverrides: chapter.photoOverrides,
      entryNotes: chapter.entryNotes,
    });
    return base.map(m => {
      const gc = chapter.generatedContent?.[m.sourceKey];
      // Raw entry text — used as a fallback when AI content hasn't been generated.
      const [type, idStr] = m.sourceKey.split(':');
      const id = parseInt(idStr, 10);
      let rawText = '';
      if (type === 'journal') rawText = (journalEntries || []).find(e => e.id === id)?.story || '';
      else if (type === 'first_time') rawText = (firsts || []).find(f => f.id === id)?.notes || '';
      return {
        ...m,
        aiTitle: gc?.title || null,
        aiBody: gc?.body ? cleanBody(gc.body) : null,
        rawText,
      };
    });
  }, [chapter, journalEntries, firsts]);

  // Derived "already in the book" state — which memory pieces are placed on any page.
  // A text piece counts as used only when its placed block has non-empty content; a
  // photo piece counts when its placed block has a url. Reactive to every page change.
  const { usedTextKeys, usedPhotoKeys } = useMemo(() => {
    const textKeys = new Set();
    const photoKeys = new Set();
    for (const page of pages) {
      for (const b of page.blocks || []) {
        if (!b.sourceKey) continue;
        if (b.type === 'text') {
          if (contentToPlainText(b.content).trim()) textKeys.add(b.sourceKey);
        } else if (b.type === 'photo') {
          if (b.url) photoKeys.add(b.sourceKey);
        }
      }
    }
    return { usedTextKeys: textKeys, usedPhotoKeys: photoKeys };
  }, [pages]);

  // Photos the tray can choose from: entry/first photos, chapter photos, plus any
  // uploaded during this builder session.
  const availablePhotos = useMemo(() => {
    const photos = [];
    for (const id of chapter.selectedJournalIds || []) {
      const entry = (journalEntries || []).find(e => e.id === id);
      if (!entry) continue;
      const url = chapter.photoOverrides?.[`journal:${id}`] || entry.image_url;
      if (url) photos.push({ sourceKey: `journal:${id}`, url, label: entry.title });
    }
    for (const id of chapter.selectedFirstTimeIds || []) {
      const ft = (firsts || []).find(f => f.id === id);
      if (!ft) continue;
      const url = chapter.photoOverrides?.[`first_time:${id}`] || ft.imageUrl;
      if (url) photos.push({ sourceKey: `first_time:${id}`, url, label: ft.label });
    }
    for (const cp of chapter.chapterPhotos || []) {
      photos.push({ sourceKey: cp.key, url: cp.url, label: cp.label || '' });
    }
    return [...photos, ...extraPhotos];
  }, [chapter, journalEntries, firsts, extraPhotos]);

  const scheduleAutoSave = useCallback((nextPages) => {
    if (!onUpdate) return;
    setSaveStatus('unsaved');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await onUpdate(chapter.id, { layoutData: buildLayoutData(nextPages) });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    }, 1000);
  }, [onUpdate, chapter.id]);

  // Commit a page-array update and schedule an autosave from the same next value.
  function commitPages(updater) {
    setPages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      scheduleAutoSave(next);
      return next;
    });
  }

  function setCurrentBlocks(blockUpdater) {
    commitPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      page.blocks = blockUpdater(page.blocks);
      next[currentPageIndex] = page;
      return next;
    });
  }

  function updateBlock(blockId, patch) {
    setCurrentBlocks(blocks => blocks.map(b => b.id === blockId ? { ...b, ...patch } : b));
  }

  // Fill a slot from a memory piece (text) or its photo. Records the owning
  // sourceKey so re-renders and later edits stay consistent.
  // Blocks with a matching contentSource.splitGroup are all filled simultaneously,
  // with the source text split across them at a natural boundary.
  function placeIntoSlot(blockId, kind, sourceKey) {
    setCurrentBlocks(blocks => {
      const target = blocks.find(b => b.id === blockId);
      if (!target) return blocks;

      if (kind === 'text' && target.type === 'text') {
        const gc = chapter.generatedContent?.[sourceKey];
        const piece = target.contentSource?.piece || 'body';
        let fullText = extractPieceText(gc, piece);
        if (!fullText) {
          const mem = memories.find(m => m.sourceKey === sourceKey);
          fullText = piece === 'title' ? (mem?.label || '') : cleanBody(mem?.rawText || '');
        }

        const splitGroup = target.contentSource?.splitGroup;
        if (splitGroup) {
          const groupBlocks = blocks
            .filter(b => b.type === 'text' && b.contentSource?.splitGroup === splitGroup)
            .sort((a, b) => a.y - b.y);
          const parts = splitTextParts(fullText, groupBlocks.length);
          const groupMap = new Map(groupBlocks.map((b, i) => [b.id, parts[i] ?? '']));
          return blocks.map(b =>
            groupMap.has(b.id)
              ? { ...b, content: toTiptapDoc(groupMap.get(b.id)), sourceKey, suppressDropCap: true }
              : b
          );
        }

        return blocks.map(b =>
          b.id === blockId
            ? { ...b, content: toTiptapDoc(fullText), sourceKey, suppressDropCap: true }
            : b
        );
      }

      if (kind === 'photo' && target.type === 'photo') {
        const mem = memories.find(m => m.sourceKey === sourceKey);
        return blocks.map(b =>
          b.id === blockId
            ? { ...b, url: mem?.photoUrl || null, sourceKey, label: mem?.label || '' }
            : b
        );
      }

      return blocks;
    });
  }

  function assignPhotoToSlot(blockId, photo) {
    updateBlock(blockId, { url: photo.url, sourceKey: photo.sourceKey, label: photo.label || '' });
  }

  function handleSelect(kind, sourceKey) {
    setEditingBlockId(null);
    setSelectedSource(prev =>
      prev && prev.kind === kind && prev.sourceKey === sourceKey ? null : { kind, sourceKey }
    );
  }

  // Click on a slot: place a selected memory, else edit (text) / open tray (photo).
  function handleSlotActivate(blockId) {
    const block = currentBlocks.find(b => b.id === blockId);
    if (!block) return;
    if (selectedSource?.kind === block.type) {
      placeIntoSlot(blockId, selectedSource.kind, selectedSource.sourceKey);
      setSelectedSource(null);
      return;
    }
    if (block.type === 'text') {
      setEditingBlockId(blockId);
    } else {
      setPhotoTrayFor(blockId);
    }
  }

  function handleStopEdit(blockId, content) {
    setEditingBlockId(null);
    setActiveEditor(null);
    const block = currentBlocks.find(b => b.id === blockId);
    if (block && JSON.stringify(content) !== JSON.stringify(block.content)) {
      updateBlock(blockId, { content });
    }
  }

  function handleFontChange(blockId, key) {
    updateBlock(blockId, { fontFamily: key || undefined });
  }

  function setCurrentPageBg(color) {
    commitPages(prev => {
      const next = [...prev];
      next[currentPageIndex] = { ...next[currentPageIndex], backgroundColor: color || null };
      return next;
    });
  }

  function handleDragStart({ active }) {
    setActiveDrag(active.data.current || null);
    setSelectedSource(null);
    setEditingBlockId(null);
  }

  function handleDragEnd({ active, over }) {
    setActiveDrag(null);
    if (!over) return;
    const data = active.data.current;
    const slotType = over.data.current?.type;
    if (!data || data.kind !== slotType) return; // reject wrong-type drops
    placeIntoSlot(over.id, data.kind, data.sourceKey);
  }

  function applyTemplate(tpl) {
    const newBlocks = tpl.blocks.map(b => ({
      ...b,
      id: makeId(),
      content: b.type === 'text' ? toTiptapDoc('') : undefined,
      sourceKey: b.type === 'photo' ? null : undefined,
      url: b.type === 'photo' ? null : undefined,
      label: b.type === 'photo' ? null : undefined,
    }));
    commitPages(prev => {
      const next = [...prev];
      next[currentPageIndex] = { ...next[currentPageIndex], templateId: tpl.id, blocks: newBlocks };
      return next;
    });
    setEditingBlockId(null);
    setShowTemplatePicker(false);
  }

  function addPage() {
    commitPages(prev => [...prev, {
      id: makePageId(), sourceKeys: [], templateId: null, backgroundColor: null, blocks: [],
    }]);
    setCurrentPageIndex(pages.length);
    setEditingBlockId(null);
  }

  function removeCurrentPage() {
    if (pages.length <= 1) return;
    commitPages(prev => prev.filter((_, i) => i !== currentPageIndex));
    setCurrentPageIndex(i => Math.max(0, Math.min(i, pages.length - 2)));
    setEditingBlockId(null);
  }

  function changePage(nextIndex) {
    setEditingBlockId(null);
    setSelectedSource(null);
    setCurrentPageIndex(nextIndex);
  }

  function movePageLeft() {
    if (currentPageIndex === 0) return;
    commitPages(prev => {
      const next = [...prev];
      [next[currentPageIndex - 1], next[currentPageIndex]] = [next[currentPageIndex], next[currentPageIndex - 1]];
      return next;
    });
    setCurrentPageIndex(i => i - 1);
  }

  function movePageRight() {
    if (currentPageIndex === pages.length - 1) return;
    commitPages(prev => {
      const next = [...prev];
      [next[currentPageIndex], next[currentPageIndex + 1]] = [next[currentPageIndex + 1], next[currentPageIndex]];
      return next;
    });
    setCurrentPageIndex(i => i + 1);
  }

  async function handlePublish() {
    if (!onUpdate) { onClose(); return; }
    setPublishing(true);
    clearTimeout(saveTimerRef.current);
    try {
      await onUpdate(chapter.id, { layoutData: buildLayoutData(pages), status: 'published' });
      onClose();
    } catch {
      setPublishing(false);
    }
  }

  const typeLabel = TYPE_LABELS[chapter.anchorType] || 'Chapter';
  const saveLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : 'Saved ✓';
  const activeMemory = activeDrag ? memories.find(m => m.sourceKey === activeDrag.sourceKey) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-center min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{typeLabel}</p>
          <h2 className="font-display font-semibold text-foreground leading-tight truncate">
            {chapter.anchorLabel}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground w-16 text-right">{saveLabel}</span>
      </header>

      {/* Two panels */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Left — memories */}
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
                onSelect={handleSelect}
              />
            ))
          )}
        </aside>

        {/* Right — page canvas */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center gap-3">
          {/* Format toolbar — visible while editing a text slot */}
          {editingBlockId && activeEditor && <FormatToolbar editor={activeEditor} />}

          {/* Layout controls */}
          <div className="w-full max-w-[480px] flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground truncate">
              {currentTemplate ? currentTemplate.label : 'No layout chosen'}
            </span>
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors flex-shrink-0"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              Change layout
            </button>
          </div>

          {/* Canvas */}
          <div
            ref={containerRef}
            className="relative w-full max-w-[480px] border border-[#ddd0b8] rounded-xl overflow-hidden shadow-sm"
            style={{ aspectRatio: '3 / 4' }}
          >
            {containerSize > 0 && (
              <div
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: CANVAS_W, height: CANVAS_H,
                  transform: `scale(${scale})`, transformOrigin: 'top left',
                  backgroundColor: currentPage?.backgroundColor || theme?.bg || '#fdf9f2',
                }}
                onClick={(e) => { if (e.target === e.currentTarget) { setEditingBlockId(null); setSelectedSource(null); } }}
              >
                {currentBlocks.map(block => (
                  <Slot
                    key={block.id}
                    block={block}
                    theme={theme}
                    selectedSource={selectedSource}
                    isEditing={editingBlockId === block.id}
                    onActivate={handleSlotActivate}
                    onStopEdit={handleStopEdit}
                    onFontChange={handleFontChange}
                    onEditorReady={setActiveEditor}
                    onOpenTray={setPhotoTrayFor}
                  />
                ))}
              </div>
            )}
            {currentBlocks.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                <p className="text-sm text-muted-foreground">This page has no layout yet.</p>
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-color-highlight/30 hover:border-color-highlight/60 hover:bg-color-warm/10 transition-colors text-sm font-medium text-foreground"
                >
                  <LayoutTemplate className="w-4 h-4 text-color-highlight/60" />
                  Choose a layout
                </button>
              </div>
            )}
          </div>

          {/* Per-page background color */}
          {theme && (
            <div className="w-full max-w-[480px] flex items-center gap-2 px-1">
              <span className="text-xs text-muted-foreground shrink-0">Page bg:</span>
              <button
                onClick={() => setCurrentPageBg(null)}
                title="Default"
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${!currentPage?.backgroundColor ? 'border-color-highlight' : 'border-border hover:border-color-highlight/50'}`}
                style={{ backgroundColor: theme.bg }}
              >
                <span className="text-[7px] text-foreground/50 leading-none font-bold">A</span>
              </button>
              {(theme.palette || []).slice(1).map(color => (
                <button
                  key={color}
                  onClick={() => setCurrentPageBg(color)}
                  title={color}
                  className={`w-5 h-5 rounded border-2 transition-colors ${currentPage?.backgroundColor === color ? 'border-color-highlight' : 'border-border hover:border-color-highlight/50'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}

          {/* Page management */}
          <div className="w-full max-w-[480px] flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => changePage(Math.max(0, currentPageIndex - 1))}
                disabled={currentPageIndex === 0}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Previous page"
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
              <span className="text-sm text-muted-foreground px-1 tabular-nums">
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
                onClick={() => changePage(Math.min(pages.length - 1, currentPageIndex + 1))}
                disabled={currentPageIndex === pages.length - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={addPage}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add page
              </button>
              {pages.length > 1 && (
                <button
                  onClick={removeCurrentPage}
                  className="text-sm text-muted-foreground/70 hover:text-destructive transition-colors"
                >
                  Remove page
                </button>
              )}
            </div>
          </div>

          {/* Publish */}
          <div className="w-full max-w-[480px] pt-1">
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full bg-color-highlight hover:bg-color-highlight/90"
            >
              {publishing ? 'Publishing…' : 'Publish Chapter'}
            </Button>
          </div>
        </main>
      </div>

      {showTemplatePicker && (
        <TemplateSheet
          currentTemplateId={currentPage?.templateId}
          onSelect={applyTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {photoTrayFor && (
        <PhotoTray
          photos={availablePhotos}
          chapterId={chapter.id}
          onSelect={(photo) => { assignPhotoToSlot(photoTrayFor, photo); setPhotoTrayFor(null); }}
          onUploadDone={(photo) => {
            assignPhotoToSlot(photoTrayFor, photo);
            setExtraPhotos(prev => [...prev, photo]);
            setPhotoTrayFor(null);
          }}
          onClose={() => setPhotoTrayFor(null)}
        />
      )}
    </div>

    <DragOverlay dropAnimation={null}>
      {activeDrag && (
        <div className="rounded-lg border border-color-highlight bg-background shadow-lg p-2 max-w-[260px]">
          {activeDrag.kind === 'photo' ? (
            <img src={activeMemory?.photoUrl} alt="" className="w-14 h-14 rounded object-cover" />
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-snug">
              {activeMemory?.aiBody || activeMemory?.preview || 'Text'}
            </p>
          )}
        </div>
      )}
    </DragOverlay>
    </DndContext>
  );
}
