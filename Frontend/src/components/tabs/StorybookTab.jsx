import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Lock, BookOpen } from "lucide-react";

const PERIOD_OPTIONS = [
  { key: '0-4w',    label: 'Your First Month',        startWeeks: 0,  endWeeks: 4   },
  { key: '0-8w',    label: 'Your First Two Months',   startWeeks: 0,  endWeeks: 8   },
  { key: '0-13w',   label: 'Your First Three Months', startWeeks: 0,  endWeeks: 13  },
  { key: '0-26w',   label: 'Your First Six Months',   startWeeks: 0,  endWeeks: 26  },
  { key: '0-52w',   label: 'Your First Year',         startWeeks: 0,  endWeeks: 52  },
  { key: '13-26w',  label: 'Months 3–6',              startWeeks: 13, endWeeks: 26  },
  { key: '26-52w',  label: 'Months 6–12',             startWeeks: 26, endWeeks: 52  },
  { key: '52-104w', label: 'Year 1–2',                startWeeks: 52, endWeeks: 104 },
];

export default function StorybookTab({
  chapters, tier, week, initialCredits,
  availableEventAnchors,
  onGenerate, onUpdate, onDelete, onUnlockChapter,
  onNavigate, onError,
}) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [credits, setCredits] = useState(initialCredits ?? null);
  const [chapterMode, setChapterMode] = useState('event');
  const [selectedValue, setSelectedValue] = useState('');
  const [adding, setAdding] = useState(false);

  const isPaid = tier !== 'free';
  const usedPeriodKeys = new Set(chapters.filter(c => c.anchorType === 'period').map(c => c.anchorKey));
  const availablePeriods = PERIOD_OPTIONS.filter(p => p.endWeeks <= (week || 0) && !usedPeriodKeys.has(p.key));

  const eventAnchors = availableEventAnchors ?? [];

  async function handleAddChapter() {
    if (!selectedValue) return;
    setAdding(true);
    try {
      if (chapterMode === 'event') {
        const [type, ...keyParts] = selectedValue.split(':');
        const anchorKey = keyParts.join(':');
        const anchor = eventAnchors.find(a => a.anchorType === type && a.anchorKey === anchorKey);
        if (!anchor) return;
        await onUnlockChapter({ anchorType: anchor.anchorType, anchorKey: anchor.anchorKey, anchorLabel: anchor.anchorLabel, imageUrl: anchor.imageUrl ?? null });
      } else {
        const opt = PERIOD_OPTIONS.find(p => p.key === selectedValue);
        if (!opt) return;
        await onUnlockChapter({
          anchorType: 'period',
          anchorKey: opt.key,
          anchorLabel: opt.label,
          periodStartWeeks: opt.startWeeks,
          periodEndWeeks: opt.endWeeks,
        });
      }
      setSelectedValue('');
    } catch {
      onError('Failed to add chapter');
    }
    setAdding(false);
  }

  const sorted = [...chapters].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

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

      {chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="w-16 h-16 text-primary/30 mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">Your story starts here</p>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
            Each milestone and first time becomes a chapter in your baby's memory book.
          </p>
          <div className="flex gap-3 mt-4">
            <Button size="sm" variant="outline" onClick={() => onNavigate('firsts')}>Go to Firsts →</Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('health-milestones')}>Go to Milestones →</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map(chapter => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              tier={tier}
              credits={credits}
              onGenerate={async (id) => {
                await onGenerate(id);
                setCredits(c => c === null ? null : Math.max(0, c - 1));
              }}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onError={onError}
            />
          ))}
        </div>
      )}

      <Card className="bg-color-warm/10">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold text-foreground">Add a Chapter</h3>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {[
              { value: 'event',  label: 'By Milestone' },
              { value: 'period', label: 'By Time Period' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setChapterMode(opt.value); setSelectedValue(''); }}
                className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                  chapterMode === opt.value
                    ? 'bg-color-highlight/10 border-color-highlight/30 text-color-highlight'
                    : 'border-border text-muted-foreground hover:bg-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {chapterMode === 'period' && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <strong>Tip:</strong> Chapters work best when you have journal entries, milestones, or first times
              logged for that period. Sparse data may result in a shorter chapter.
            </div>
          )}

          {chapterMode === 'event' && eventAnchors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No milestones or first times available yet — log some in the Health and Memories tabs first.
            </p>
          ) : chapterMode === 'period' && availablePeriods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No time periods available yet — check back as your baby grows.
            </p>
          ) : (
            <div className="flex gap-2">
              <select
                value={selectedValue}
                onChange={e => setSelectedValue(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {chapterMode === 'event' ? (
                  <>
                    <option value="">Select a milestone or first time…</option>
                    {eventAnchors.map(a => (
                      <option key={`${a.anchorType}:${a.anchorKey}`} value={`${a.anchorType}:${a.anchorKey}`}>
                        {a.anchorLabel}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="">Select a time period…</option>
                    {availablePeriods.map(p => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </>
                )}
              </select>
              <Button
                onClick={handleAddChapter}
                disabled={!selectedValue || adding}
                size="sm"
                className="bg-color-highlight hover:bg-color-highlight/90"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Chapter'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChapterCard({ chapter, tier, credits, onGenerate, onUpdate, onDelete, onError }) {
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
          ) : (
            <p className="text-base leading-relaxed whitespace-pre-wrap">{chapter.body}</p>
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
    return (
      <div className="rounded-xl shadow-sm overflow-hidden bg-[#fdf9f2] dark:bg-card border border-[#ddd0b8] dark:border-border">
        <div className="px-8 py-10">
          <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{typeLabel}</p>
          <h2 className="text-center font-display font-semibold text-2xl text-foreground mb-3 leading-snug">{chapter.anchorLabel}</h2>
          <div className="flex items-center justify-center gap-2 mb-7">
            <div className="h-px w-14 bg-color-highlight/25" />
            <span className="text-color-highlight/50 text-xs">◆</span>
            <div className="h-px w-14 bg-color-highlight/25" />
          </div>
          {chapter.imageUrl && !editing && (
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
          ) : (
            <div>
              {chapter.body?.split('\n\n').map((para, i) => (
                <p key={i} className={`font-serif text-[15px] leading-8 text-foreground/85 ${i === 0 ? 'book-chapter-first' : 'mt-4'}`}>
                  {para.trim()}
                </p>
              ))}
            </div>
          )}
          {chapter.publishedAt && !editing && (
            <p className="text-center text-xs text-muted-foreground mt-8">
              {new Date(chapter.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        {!editing && (
          <div className="px-6 py-3 border-t border-[#ddd0b8] dark:border-border flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
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
