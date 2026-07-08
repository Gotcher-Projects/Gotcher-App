import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Plus, LayoutTemplate, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/lib/storybookTemplates";
import MomentHeroCanvas from "@/components/storybook/MomentHeroCanvas";
import LetterCanvas from "@/components/storybook/LetterCanvas";
import GalleryCanvas from "@/components/storybook/GalleryCanvas";
import BirthDayCanvas from "@/components/storybook/BirthDayCanvas";
import PeopleCanvas from "@/components/storybook/PeopleCanvas";
import FamilyTreeCanvas from "@/components/storybook/FamilyTreeCanvas";
import ChapterDividerCanvas from "@/components/storybook/ChapterDividerCanvas";
import PromptsCanvas from "@/components/storybook/PromptsCanvas";
import BumpCanvas from "@/components/storybook/BumpCanvas";
import MilestonesCanvas from "@/components/storybook/MilestonesCanvas";
import FamilyRosterPopup from "@/components/storybook/FamilyRosterPopup";
import PhotoTray from "@/components/storybook/PhotoTray";
import FormatToolbar from "@/components/storybook/FormatToolbar";
import MemoryPanel from "@/components/storybook/MemoryPanel";
import TemplateSheet from "@/components/storybook/TemplateSheet";
import Slot from "@/components/storybook/Slot";
import { buildMemoryList, extractPieceText } from "@/lib/storybookGrouping";
import { buildGuidedMemories, groupMemoriesIntoBuckets } from "@/lib/guidedBook";
import { MAX_MILESTONE_ROWS, seededMilestoneDate } from "@/lib/milestonesPage";
import { toTiptapDoc, contentToPlainText } from "@/lib/tiptap";
import { cleanBodyText } from "@/lib/storybookText";
import { CANVAS_W, CANVAS_H, useCanvasScale } from "@/lib/bookCanvas";
import { openSlotCropModal } from "@/lib/imageUtils";
import {
  makePageId, splitTextParts, initPages, buildLayoutData, emptyBlocksForTemplate,
} from "@/lib/storybookLayout";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS = { period: 'Time Period', milestone: 'Milestone', first_time: 'First Time' };

// sv2-s8.5: soft cap on pages in a freeform book (future-changeable). Guided chapters are single-page
// so they never approach it; the cap effectively governs the freeform "Add page" affordance.
const MAX_PAGES = 30;

// ── Main component ────────────────────────────────────────────────────────────

