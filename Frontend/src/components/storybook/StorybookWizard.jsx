import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, X, ChevronLeft, Camera, BookOpen, PenLine, Layers, Zap } from "lucide-react";
import { STORYBOOK_PERIODS } from "@/lib/storybookPeriods";
import { openCropModal, uploadCroppedPhoto } from "@/lib/imageUtils";
import { pickPhoto } from "@/lib/camera";
import ScrapbookBuilder from "@/components/storybook/ScrapbookBuilder";
import { buildMemoryList, autoSuggestGroups, buildGroupedLayoutData } from "@/lib/storybookGrouping";
import { formatDate } from "@/lib/formatting";

function weeksFromBirthdate(dateStr, birthdate) {
  if (!birthdate || !dateStr) return -1;
  return Math.floor((new Date(dateStr) - new Date(birthdate)) / (7 * 24 * 3600 * 1000));
}

const fmtDate = raw => formatDate(raw, { style: 'short' });

export default function StorybookWizard({
  journalEntries,
  firsts,
  birthdate,
  chapters,
  week,
  tier,
  credits,
  theme,
  onWizardGenerate,
  onGeneratePages,
  onUpdate,
  onUpload,
  onClose,
  onError,
  editMode = false,
  initialChapter = null,
}) {
  const [step, setStep] = useState(editMode ? 6 : 1);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedJournalIds, setSelectedJournalIds] = useState(new Set());
  const [selectedFirstTimeIds, setSelectedFirstTimeIds] = useState(new Set());
  const [photoOverrides, setPhotoOverrides] = useState({});
  const [photoNoteShown, setPhotoNoteShown] = useState(false);
  const [uploadingItems, setUploadingItems] = useState(new Set());
  const [pendingUploadKey, setPendingUploadKey] = useState(null);
  const [entryNotes, setEntryNotes] = useState({});
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [generatedChapter, setGeneratedChapter] = useState(editMode ? initialChapter : null);

  const fileInputRef = useRef(null);
  const cancelCropRef = useRef(null);
  const isPaid = tier !== 'free';
  const hasCredits = credits === null || credits > 0;
  const MAX_ITEMS = 20;
  const totalSelected = selectedJournalIds.size + selectedFirstTimeIds.size;
  const atLimit = totalSelected >= MAX_ITEMS;

  useEffect(() => () => { cancelCropRef.current?.() }, []);

  const usedPeriodKeys = new Set(
    chapters.filter(c => c.anchorType === 'period').map(c => c.anchorKey)
  );

  const periodJournal = selectedPeriod
    ? [...journalEntries]
        .filter(e => e.week >= selectedPeriod.startWeeks && e.week <= selectedPeriod.endWeeks)
        .sort((a, b) => (a.week - b.week))
    : [];

  const periodFirsts = selectedPeriod
    ? [...firsts].filter(ft => {
        const w = weeksFromBirthdate(ft.occurredDate, birthdate);
        return w >= selectedPeriod.startWeeks && w <= selectedPeriod.endWeeks;
      })
    : [];

  const hasItems = periodJournal.length > 0 || periodFirsts.length > 0;
  const noneSelected = selectedJournalIds.size === 0 && selectedFirstTimeIds.size === 0;

  // ── Step 1: Period selection ───────────────────────────────────────────────

  function handlePeriodSelect(period) {
    setSelectedPeriod(period);
    const journalInPeriod = journalEntries
      .filter(e => e.week >= period.startWeeks && e.week <= period.endWeeks)
      .sort((a, b) => a.week - b.week);
    const firstsInPeriod = firsts.filter(ft => {
      const w = weeksFromBirthdate(ft.occurredDate, birthdate);
      return w >= period.startWeeks && w <= period.endWeeks;
    });

    const autoJournal = journalInPeriod.slice(0, MAX_ITEMS);
    const remaining = MAX_ITEMS - autoJournal.length;
    const autoFirsts = firstsInPeriod.slice(0, remaining);

    setSelectedJournalIds(new Set(autoJournal.map(e => e.id)));
    setSelectedFirstTimeIds(new Set(autoFirsts.map(ft => ft.id)));
    setStep(2);
  }

  // ── Step 2: Photo upload + per-entry notes ─────────────────────────────────

  function toggleEntryNote(key) {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleCropAndUpload(file, key) {
    setUploadingItems(prev => new Set([...prev, key]));
    cancelCropRef.current = openCropModal(
      file,
      async ({ blob }) => {
        cancelCropRef.current = null;
        try {
          const url = await uploadCroppedPhoto(onUpload, blob);
          setPhotoOverrides(prev => ({ ...prev, [key]: url }));
          setPhotoNoteShown(true);
        } catch {
          onError('Failed to upload photo');
        }
        setUploadingItems(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      },
      () => {
        cancelCropRef.current = null;
        setUploadingItems(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    );
  }

  async function handlePhotoClick(itemKey) {
    const nativeFile = await pickPhoto();
    if (nativeFile) {
      await handleCropAndUpload(nativeFile, itemKey);
      return;
    }
    setPendingUploadKey(itemKey);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file || !pendingUploadKey) return;
    e.target.value = '';
    const key = pendingUploadKey;
    setPendingUploadKey(null);
    await handleCropAndUpload(file, key);
  }

  // ── Generate-first: build the chapter, generate grouped pages, save the suggested
  // layout, and return the updated chapter (with generatedContent + layoutData). ──

  function buildPayload() {
    const filteredNotes = Object.fromEntries(
      Object.entries(entryNotes).filter(([, v]) => v && v.trim())
    );
    return {
      anchorKey: selectedPeriod.key,
      anchorLabel: selectedPeriod.label,
      periodStartWeeks: selectedPeriod.startWeeks,
      periodEndWeeks: selectedPeriod.endWeeks,
      selectedJournalIds: [...selectedJournalIds],
      selectedFirstTimeIds: [...selectedFirstTimeIds],
      supplementaryNotes: null,
      photoOverrides: Object.keys(photoOverrides).length > 0 ? photoOverrides : null,
      entryNotes: Object.keys(filteredNotes).length > 0 ? filteredNotes : null,
    };
  }

  // Generate-first for both paths. `seed: true` (Quick Build) auto-arranges the
  // generated content into pages and saves it; `seed: false` (Scrapbook) leaves
  // the layout empty and just attaches the generated content for manual placing.
  async function runGenerateFirst(seed) {
    const filteredNotes = Object.fromEntries(
      Object.entries(entryNotes).filter(([, v]) => v && v.trim())
    );
    const chapter = await onWizardGenerate(buildPayload());
    const memories = buildMemoryList({
      journalIds: [...selectedJournalIds],
      firstTimeIds: [...selectedFirstTimeIds],
      journalEntries,
      firsts,
      photoOverrides,
      entryNotes: filteredNotes,
    });
    const groups = autoSuggestGroups(memories).filter(g => g.sourceKeys.length > 0);
    const generatedPagesResult = await onGeneratePages(chapter.id, groups);

    if (seed) {
      const layoutData = buildGroupedLayoutData(groups, generatedPagesResult);
      const updated = await onUpdate(chapter.id, { layoutData });
      return updated || { ...chapter, layoutData };
    }
    // Manual scrapbook: no layout yet (builder opens with one blank page). Attach
    // the freshly generated content so the memory panel can place it right away.
    const generatedContent = Object.fromEntries(
      generatedPagesResult
        .filter(p => p.sourceKey)
        .map(p => [p.sourceKey, { body: p.body, pullQuote: p.pullQuote, title: p.title, caption: p.caption }])
    );
    return { ...chapter, generatedContent };
  }

  // Both paths generate first, then open the builder — Quick Build pre-filled,
  // Scrapbook with blank pages to arrange yourself.
  async function handleStartPath(path) {
    if (!isPaid) { onError('Upgrade to Plus to generate chapters'); return; }
    if (totalSelected === 0) { onError('Select at least one memory to include'); return; }
    setGenerating(true);
    try {
      const chapter = await runGenerateFirst(path === 'quick');
      setGeneratedChapter(chapter);
      setStep(6);
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('402') || msg.includes('credit')) {
        onError('Not enough credits — 1 credit is used per page');
      } else if (msg.includes('403') || msg.includes('Upgrade')) {
        onError('Upgrade to Plus to generate chapters');
      } else {
        onError('Failed to build your book — please try again');
      }
    }
    setGenerating(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const stepTitle = {
    1: 'Choose a time period',
    2: `${selectedPeriod?.label} — Select what to include`,
    3: generating ? 'Building your book…' : 'How would you like to tell this story?',
    6: editMode ? 'Edit layout' : 'Design your pages',
  }[step] || '';

  const showBack = step >= 2 && step <= 3 && !generating;

  // Step 6 — the builder renders its own full-screen UI, so return it directly.
  if (step === 6 && generatedChapter) {
    return (
      <ScrapbookBuilder
        chapter={generatedChapter}
        journalEntries={journalEntries}
        firsts={firsts}
        theme={theme}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {editMode
                  ? 'Edit Chapter'
                  : step <= 3 ? `Create a Chapter · Step ${step} of 3`
                  : 'Create a Chapter'
                }
              </p>
              <h2 className="font-display font-semibold text-xl text-foreground">
                {stepTitle}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1 — Period selection */}
        {step === 1 && (
          <div className="space-y-3">
            {STORYBOOK_PERIODS.map(period => {
              const isUsed = usedPeriodKeys.has(period.key);
              const isFuture = period.endWeeks > (week || 0);
              const disabled = isUsed || isFuture;

              const journalCount = journalEntries.filter(
                e => e.week >= period.startWeeks && e.week <= period.endWeeks
              ).length;
              const firstsCount = firsts.filter(ft => {
                const w = weeksFromBirthdate(ft.occurredDate, birthdate);
                return w >= period.startWeeks && w <= period.endWeeks;
              }).length;

              return (
                <button
                  key={period.key}
                  onClick={() => !disabled && handlePeriodSelect(period)}
                  disabled={disabled}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    disabled
                      ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                      : 'border-border bg-color-warm/10 hover:border-color-highlight/40 hover:bg-color-warm/20 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{period.label}</span>
                    {isUsed && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                        Chapter written
                      </span>
                    )}
                    {isFuture && !isUsed && (
                      <span className="text-xs text-muted-foreground">Not yet</span>
                    )}
                  </div>
                  {!disabled && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {journalCount + firstsCount === 0
                        ? 'No entries yet — you can still add memories'
                        : [
                            journalCount > 0 && `${journalCount} journal ${journalCount === 1 ? 'entry' : 'entries'}`,
                            firstsCount > 0 && `${firstsCount} first ${firstsCount === 1 ? 'time' : 'times'}`,
                          ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2 — Source curation */}
        {step === 2 && (
          <div className="space-y-6">
            {!hasItems && (
              <div className="flex flex-col items-center py-8 text-center text-muted-foreground gap-2">
                <BookOpen className="w-10 h-10 opacity-30" />
                <p className="text-sm">No journal entries or first times for this period yet.</p>
                <p className="text-sm">You can still write a chapter — just add your memories in the next step.</p>
              </div>
            )}

            {hasItems && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {totalSelected} of {MAX_ITEMS} items selected
                </p>
                {atLimit && (
                  <p className="text-xs text-amber-700 font-medium">
                    Limit reached — deselect to swap
                  </p>
                )}
              </div>
            )}

            {periodJournal.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Journal Entries
                </h3>
                {periodJournal.map(entry => {
                  const overrideKey = `journal:${entry.id}`;
                  const photo = photoOverrides[overrideKey] || entry.image_url;
                  const uploading = uploadingItems.has(overrideKey);
                  const noteExpanded = expandedItems.has(overrideKey);
                  const hasNote = entryNotes[overrideKey] && entryNotes[overrideKey].trim();

                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-color-warm/10"
                    >
                      <Checkbox
                        checked={selectedJournalIds.has(entry.id)}
                        disabled={atLimit && !selectedJournalIds.has(entry.id)}
                        onCheckedChange={checked => {
                          setSelectedJournalIds(prev => {
                            const next = new Set(prev);
                            checked ? next.add(entry.id) : next.delete(entry.id);
                            return next;
                          });
                        }}
                        className="mt-0.5 border-color-highlight/40 data-[state=checked]:bg-color-highlight data-[state=checked]:border-color-highlight"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground leading-snug">{entry.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Week {entry.week}</p>
                        {entry.story && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.story}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <button
                            onClick={() => handlePhotoClick(overrideKey)}
                            disabled={uploading}
                            className="flex items-center gap-1 text-xs text-color-highlight hover:underline disabled:opacity-50"
                          >
                            {uploading
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                              : <><Camera className="w-3 h-3" />{photo ? 'Replace photo' : 'Add photo'}</>
                            }
                          </button>
                          <button
                            onClick={() => toggleEntryNote(overrideKey)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <PenLine className="w-3 h-3" />
                            {noteExpanded ? 'Hide note' : hasNote ? 'Edit memory' : 'Add a memory'}
                          </button>
                        </div>
                        {noteExpanded && (
                          <Textarea
                            value={entryNotes[overrideKey] || ''}
                            onChange={e => setEntryNotes(prev => ({ ...prev, [overrideKey]: e.target.value }))}
                            rows={2}
                            placeholder="How did this moment feel? What do you want to remember?"
                            className="mt-2 text-xs focus-visible:ring-color-highlight"
                          />
                        )}
                      </div>
                      {photo && (
                        <img
                          src={photo}
                          alt={entry.title}
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {periodFirsts.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  First Times
                </h3>
                {periodFirsts.map(ft => {
                  const overrideKey = `first_time:${ft.id}`;
                  const photo = photoOverrides[overrideKey] || ft.imageUrl;
                  const uploading = uploadingItems.has(overrideKey);
                  const noteExpanded = expandedItems.has(overrideKey);
                  const hasNote = entryNotes[overrideKey] && entryNotes[overrideKey].trim();

                  return (
                    <div
                      key={ft.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-color-warm/10"
                    >
                      <Checkbox
                        checked={selectedFirstTimeIds.has(ft.id)}
                        disabled={atLimit && !selectedFirstTimeIds.has(ft.id)}
                        onCheckedChange={checked => {
                          setSelectedFirstTimeIds(prev => {
                            const next = new Set(prev);
                            checked ? next.add(ft.id) : next.delete(ft.id);
                            return next;
                          });
                        }}
                        className="mt-0.5 border-color-highlight/40 data-[state=checked]:bg-color-highlight data-[state=checked]:border-color-highlight"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground leading-snug">{ft.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ft.occurredDate)}</p>
                        {ft.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ft.notes}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <button
                            onClick={() => handlePhotoClick(overrideKey)}
                            disabled={uploading}
                            className="flex items-center gap-1 text-xs text-color-highlight hover:underline disabled:opacity-50"
                          >
                            {uploading
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                              : <><Camera className="w-3 h-3" />{photo ? 'Replace photo' : 'Add photo'}</>
                            }
                          </button>
                          <button
                            onClick={() => toggleEntryNote(overrideKey)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <PenLine className="w-3 h-3" />
                            {noteExpanded ? 'Hide note' : hasNote ? 'Edit memory' : 'Add a memory'}
                          </button>
                        </div>
                        {noteExpanded && (
                          <Textarea
                            value={entryNotes[overrideKey] || ''}
                            onChange={e => setEntryNotes(prev => ({ ...prev, [overrideKey]: e.target.value }))}
                            rows={2}
                            placeholder="How did this moment feel? What do you want to remember?"
                            className="mt-2 text-xs focus-visible:ring-color-highlight"
                          />
                        )}
                      </div>
                      {photo && (
                        <img
                          src={photo}
                          alt={ft.label}
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {photoNoteShown && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                This photo will only appear in your storybook chapter. Your original entry hasn't been changed.
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setStep(3)}
                disabled={hasItems && noneSelected}
                className="flex-1 bg-color-highlight hover:bg-color-highlight/90"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Path picker */}
        {step === 3 && generating && (
          <div className="flex flex-col items-center py-8 gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-color-highlight" />
            <p className="text-sm font-medium">Building your book…</p>
            <p className="text-xs">Arranging your memories and writing each page</p>
          </div>
        )}

        {step === 3 && !generating && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Either way, we write the text for your memories first. Uses 1 credit per page
              ({totalSelected} credit{totalSelected !== 1 ? 's' : ''}).
            </p>

            {!isPaid && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Upgrade to Plus to generate chapters.
              </p>
            )}
            {isPaid && !hasCredits && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No AI credits remaining this month.
              </p>
            )}

            <button
              onClick={() => handleStartPath('scrapbook')}
              disabled={!isPaid || !hasCredits || totalSelected === 0}
              className="w-full flex items-start gap-4 p-4 rounded-xl border border-border bg-color-warm/10 hover:border-color-highlight/40 hover:bg-color-warm/20 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Layers className="w-6 h-6 text-color-highlight/70 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Scrapbook</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Build it yourself. We open the builder with blank pages and all your memories on
                  hand — add pages, pick layouts, and place each memory and photo where you want.
                </p>
              </div>
            </button>

            <button
              onClick={() => handleStartPath('quick')}
              disabled={!isPaid || !hasCredits || totalSelected === 0}
              className="w-full flex items-start gap-4 p-4 rounded-xl border border-border bg-color-warm/10 hover:border-color-highlight/40 hover:bg-color-warm/20 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-6 h-6 text-color-highlight/70 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Quick Build</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  We arrange everything into pages for you. The builder opens pre-filled — tweak
                  anything, then publish.
                </p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
