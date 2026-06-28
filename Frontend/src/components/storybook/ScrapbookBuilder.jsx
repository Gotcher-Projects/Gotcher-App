import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Plus, LayoutTemplate,
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
import FamilyRosterPopup from "@/components/storybook/FamilyRosterPopup";
import PhotoTray from "@/components/storybook/PhotoTray";
import FormatToolbar from "@/components/storybook/FormatToolbar";
import MemoryPanel from "@/components/storybook/MemoryPanel";
import TemplateSheet from "@/components/storybook/TemplateSheet";
import Slot from "@/components/storybook/Slot";
import { buildMemoryList, extractPieceText } from "@/lib/storybookGrouping";
import { toTiptapDoc, contentToPlainText } from "@/lib/tiptap";
import { cleanBodyText } from "@/lib/storybookText";
import { CANVAS_W, CANVAS_H, useCanvasScale } from "@/lib/bookCanvas";
import { openSlotCropModal } from "@/lib/imageUtils";
import {
  makeId, makePageId, splitTextParts, initPages, buildLayoutData,
} from "@/lib/storybookLayout";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS = { period: 'Time Period', milestone: 'Milestone', first_time: 'First Time' };

// ── Main component ────────────────────────────────────────────────────────────

export default function ScrapbookBuilder({ chapter, journalEntries, firsts, theme, onUpdate, onClose, pageData, onError }) {
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
        aiBody: gc?.body ? cleanBodyText(gc.body) : null,
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
    const mem = memories.find(m => m.sourceKey === sourceKey);
    if (!block || !mem?.photoUrl) return;
    const slotAR = block.slotAR ?? (block.width * CANVAS_W) / (block.height * CANVAS_H);
    // l-wrap tracks the photo source separately so both used-indicators work.
    const keyPatch = block.type === 'l-wrap' ? { photoSourceKey: sourceKey } : { sourceKey };
    cancelSlotCropRef.current = openSlotCropModal(
      mem.photoUrl, slotAR,
      (crop) => {
        cancelSlotCropRef.current = null;
        updateBlock(blockId, { url: mem.photoUrl, label: mem.label || '', crop, ...keyPatch });
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
    const newBlocks = tpl.blocks.map(b => ({
      ...b,
      id: b.id || makeId(), // preserve explicit template IDs (e.g. moment-hero role IDs)
      content: (b.type === 'text' || b.type === 'l-wrap') ? toTiptapDoc('') : undefined,
      sourceKey: (b.type === 'photo' || b.type === 'l-wrap') ? null : undefined,
      url: (b.type === 'photo' || b.type === 'l-wrap') ? null : undefined,
      label: (b.type === 'photo' || b.type === 'l-wrap') ? null : undefined,
      photoSourceKey: b.type === 'l-wrap' ? null : undefined,
    }));
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
        <MemoryPanel
          memories={memories}
          selectedSource={selectedSource}
          usedTextKeys={usedTextKeys}
          usedPhotoKeys={usedPhotoKeys}
          onSelect={handleSelect}
        />

        {/* Right — page canvas */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center gap-3">
          {/* Format toolbar — visible while editing a text slot */}
          {editingBlockId && activeEditor && <FormatToolbar editor={activeEditor} />}

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
              <button
                onClick={() => setShowTemplatePicker(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                Change layout
              </button>
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