export default function ScrapbookBuilder({
  chapter, journalEntries, firsts, bumpPhotos = [], birthdate = null,
  theme, onUpdate, onClose, pageData, onError,
  locked = false, promptText = null, eyebrow = null,
  showMemories = true, defaultBucket = null, usedKeys = null,
}) {
  const containerRef = useRef(null);
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
  // Local family roster so the People page live-renders the latest data (the popup updates it).
  const [familyMembers, setFamilyMembers] = useState(pageData?.familyMembers || []);
  const [peoplePopupOpen, setPeoplePopupOpen] = useState(false);
  const saveTimerRef = useRef(null);
  const cancelSlotCropRef = useRef(null);

  useEffect(() => { setFamilyMembers(pageData?.familyMembers || []); }, [pageData?.familyMembers]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);
  useEffect(() => () => cancelSlotCropRef.current?.(), []);

  const { containerSize, scale } = useCanvasScale(containerRef);
  const currentPage = pages[currentPageIndex];
  const currentBlocks = currentPage?.blocks || [];
  const currentTemplate = TEMPLATES.find(t => t.id === currentPage?.templateId) || null;

  // Guided books (sv2-s7.5a) surface the WHOLE memory pool (all journals, all firsts incl. their V38
  // extra photos, and bump photos) grouped into time buckets — not the wizard-selected subset. Built
  // once here so both the panel and the placement/overlay lookups share the same objects.
  const guidedMemories = useMemo(
    () => (locked ? buildGuidedMemories({ journalEntries, firsts, bumpPhotos }) : null),
    [locked, journalEntries, firsts, bumpPhotos]
  );

  // Memories with the AI title/body overlaid for the cards.
  const memories = useMemo(() => {
    if (locked) return guidedMemories || [];
    // sv2-s8.5: freeform surfaces the WHOLE memory pool (all journals + firsts), not a wizard-selected
    // subset — the period wizard is gone, so there is no pre-filter to apply.
    const base = buildMemoryList({
      journalIds: (journalEntries || []).map(e => e.id),
      firstTimeIds: (firsts || []).map(f => f.id),
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
        aiBody: gc?.body ? cleanBodyText(gc.body) : null,
        rawText,
      };
    });
  }, [locked, guidedMemories, chapter, journalEntries, firsts]);

  // Derived "already in the book" state — which memory pieces are placed on any page.
  // A text piece counts as used only when its placed block has non-empty content; a
  // photo piece counts when its placed block has a url. Reactive to every page change.
  const { usedTextKeys, usedPhotoKeys } = useMemo(() => {
    const textKeys = new Set();
    const photoKeys = new Set();
    for (const page of pages) {
      for (const b of page.blocks || []) {
        if (b.type === 'text') {
          if (b.sourceKey && contentToPlainText(b.content).trim()) textKeys.add(b.sourceKey);
        } else if (b.type === 'photo') {
          if (b.sourceKey && b.url) photoKeys.add(b.sourceKey);
        } else if (b.type === 'l-wrap') {
          // l-wrap tracks text and photo provenance on separate keys.
          if (b.sourceKey && contentToPlainText(b.content).trim()) textKeys.add(b.sourceKey);
          if (b.photoSourceKey && b.url) photoKeys.add(b.photoSourceKey);
        }
      }
    }
    return { usedTextKeys: textKeys, usedPhotoKeys: photoKeys };
  }, [pages]);

  // Photos the tray can choose from: entry/first photos, chapter photos, plus any
  // uploaded during this builder session. Guided books draw from the whole pool (every memory's
  // photos, incl. First V38 extras + bump), so placement/tray can resolve any dragged photo by key.
  const availablePhotos = useMemo(() => {
    if (locked) {
      const photos = [];
      for (const m of guidedMemories || []) for (const p of m.photos || []) photos.push(p);
      return [...photos, ...extraPhotos];
    }
    // sv2-s8.5: freeform draws photos from ALL journals + firsts (no wizard pre-selection).
    const photos = [];
    for (const entry of journalEntries || []) {
      const url = chapter.photoOverrides?.[`journal:${entry.id}`] || entry.image_url;
      if (url) photos.push({ sourceKey: `journal:${entry.id}`, url, label: entry.title });
    }
    for (const ft of firsts || []) {
      const url = chapter.photoOverrides?.[`first_time:${ft.id}`] || ft.imageUrl;
      if (url) photos.push({ sourceKey: `first_time:${ft.id}`, url, label: ft.label });
    }
    for (const cp of chapter.chapterPhotos || []) {
      photos.push({ sourceKey: cp.key, url: cp.url, label: cp.label || '' });
    }
    return [...photos, ...extraPhotos];
  }, [locked, guidedMemories, chapter, journalEntries, firsts, extraPhotos]);

  // Time-bucket grouping + book-wide "used" dimming (sv2-s7.5a). BOTH modes bucket the pool by time so
  // a book with lots of entries stays tidy — guided passes a per-page `defaultBucket` to auto-open one
  // section; freeform passes null, so every bucket starts collapsed. The book-wide used-set (other
  // chapters, from StorybookTab) unions with the current page's local sets so a piece placed elsewhere
  // still dims here.
  const buckets = useMemo(
    () => (showMemories ? groupMemoriesIntoBuckets(memories, birthdate) : null),
    [showMemories, memories, birthdate]
  );
  const mergedUsedTextKeys = useMemo(
    () => (usedKeys?.text ? new Set([...usedTextKeys, ...usedKeys.text]) : usedTextKeys),
    [usedTextKeys, usedKeys]
  );
  const mergedUsedPhotoKeys = useMemo(
    () => (usedKeys?.photo ? new Set([...usedPhotoKeys, ...usedKeys.photo]) : usedPhotoKeys),
    [usedPhotoKeys, usedKeys]
  );

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

  // Milestones page (sv2-s6.5): re-seed the editable date rows from the latest achieved milestones,
  // overwriting any manual edits. Names are always live; only the dates are stored as overrides.
  function handleRefreshMilestones() {
    const achieved = pageData?.achievedMilestones || [];
    if (!window.confirm('Replace the dates on this page with the latest from your milestones? This overwrites any edits.')) return;
    setCurrentBlocks(blocks => blocks.map(b => {
      const m = b.id?.match(/^date(\d+)$/);
      if (!m) return b;
      return { ...b, content: toTiptapDoc(seededMilestoneDate(achieved, parseInt(m[1], 10))) };
    }));
  }

  // Fill a slot from a memory piece (text) or its photo. Records the owning
  // sourceKey so re-renders and later edits stay consistent.
  // Blocks with a matching contentSource.splitGroup are all filled simultaneously,
  // with the source text split across them at a natural boundary.
  function placeIntoSlot(blockId, kind, sourceKey) {
    setCurrentBlocks(blocks => {
      const target = blocks.find(b => b.id === blockId);
      if (!target) return blocks;

      // l-wrap text only — photos go through placePhotoIntoSlot (crop modal).
      if (target.type === 'l-wrap') {
        if (kind !== 'text') return blocks;
        const gc = chapter.generatedContent?.[sourceKey];
        const piece = target.contentSource?.piece || 'body';
        let fullText = extractPieceText(gc, piece);
        if (!fullText) {
          const mem = memories.find(m => m.sourceKey === sourceKey);
          fullText = piece === 'title' ? (mem?.label || '') : cleanBodyText(mem?.rawText || '');
        }
        return blocks.map(b =>
          b.id === blockId
            ? { ...b, content: toTiptapDoc(fullText), sourceKey, suppressDropCap: true }
            : b
        );
      }

      if (kind === 'text' && target.type === 'text') {
        const gc = chapter.generatedContent?.[sourceKey];
        const piece = target.contentSource?.piece || 'body';
        let fullText = extractPieceText(gc, piece);
        if (!fullText) {
          const mem = memories.find(m => m.sourceKey === sourceKey);
          fullText = piece === 'title' ? (mem?.label || '') : cleanBodyText(mem?.rawText || '');
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

      return blocks;
    });
  }

  function placePhotoIntoSlot(blockId, sourceKey) {
    const block = currentBlocks.find(b => b.id === blockId);
    // Resolve the photo by its own key from the available pool (guided multi-photo memories + bump
    // give each photo a unique key), falling back to the memory's hero photo for freeform.
    let photo = availablePhotos.find(p => p.sourceKey === sourceKey) || null;
    if (!photo) {
      const mem = memories.find(m => m.sourceKey === sourceKey);
      if (mem?.photoUrl) photo = { url: mem.photoUrl, label: mem.label };
    }
    if (!block || !photo?.url) return;
    const slotAR = block.slotAR ?? (block.width * CANVAS_W) / (block.height * CANVAS_H);
    // l-wrap tracks the photo source separately so both used-indicators work.
    const keyPatch = block.type === 'l-wrap' ? { photoSourceKey: sourceKey } : { sourceKey };
    cancelSlotCropRef.current = openSlotCropModal(
      photo.url, slotAR,
      (crop) => {
        cancelSlotCropRef.current = null;
        updateBlock(blockId, { url: photo.url, label: photo.label || '', crop, ...keyPatch });
      },
      () => { cancelSlotCropRef.current = null; }
    );
  }

  function assignPhotoToSlot(blockId, photo) {
    const block = currentBlocks.find(b => b.id === blockId);
    if (!block) return;
    const slotAR = block.slotAR ?? (block.width * CANVAS_W) / (block.height * CANVAS_H);
    const keyPatch = block.type === 'l-wrap' ? { photoSourceKey: photo.sourceKey } : { sourceKey: photo.sourceKey };
    cancelSlotCropRef.current = openSlotCropModal(
      photo.url, slotAR,
      (crop) => {
        cancelSlotCropRef.current = null;
        updateBlock(blockId, { url: photo.url, label: photo.label || '', crop, ...keyPatch });
      },
      () => { cancelSlotCropRef.current = null; }
    );
  }

  function handleReCrop(blockId) {
    const block = currentBlocks.find(b => b.id === blockId);
    if (!block?.url) return;
    const slotAR = block.slotAR ?? (block.width * CANVAS_W) / (block.height * CANVAS_H);
    cancelSlotCropRef.current = openSlotCropModal(
      block.url, slotAR,
      (crop) => { cancelSlotCropRef.current = null; updateBlock(blockId, { crop }); },
      () => { cancelSlotCropRef.current = null; }
    );
  }

  function handleSelect(kind, sourceKey) {
    setEditingBlockId(null);
    setSelectedSource(prev =>
      prev && prev.kind === kind && prev.sourceKey === sourceKey ? null : { kind, sourceKey }
    );
  }

  // Click on a slot: place a selected memory, else edit (text) / open tray (photo).
  function handleSlotActivate(slotId) {
    // l-wrap sub-zones append ':text' / ':photo'; block ids never contain ':'.
    const subMatch = String(slotId).match(/:(text|photo)$/);
    const subZone = subMatch ? subMatch[1] : null;
    const blockId = subZone ? slotId.slice(0, -(subZone.length + 1)) : slotId;
    const block = currentBlocks.find(b => b.id === blockId);
    if (!block) return;

    if (block.type === 'l-wrap') {
      // Photo sub-zone: place an armed photo (with crop), else open the tray.
      if (subZone === 'photo') {
        if (selectedSource?.kind === 'photo') {
          placePhotoIntoSlot(blockId, selectedSource.sourceKey);
          setSelectedSource(null);
        } else {
          setPhotoTrayFor(blockId);
        }
        return;
      }
      // Text sub-zone (or a bare click on padding): place an armed memory, else
      // enter inline text editing.
      if (selectedSource?.kind === 'text') {
        placeIntoSlot(blockId, 'text', selectedSource.sourceKey);
        setSelectedSource(null);
      } else if (selectedSource?.kind === 'photo') {
        placePhotoIntoSlot(blockId, selectedSource.sourceKey);
        setSelectedSource(null);
      } else {
        setEditingBlockId(blockId);
      }
      return;
    }
    if (selectedSource?.kind === block.type) {
      if (selectedSource.kind === 'photo') {
        placePhotoIntoSlot(blockId, selectedSource.sourceKey);
      } else {
        placeIntoSlot(blockId, selectedSource.kind, selectedSource.sourceKey);
      }
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
    if (!data) return;
    if (slotType === 'l-wrap') {
      // l-wrap is one droppable that accepts both kinds: text fills the body,
      // photo opens the crop modal then floats top-right.
      if (data.kind === 'text') placeIntoSlot(over.id, 'text', data.sourceKey);
      else if (data.kind === 'photo') placePhotoIntoSlot(over.id, data.sourceKey);
      return;
    }
    if (data.kind !== slotType) return; // reject wrong-type drops
    if (data.kind === 'photo') {
      placePhotoIntoSlot(over.id, data.sourceKey);
    } else {
      placeIntoSlot(over.id, data.kind, data.sourceKey);
    }
  }

  function applyTemplate(tpl) {
    const newBlocks = emptyBlocksForTemplate(tpl);
    commitPages(prev => {
      const next = [...prev];
      next[currentPageIndex] = { ...next[currentPageIndex], templateId: tpl.id, blocks: newBlocks };
      return next;
    });
    setEditingBlockId(null);
    setShowTemplatePicker(false);
    // The People page needs roster + per-page selection — open its popup right after adding it.
    if (tpl.renderer === 'people') setPeoplePopupOpen(true);
  }

  // Persist the People popup's selection + variant into the current page's config block, and refresh
  // the local roster so the canvas live-renders the latest people.
  function applyPeopleConfig({ selectedMemberIds, variant, members }) {
    if (members) setFamilyMembers(members);
    commitPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      page.blocks = (page.blocks || []).map(b =>
        b.type === 'people-config' ? { ...b, selectedMemberIds, variant } : b
      );
      next[currentPageIndex] = page;
      return next;
    });
  }

  // One-click escape for a photo-less l-wrap: re-shape its single block into the
  // full-page text-only layout, preserving the text content / font / provenance and
  // dropping the photo float. Avoids leaving an empty reserved corner forever.
  function convertLWrapToTextOnly(blockId) {
    const textTpl = TEMPLATES.find(t => t.id === 'text-only');
    const tb = textTpl.blocks[0];
    commitPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      page.templateId = 'text-only';
      page.blocks = page.blocks.map(b => {
        if (b.id !== blockId || b.type !== 'l-wrap') return b;
        return {
          id: b.id,
          type: 'text',
          x: tb.x, y: tb.y, width: tb.width, height: tb.height,
          content: b.content,
          sourceKey: b.sourceKey ?? null,
          fontFamily: b.fontFamily,
          contentSource: tb.contentSource,
        };
      });
      next[currentPageIndex] = page;
      return next;
    });
    setEditingBlockId(null);
  }

  function addPage() {
    if (pages.length >= MAX_PAGES) return; // sv2-s8.5: 30-page soft cap
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

  // Locked (guided) pages have no publish step — flush the pending autosave and close.
  async function handleDone() {
    clearTimeout(saveTimerRef.current);
    if (onUpdate) {
      setPublishing(true);
      try { await onUpdate(chapter.id, { layoutData: buildLayoutData(pages) }); } catch {}
    }
    onClose();
  }

  const typeLabel = TYPE_LABELS[chapter.anchorType] || 'Chapter';
  const saveLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : 'Saved ✓';
  // Drag overlay preview: photos resolve by their own key from the pool (multi-photo/bump keys aren't
  // memory keys); text resolves from the memory list.
  const activePhoto = activeDrag?.kind === 'photo' ? availablePhotos.find(p => p.sourceKey === activeDrag.sourceKey) : null;
  const activeTextMemory = activeDrag?.kind === 'text' ? memories.find(m => m.sourceKey === activeDrag.sourceKey) : null;

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
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{eyebrow || typeLabel}</p>
          <h2 className="font-display font-semibold text-foreground leading-tight truncate">
            {chapter.anchorLabel}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground w-16 text-right">{saveLabel}</span>
      </header>

      {/* Two panels */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Left — memories, grouped into collapsible time buckets for both modes (sv2-s7.5a; extended
            to freeform on request so big libraries stay tidy). Hidden on auto/prefill guided pages
            (they render from data — nothing to drag). */}
        {showMemories && (
          <MemoryPanel
            memories={memories}
            buckets={buckets}
            defaultOpenBucket={defaultBucket}
            selectedSource={selectedSource}
            usedTextKeys={mergedUsedTextKeys}
            usedPhotoKeys={mergedUsedPhotoKeys}
            onSelect={handleSelect}
          />
        )}

        {/* Right — page canvas */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center gap-3">
          {/* Format toolbar — visible while editing a text slot */}
          {editingBlockId && activeEditor && <FormatToolbar editor={activeEditor} />}

          {/* Guided prompt — the page's guidance ("Your first bath…") */}
          {promptText && (
            <div className="w-full max-w-[480px] rounded-lg bg-color-warm/15 border border-color-highlight/20 px-3.5 py-2.5 text-sm text-foreground/80">
              {promptText}
            </div>
          )}

          {/* Layout controls */}
          <div className="w-full max-w-[480px] flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground truncate">
              {currentTemplate ? currentTemplate.label : 'No layout chosen'}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {(currentTemplate?.renderer === 'people' || currentTemplate?.renderer === 'family_tree') && (
                <button
                  onClick={() => setPeoplePopupOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
                >
                  Edit people
                </button>
              )}
              {currentTemplate?.renderer === 'milestones' && (
                <button
                  onClick={handleRefreshMilestones}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh from milestones
                </button>
              )}
              {/* Guided pages have a fixed layout — no template switching. */}
              {!locked && (
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  Change layout
                </button>
              )}
            </div>
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
                {currentTemplate?.renderer === 'moment_hero' ? (
                  <MomentHeroCanvas
                    blocks={currentBlocks}
                    orientation={currentTemplate.id === 'moment-hero-landscape' ? 'landscape' : 'portrait'}
                    theme={theme}
                    editingBlockId={editingBlockId}
                    onActivate={handleSlotActivate}
                    onStopEdit={handleStopEdit}
                    onEditorReady={setActiveEditor}
                    onOpenTray={setPhotoTrayFor}
                    onReCrop={handleReCrop}
                  />
                ) : currentTemplate?.renderer === 'letter' ? (
                  <LetterCanvas
                    blocks={currentBlocks}
                    theme={theme}
                    eyebrow={chapter.anchorType === 'guided' ? chapter.anchorLabel : undefined}
                    editingBlockId={editingBlockId}
                    onActivate={handleSlotActivate}
                    onStopEdit={handleStopEdit}
                    onEditorReady={setActiveEditor}
                  />
                ) : currentTemplate?.renderer === 'gallery' ? (
                  <GalleryCanvas
                    blocks={currentBlocks}
                    theme={theme}
                    editingBlockId={editingBlockId}
                    onActivate={handleSlotActivate}
                    onStopEdit={handleStopEdit}
                    onEditorReady={setActiveEditor}
                    onOpenTray={setPhotoTrayFor}
                    onReCrop={handleReCrop}
                  />
                ) : currentTemplate?.renderer === 'birth_day' ? (
                  <BirthDayCanvas
                    birthDetails={pageData?.birthDetails}
                    babyName={pageData?.babyName}
                    birthdate={pageData?.birthdate}
                    coverPhotoUrl={pageData?.coverPhotoUrl}
                    theme={theme}
                  />
                ) : currentTemplate?.renderer === 'people' ? (
                  <PeopleCanvas
                    blocks={currentBlocks}
                    familyMembers={familyMembers}
                    theme={theme}
                  />
                ) : currentTemplate?.renderer === 'family_tree' ? (
                  <FamilyTreeCanvas
                    familyMembers={familyMembers}
                    babyName={pageData?.babyName}
                    coverPhotoUrl={pageData?.coverPhotoUrl}
                    theme={theme}
                  />
                ) : currentTemplate?.renderer === 'chapter_divider' ? (
                  <ChapterDividerCanvas
                    blocks={currentBlocks}
                    theme={theme}
                    editingBlockId={editingBlockId}
                    onActivate={handleSlotActivate}
                    onStopEdit={handleStopEdit}
                    onEditorReady={setActiveEditor}
                  />
                ) : currentTemplate?.renderer === 'prompts' ? (
                  <PromptsCanvas
                    blocks={currentBlocks}
                    theme={theme}
                    editingBlockId={editingBlockId}
                    onActivate={handleSlotActivate}
                    onStopEdit={handleStopEdit}
                    onEditorReady={setActiveEditor}
                  />
                ) : currentTemplate?.renderer === 'bump' ? (
                  <BumpCanvas
                    blocks={currentBlocks}
                    theme={theme}
                    editingBlockId={editingBlockId}
                    onActivate={handleSlotActivate}
                    onStopEdit={handleStopEdit}
                    onEditorReady={setActiveEditor}
                    onOpenTray={setPhotoTrayFor}
                    onReCrop={handleReCrop}
                  />
                ) : currentTemplate?.renderer === 'milestones' ? (
                  <MilestonesCanvas
                    blocks={currentBlocks}
                    theme={theme}
                    achievedMilestones={pageData?.achievedMilestones}
                    editingBlockId={editingBlockId}
                    onActivate={handleSlotActivate}
                    onStopEdit={handleStopEdit}
                    onEditorReady={setActiveEditor}
                    onOpenTray={setPhotoTrayFor}
                  />
                ) : (
                  currentBlocks.map(block => (
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
                      onReCrop={handleReCrop}
                      onConvertToTextOnly={convertLWrapToTextOnly}
                    />
                  ))
                )}
              </div>
            )}
            {!currentTemplate && (
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

          {/* Page management — hidden for guided pages (one fixed page, locked sequence) */}
          {!locked && (
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
                disabled={pages.length >= MAX_PAGES}
                title={pages.length >= MAX_PAGES ? `A book can have up to ${MAX_PAGES} pages` : undefined}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
                {pages.length >= MAX_PAGES ? `Max ${MAX_PAGES} pages` : 'Add page'}
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
          )}

          {/* Done (guided) / Publish (freeform) */}
          <div className="w-full max-w-[480px] pt-1">
            <Button
              onClick={locked ? handleDone : handlePublish}
              disabled={publishing}
              className="w-full bg-color-highlight hover:bg-color-highlight/90"
            >
              {locked
                ? (publishing ? 'Saving…' : 'Done')
                : (publishing ? 'Publishing…' : 'Publish Chapter')}
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

      {peoplePopupOpen && (() => {
        const cfg = currentBlocks.find(b => b.type === 'people-config') || {};
        return (
          <FamilyRosterPopup
            open={peoplePopupOpen}
            onClose={() => setPeoplePopupOpen(false)}
            initialSelectedIds={cfg.selectedMemberIds || []}
            initialVariant={cfg.variant || 'two-up'}
            mode={currentTemplate?.renderer === 'family_tree' ? 'roster' : 'select'}
            onApply={applyPeopleConfig}
            onError={onError}
          />
        );
      })()}

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
            <img src={activePhoto?.url} alt="" className="w-14 h-14 rounded object-cover" />
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-snug">
              {activeTextMemory?.aiBody || activeTextMemory?.preview || 'Text'}
            </p>
          )}
        </div>
      )}
    </DragOverlay>
    </DndContext>
  );
}
