import React, { useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Wand2, GripVertical, Download } from "lucide-react";
import { generateStorybookPdf, downloadPdf } from "@/lib/storybookPdf";
import StorybookWizard from "@/components/storybook/StorybookWizard";
import ScrapbookBuilder from "@/components/storybook/ScrapbookBuilder";
import LayoutRenderer from "@/components/storybook/LayoutRenderer";
import { BOOK_THEMES, getTheme } from "@/lib/bookThemes";
import { formatDate } from "@/lib/formatting";
import { apiRequest } from "@/lib/api";
import BookCover from "@/components/storybook/BookCover";

export default function StorybookTab({
  chapters, tier, week, initialCredits,
  journalEntries, firsts, birthdate, babyName,
  coverPhotoUrl: coverPhotoUrlProp, coverSubtitle: coverSubtitleProp,
  onUpdate, onDelete,
  onWizardGenerate, onUpload,
  bookTheme: bookThemeProp, onUpdateBookTheme,
  onError,
}) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [credits, setCredits] = useState(initialCredits ?? null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingChapter, setEditingChapter] = useState(null);
  const [builderChapter, setBuilderChapter] = useState(null);
  const [bookThemeKey, setBookThemeKey] = useState(bookThemeProp || 'classic');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(coverPhotoUrlProp ?? null);
  const [coverSubtitle, setCoverSubtitle] = useState(coverSubtitleProp ?? null);
  const [exportingPdf, setExportingPdf] = useState(false);
  // Live data for the data-driven book pages (sv2-s2 birth_day, sv2-s3 people). Fetched here so the
  // builder, published view, and PDF all read the current values.
  const [birthDetails, setBirthDetails] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const activeTheme = getTheme(bookThemeKey);

  // Live data the book pages read (birth_details / family_members). Re-pulled whenever the builder
  // closes too — people/birth edits made inside the builder must flow into the published view + PDF
  // (otherwise pageData stays at its mount-time snapshot and e.g. newly-added grandparents are
  // missing from the published family tree).
  const loadPageData = useCallback(() => {
    apiRequest('/birth-details').then(setBirthDetails).catch(() => {});
    apiRequest('/family-members').then(list => setFamilyMembers(list || [])).catch(() => {});
  }, []);
  useEffect(() => { loadPageData(); }, [loadPageData]);

  const pageData = { birthDetails, familyMembers, babyName, birthdate, coverPhotoUrl };

  async function handleThemeSelect(key) {
    const prev = bookThemeKey;
    setBookThemeKey(key);
    if (onUpdateBookTheme) onUpdateBookTheme(key);
    try {
      await apiRequest('/baby-profile/book-theme', {
        method: 'PATCH',
        body: JSON.stringify({ theme: key }),
      });
    } catch {
      setBookThemeKey(prev);
      if (onUpdateBookTheme) onUpdateBookTheme(prev);
      onError?.('Failed to save theme');
    }
  }

  const isPaid = tier !== 'free';

  async function handleWizardGenerate(payload) {
    return onWizardGenerate(payload);
  }

  async function handleGeneratePages(chapterId, groups) {
    const pages = await apiRequest(`/storybook/generate-pages/${chapterId}`, {
      method: 'POST',
      body: JSON.stringify({ groups }),
    });
    setCredits(c => c === null ? null : Math.max(0, c - pages.length));
    return pages;
  }

  async function handleDownloadPdf() {
    const publishedChapters = sorted.filter(c => c.status === 'published');
    if (publishedChapters.length === 0) { onError?.('No published chapters to export'); return; }
    setExportingPdf(true);
    try {
      const doc = await generateStorybookPdf(publishedChapters, activeTheme, { babyName, birthdate, coverPhotoUrl, coverSubtitle, pageData });
      downloadPdf(doc, babyName || 'storybook');
    } catch (e) {
      onError?.('PDF export failed — please try again');
      console.error('PDF export:', e);
    } finally {
      setExportingPdf(false);
    }
  }

  function sortChapters(list) {
    return [...list].sort((a, b) => {
      const aOrder = a.sortOrder ?? 999999;
      const bOrder = b.sortOrder ?? 999999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  const [sorted, setSorted] = useState(() => sortChapters(chapters));

  useEffect(() => {
    setSorted(prev => {
      const prevOrder = prev.map(c => c.id);
      const updated = chapters.map(c => {
        const existing = prev.find(p => p.id === c.id);
        return existing ? { ...c, _dragIndex: prevOrder.indexOf(c.id) } : { ...c, _dragIndex: Infinity };
      });
      updated.sort((a, b) => a._dragIndex - b._dragIndex || new Date(a.createdAt) - new Date(b.createdAt));
      return updated.map(({ _dragIndex, ...c }) => c);
    });
  }, [chapters]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex(c => c.id === active.id);
    const newIndex = sorted.findIndex(c => c.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    setSorted(reordered);
    try {
      await apiRequest('/storybook/order', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds: reordered.map(c => c.id) }),
      });
    } catch {
      setSorted(sorted);
      onError?.('Failed to save chapter order');
    }
  }

  if (builderChapter) {
    return (
      <ScrapbookBuilder
        chapter={builderChapter}
        journalEntries={journalEntries ?? []}
        firsts={firsts ?? []}
        theme={activeTheme}
        onUpdate={onUpdate}
        onClose={() => { setBuilderChapter(null); loadPageData(); }}
        pageData={pageData}
        onError={onError}
      />
    );
  }

  if (showWizard || editingChapter) {
    return (
      <StorybookWizard
        editMode={!!editingChapter}
        initialChapter={editingChapter}
        journalEntries={journalEntries ?? []}
        firsts={firsts ?? []}
        birthdate={birthdate}
        chapters={chapters}
        week={week}
        tier={tier}
        credits={credits}
        theme={activeTheme}
        onWizardGenerate={handleWizardGenerate}
        onGeneratePages={handleGeneratePages}
        onUpdate={onUpdate}
        onUpload={onUpload}
        onClose={() => { setShowWizard(false); setEditingChapter(null); }}
        onError={onError}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Book cover */}
      <BookCover
        babyName={babyName}
        birthdate={birthdate}
        coverPhotoUrl={coverPhotoUrl}
        coverSubtitle={coverSubtitle}
        theme={activeTheme}
        onCoverPhotoChange={setCoverPhotoUrl}
        onCoverSubtitleChange={setCoverSubtitle}
        onError={onError}
      />

      {/* Book theme picker + PDF download */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium shrink-0">Book theme:</span>
        <div className="flex gap-3 flex-wrap">
          {BOOK_THEMES.map(t => {
            const selected = bookThemeKey === t.key;
            return (
              <button
                key={t.key}
                onClick={() => handleThemeSelect(t.key)}
                className="flex flex-col items-center gap-1 group"
                title={t.label}
              >
                <div
                  className={`rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-color-highlight scale-105 shadow-md' : 'border-transparent hover:border-color-highlight/40'}`}
                  style={{ width: 56, height: 44 }}
                >
                  <div style={{ backgroundColor: t.bg, height: 36 }} />
                  <div style={{ backgroundColor: t.accent, height: 8 }} />
                </div>
                <span className={`text-[10px] font-medium ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
        {sorted.some(c => c.status === 'published') && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto shrink-0 gap-1.5"
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exportingPdf ? 'Exporting…' : 'Download PDF'}
          </Button>
        )}
      </div>

      {!isPaid && !bannerDismissed && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <p className="text-sm">Your story is ready to write — upgrade to Plus to generate chapters.</p>
          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-100" disabled>
              Upgrade to Plus
            </Button>
            <button onClick={() => setBannerDismissed(true)} className="text-amber-400 hover:text-amber-700 font-bold text-lg leading-none">✕</button>
          </div>
        </div>
      )}

      {/* Period chapter wizard entry point */}
      <Card className="bg-color-warm/10 border-color-highlight/20 border">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground">Write a Period Chapter</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose a time window, pick what to include, and let AI write your baby's story.
            </p>
          </div>
          <Button
            onClick={() => setShowWizard(true)}
            className="flex-shrink-0 bg-color-highlight hover:bg-color-highlight/90 gap-2"
          >
            <Wand2 className="w-4 h-4" />
            Create
          </Button>
        </CardContent>
      </Card>

      {chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BookOpen className="w-16 h-16 text-primary/30 mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">Your story starts here</p>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
            Create your first chapter above to get started.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {sorted.map(chapter => (
                <SortableChapterCard
                  key={chapter.id}
                  chapter={chapter}
                  theme={activeTheme}
                  pageData={pageData}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onEditLayout={(ch) => setBuilderChapter(ch)}
                  onError={onError}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableChapterCard(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.chapter.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-stretch gap-1"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex items-center px-1 text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing touch-none transition-colors flex-shrink-0"
        tabIndex={-1}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <ChapterCard {...props} />
      </div>
    </div>
  );
}

function ChapterCard({ chapter, theme, pageData, onUpdate, onDelete, onEditLayout, onError }) {
  const typeLabel =
    chapter.anchorType === 'period' ? 'Time Period' :
    chapter.anchorType === 'milestone' ? 'Milestone' : 'First Time';

  async function handlePublish() {
    try {
      await onUpdate(chapter.id, { status: 'published' });
    } catch {
      onError('Failed to publish chapter');
    }
  }

  if (chapter.status === 'published') {
    return (
      <div
        className="rounded-xl shadow-sm overflow-hidden border border-[#ddd0b8] dark:border-border max-w-[560px] mx-auto"
        style={{ '--book-accent': theme?.accent, backgroundColor: theme?.bg || '#fdf9f2' }}
      >
        <div className="px-8 pt-6 pb-4">
          <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground mb-2" style={{ color: theme?.textColor, opacity: theme?.textColor ? 0.6 : undefined }}>{typeLabel}</p>
          <h2 className="text-center font-display font-semibold text-xl text-foreground mb-3 leading-snug" style={{ color: theme?.textColor }}>{chapter.anchorLabel}</h2>
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-px w-14" style={{ backgroundColor: theme?.accent, opacity: 0.25 }} />
            <span className="text-xs" style={{ color: theme?.accent, opacity: 0.5 }}>{theme?.dividerChar || '◆'}</span>
            <div className="h-px w-14" style={{ backgroundColor: theme?.accent, opacity: 0.25 }} />
          </div>
        </div>
        <LayoutRenderer layout={chapter.layoutData} theme={theme} pageData={pageData} />
        {chapter.publishedAt && (
          <p className="text-center text-xs text-muted-foreground px-8 py-4" style={{ color: theme?.textColor, opacity: theme?.textColor ? 0.6 : undefined }}>
            {formatDate(chapter.publishedAt)}
          </p>
        )}
        <div className="px-6 py-3 border-t border-[#ddd0b8] dark:border-border flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => onEditLayout(chapter)}>Edit</Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(chapter.id)} className="text-red-500 hover:text-red-600 hover:border-red-300">Delete</Button>
        </div>
      </div>
    );
  }

  // Draft / unlocked — has layoutData, not yet published.
  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
      <CardContent className="p-5 space-y-3">
        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{typeLabel}</span>
          <h3 className="font-display font-semibold text-foreground text-lg leading-tight">{chapter.anchorLabel}</h3>
        </div>
        <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
          Draft — review before publishing
        </span>
        <div className="rounded-lg overflow-hidden bg-white border border-border">
          <LayoutRenderer layout={chapter.layoutData} theme={theme} pageData={pageData} />
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button size="sm" onClick={handlePublish} className="bg-color-highlight hover:bg-color-highlight/90">
            Approve &amp; Publish
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEditLayout(chapter)}>Edit</Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(chapter.id)} className="text-red-500 hover:text-red-600 hover:border-red-300 ml-auto">
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
