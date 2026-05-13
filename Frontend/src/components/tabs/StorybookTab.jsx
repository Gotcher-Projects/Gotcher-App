import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Lock, BookOpen, Wand2 } from "lucide-react";
import { STORYBOOK_PERIODS } from "@/lib/storybookPeriods";
import StorybookWizard from "@/components/storybook/StorybookWizard";
import LayoutRenderer from "@/components/storybook/LayoutRenderer";
import { ChapterPhoto, renderPublishedBody, renderDraftBody } from "@/components/storybook/LegacyChapterRenderer";

// Event-only period options kept for the "By Milestone" flow
const EVENT_ANCHOR_MODES = [{ value: 'event', label: 'By Milestone' }];

export default function StorybookTab({
  chapters, tier, week, initialCredits,
  availableEventAnchors,
  journalEntries, firsts, birthdate,
  onGenerate, onUpdate, onDelete, onUnlockChapter,
  onWizardGenerate, onUpload,
  onNavigate, onError,
}) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [credits, setCredits] = useState(initialCredits ?? null);
  const [selectedValue, setSelectedValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const isPaid = tier !== 'free';
  const eventAnchors = availableEventAnchors ?? [];

  async function handleAddEventChapter() {
    if (!selectedValue) return;
    setAdding(true);
    try {
      const [type, ...keyParts] = selectedValue.split(':');
      const anchorKey = keyParts.join(':');
      const anchor = eventAnchors.find(a => a.anchorType === type && a.anchorKey === anchorKey);
      if (!anchor) return;
      await onUnlockChapter({
        anchorType: anchor.anchorType,
        anchorKey: anchor.anchorKey,
        anchorLabel: anchor.anchorLabel,
        imageUrl: anchor.imageUrl ?? null,
      });
      setSelectedValue('');
    } catch {
      onError('Failed to add chapter');
    }
    setAdding(false);
  }

  async function handleGenerate(id) {
    const chapter = await onGenerate(id);
    setCredits(c => c === null ? null : Math.max(0, c - 1));
    return chapter;
  }

  async function handleWizardGenerate(payload) {
    const chapter = await onWizardGenerate(payload);
    setCredits(c => c === null ? null : Math.max(0, c - 1));
    return chapter;
  }

  const sorted = [...chapters].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (showWizard) {
    return (
      <StorybookWizard
        journalEntries={journalEntries ?? []}
        firsts={firsts ?? []}
        birthdate={birthdate}
        chapters={chapters}
        week={week}
        tier={tier}
        credits={credits}
        onWizardGenerate={handleWizardGenerate}
        onGenerate={handleGenerate}
        onUpdate={onUpdate}
        onUpload={onUpload}
        onClose={() => setShowWizard(false)}
        onError={onError}
      />
    );
  }

  return (
    <div className="space-y-6">
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
            Create your first chapter above, or link a milestone below.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map(chapter => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              tier={tier}
              credits={credits}
              journalEntries={journalEntries ?? []}
              firsts={firsts ?? []}
              onGenerate={handleGenerate}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onError={onError}
            />
          ))}
        </div>
      )}

      {/* Milestone event chapter — kept for linking individual milestones */}
      {eventAnchors.length > 0 && (
        <Card className="bg-color-warm/10">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Add a Milestone Chapter</h3>
            <p className="text-xs text-muted-foreground">
              Link a single milestone or first time as its own chapter.
            </p>
            <div className="flex gap-2">
              <select
                value={selectedValue}
                onChange={e => setSelectedValue(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select a milestone or first time…</option>
                {eventAnchors.map(a => (
                  <option key={`${a.anchorType}:${a.anchorKey}`} value={`${a.anchorType}:${a.anchorKey}`}>
                    {a.anchorLabel}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleAddEventChapter}
                disabled={!selectedValue || adding}
                size="sm"
                className="bg-color-highlight hover:bg-color-highlight/90"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChapterCard({ chapter, tier, credits, journalEntries, firsts, onGenerate, onUpdate, onDelete, onError }) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(chapter.body || '');
  const [saving, setSaving] = useState(false);

  const isPaid = tier !== 'free';
  const hasCredits = credits === null || credits > 0;

  React.useEffect(() => {
    if (!editing) setEditBody(chapter.body || '');
  }, [chapter.body, editing]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await onGenerate(chapter.id);
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('credit') || msg.includes('402')) {
        onError('No AI credits remaining this month');
      } else {
        onError('Failed to generate chapter — please try again');
      }
    }
    setGenerating(false);
  }

  async function handlePublish() {
    try {
      await onUpdate(chapter.id, { status: 'published' });
    } catch {
      onError('Failed to publish chapter');
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await onUpdate(chapter.id, { body: editBody });
      setEditing(false);
    } catch {
      onError('Failed to save changes');
    }
    setSaving(false);
  }

  const typeLabel =
    chapter.anchorType === 'period' ? 'Time Period' :
    chapter.anchorType === 'milestone' ? 'Milestone' : 'First Time';

  // Fallback photo list for wizard chapters whose body has no inline markers yet
  const hasPhotoMarkers = /\[PHOTO:(?:journal|first_time):\d+\]/.test(chapter.body || '');
  const wizardPhotoItems = [];
  if (!hasPhotoMarkers) {
    for (const id of chapter.selectedJournalIds || []) {
      const entry = journalEntries.find(e => e.id === id);
      if (!entry) continue;
      const photo = chapter.photoOverrides?.[`journal:${id}`] || entry.image_url;
      if (photo) wizardPhotoItems.push({ label: entry.title, imageUrl: photo, orientation: entry.image_orientation || 'landscape' });
    }
    for (const id of chapter.selectedFirstTimeIds || []) {
      const ft = firsts.find(f => f.id === id);
      if (!ft) continue;
      const photo = chapter.photoOverrides?.[`first_time:${id}`] || ft.imageUrl;
      if (photo) wizardPhotoItems.push({ label: ft.label, imageUrl: photo, orientation: ft.imageOrientation || 'landscape' });
    }
  }

  const cardHeader = (
    <div>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{typeLabel}</span>
      <h3 className="font-display font-semibold text-foreground text-lg leading-tight">{chapter.anchorLabel}</h3>
    </div>
  );

  if (generating) {
    return (
      <Card className="bg-color-warm/10 border border-color-highlight/20">
        <CardContent className="p-5 space-y-3">
          {cardHeader}
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="w-5 h-5 animate-spin text-color-highlight" />
            <span className="text-sm">Writing your story…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chapter.status === 'draft') {
    return (
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
        <CardContent className="p-5 space-y-3">
          {cardHeader}
          <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            Draft — review before publishing
          </span>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={10}
                className="font-serif leading-relaxed text-base focus-visible:ring-color-highlight"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="bg-color-highlight hover:bg-color-highlight/90">
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditBody(chapter.body || ''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : chapter.layoutData?.blocks?.length > 0 ? (
            <div className="rounded-lg overflow-hidden bg-[#fdf9f2]">
              <LayoutRenderer layout={chapter.layoutData} />
            </div>
          ) : (
            <>
              {renderDraftBody(chapter.body, chapter.photoOverrides, journalEntries, firsts)}
              {wizardPhotoItems.length > 0 && (
                <div className="mt-3 space-y-4">
                  {wizardPhotoItems.map((item, i) => (
                    <ChapterPhoto key={i} url={item.imageUrl} label={item.label} orientation={item.orientation} />
                  ))}
                </div>
              )}
            </>
          )}
          {!editing && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button size="sm" onClick={handlePublish} className="bg-color-highlight hover:bg-color-highlight/90">
                Approve &amp; Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              <Button
                size="sm" variant="outline" onClick={handleGenerate} disabled={!hasCredits}
                title={!hasCredits ? 'No credits remaining this month' : 'Regenerate with AI (costs 1 credit)'}
              >
                Regenerate
              </Button>
              {chapter.layoutData?.blocks?.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => onUpdate(chapter.id, { clearLayoutData: true })}>
                  Use classic style
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onDelete(chapter.id)} className="text-red-500 hover:text-red-600 hover:border-red-300 ml-auto">
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (chapter.status === 'published') {
    const hasLayout = chapter.layoutData?.blocks?.length > 0;
    return (
      <div className="rounded-xl shadow-sm overflow-hidden bg-[#fdf9f2] dark:bg-card border border-[#ddd0b8] dark:border-border">
        <div className={`px-8 ${hasLayout && !editing ? 'pt-10 pb-6' : 'py-10'}`}>
          <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{typeLabel}</p>
          <h2 className="text-center font-display font-semibold text-2xl text-foreground mb-3 leading-snug">{chapter.anchorLabel}</h2>
          <div className="flex items-center justify-center gap-2 mb-7">
            <div className="h-px w-14 bg-color-highlight/25" />
            <span className="text-color-highlight/50 text-xs">◆</span>
            <div className="h-px w-14 bg-color-highlight/25" />
          </div>
          {chapter.imageUrl && !editing && !hasLayout && (
            <div className="mb-7">
              <img
                src={chapter.imageUrl}
                alt={chapter.anchorLabel}
                className="w-full rounded-lg shadow-sm object-cover max-h-72"
              />
            </div>
          )}
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={10}
                className="font-serif leading-relaxed text-base focus-visible:ring-color-highlight"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="bg-color-highlight hover:bg-color-highlight/90">
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditBody(chapter.body || ''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : !hasLayout && (
            <div>
              {renderPublishedBody(chapter.body, chapter.photoOverrides, journalEntries, firsts)}
            </div>
          )}
          {!hasLayout && chapter.publishedAt && !editing && (
            <p className="text-center text-xs text-muted-foreground mt-8">
              {new Date(chapter.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        {!editing && hasLayout && (
          <LayoutRenderer layout={chapter.layoutData} />
        )}
        {!editing && hasLayout && chapter.publishedAt && (
          <p className="text-center text-xs text-muted-foreground px-8 py-4">
            {new Date(chapter.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        {!editing && (
          <div className="px-6 py-3 border-t border-[#ddd0b8] dark:border-border flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            {hasLayout && (
              <Button size="sm" variant="outline" onClick={() => onUpdate(chapter.id, { clearLayoutData: true })}>
                Use classic style
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onDelete(chapter.id)} className="text-red-500 hover:text-red-600 hover:border-red-300">Delete</Button>
          </div>
        )}
      </div>
    );
  }

  // unlocked state
  return (
    <Card className="bg-color-warm/10 border border-border">
      <CardContent className="p-5 space-y-3">
        {cardHeader}
        {isPaid && !hasCredits && (
          <p className="text-sm text-muted-foreground">No credits remaining this month.</p>
        )}
        {isPaid && hasCredits && (
          <p className="text-sm text-muted-foreground">Tap to write the story of this moment.</p>
        )}
        <div className="flex gap-2">
          {isPaid ? (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!hasCredits}
              className={hasCredits ? 'bg-color-highlight hover:bg-color-highlight/90' : ''}
            >
              Generate Chapter
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upgrade to Plus to generate</span>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => onDelete(chapter.id)} className="text-red-500 hover:text-red-600 hover:border-red-300 ml-auto">
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

