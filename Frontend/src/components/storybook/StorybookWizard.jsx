import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, X, ChevronLeft, Camera, BookOpen, PenLine } from "lucide-react";
import { STORYBOOK_PERIODS } from "@/lib/storybookPeriods";
import { openCropModal } from "@/lib/imageUtils";
import { pickPhoto } from "@/lib/camera";
import BookChapterReview from "@/components/storybook/BookChapterReview";
import LayoutEditor from "@/components/storybook/LayoutEditor";

function weeksFromBirthdate(dateStr, birthdate) {
  if (!birthdate || !dateStr) return -1;
  return Math.floor((new Date(dateStr) - new Date(birthdate)) / (7 * 24 * 3600 * 1000));
}

function fmtDate(raw) {
  if (!raw) return '';
  const d = new Date(raw + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StorybookWizard({
  journalEntries,
  firsts,
  birthdate,
  chapters,
  week,
  tier,
  credits,
  onWizardGenerate,
  onGenerate,
  onUpdate,
  onUpload,
  onClose,
  onError,
}) {
  const [step, setStep] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedJournalIds, setSelectedJournalIds] = useState(new Set());
  const [selectedFirstTimeIds, setSelectedFirstTimeIds] = useState(new Set());
  const [photoOverrides, setPhotoOverrides] = useState({});
  const [photoNoteShown, setPhotoNoteShown] = useState(false);
  const [uploadingItems, setUploadingItems] = useState(new Set());
  const [pendingUploadKey, setPendingUploadKey] = useState(null);
  const [entryNotes, setEntryNotes] = useState({});
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [supplementaryNotes, setSupplementaryNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedChapter, setGeneratedChapter] = useState(null);

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

  // Items within the selected period
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
  const canGenerate = hasItems ? !noneSelected : true;

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

    // Auto-select up to MAX_ITEMS, prioritising journal entries then firsts
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
        const croppedFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        try {
          const form = new FormData();
          form.append('file', croppedFile, croppedFile.name);
          const result = await onUpload(form);
          setPhotoOverrides(prev => ({ ...prev, [key]: result.url }));
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

  // ── Step 3: Generate ───────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!isPaid) { onError('Upgrade to Plus to generate chapters'); return; }
    if (!hasCredits) { onError('No AI credits remaining this month'); return; }

    setGenerating(true);
    try {
      const filteredNotes = Object.fromEntries(
        Object.entries(entryNotes).filter(([, v]) => v && v.trim())
      );
      const payload = {
        anchorKey: selectedPeriod.key,
        anchorLabel: selectedPeriod.label,
        periodStartWeeks: selectedPeriod.startWeeks,
        periodEndWeeks: selectedPeriod.endWeeks,
        selectedJournalIds: [...selectedJournalIds],
        selectedFirstTimeIds: [...selectedFirstTimeIds],
        supplementaryNotes: supplementaryNotes.trim() || null,
        photoOverrides: Object.keys(photoOverrides).length > 0 ? photoOverrides : null,
        entryNotes: Object.keys(filteredNotes).length > 0 ? filteredNotes : null,
      };
      const chapter = await onWizardGenerate(payload);
      setGeneratedChapter(chapter);
      setStep(4);
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('402') || msg.includes('credit')) {
        onError('No AI credits remaining this month');
      } else if (msg.includes('403') || msg.includes('Upgrade')) {
        onError('Upgrade to Plus to generate chapters');
      } else {
        onError('Failed to generate chapter — please try again');
      }
    }
    setGenerating(false);
  }

  // ── Step 4: Publish / Regenerate ──────────────────────────────────────────

  async function handlePublish(chapterId, editedBody) {
    const patch = editedBody !== undefined
      ? { body: editedBody, status: 'published', clearLayoutData: true }
      : { status: 'published', clearLayoutData: true };
    await onUpdate(chapterId, patch);
    onClose();
  }

  async function handleRegenerate(chapterId) {
    const chapter = await onGenerate(chapterId);
    setGeneratedChapter(chapter);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Hidden file input shared across all photo upload buttons */}
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
            {step > 1 && step < 4 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Create a Chapter · Step {step} of {step >= 4 ? 5 : 3}
              </p>
              <h2 className="font-display font-semibold text-xl text-foreground">
                {step === 1 && 'Choose a time period'}
                {step === 2 && `${selectedPeriod?.label} — Select what to include`}
                {step === 3 && 'Add your memories'}
                {step === 4 && 'Your chapter'}
                {step === 5 && 'Design your page'}
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

        {/* Step 3 — Memories + Generate */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Anything else to include? <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                value={supplementaryNotes}
                onChange={e => setSupplementaryNotes(e.target.value)}
                rows={5}
                placeholder="Is there anything else you'd like to include in your baby's memory book for this time? A feeling, a moment, something you want to remember…"
                className="focus-visible:ring-color-highlight"
              />
            </div>

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

            {generating ? (
              <div className="flex flex-col items-center py-8 gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-color-highlight" />
                <p className="text-sm font-medium">Writing your chapter…</p>
                <p className="text-xs">This usually takes 10–20 seconds</p>
              </div>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!isPaid || !hasCredits || (hasItems && noneSelected)}
                className="w-full bg-color-highlight hover:bg-color-highlight/90"
              >
                Generate Chapter
              </Button>
            )}
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && generatedChapter && (
          <BookChapterReview
            chapter={generatedChapter}
            journalEntries={journalEntries}
            firsts={firsts}
            onPublish={handlePublish}
            onRegenerate={handleRegenerate}
            onDesign={() => setStep(5)}
            onClose={onClose}
            onError={onError}
          />
        )}

        {/* Step 5 — Layout editor */}
        {step === 5 && generatedChapter && (
          <LayoutEditor
            chapter={generatedChapter}
            journalEntries={journalEntries}
            firsts={firsts}
            onSave={async (layoutData) => {
              await onUpdate(generatedChapter.id, { layoutData });
              setGeneratedChapter(prev => ({ ...prev, layoutData }));
            }}
            onPublish={async () => {
              await onUpdate(generatedChapter.id, { status: 'published' });
              onClose();
            }}
            onBack={() => setStep(4)}
          />
        )}
      </div>
    </div>
  );
}
