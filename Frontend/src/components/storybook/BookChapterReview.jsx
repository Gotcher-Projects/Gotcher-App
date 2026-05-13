import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export default function BookChapterReview({
  chapter,
  journalEntries,
  firsts,
  onPublish,
  onRegenerate,
  onDesign,
  onClose,
  onError,
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(chapter.body || '');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Build ordered photo list from selected entries + overrides
  const photoItems = [];
  for (const id of chapter.selectedJournalIds || []) {
    const entry = journalEntries.find(e => e.id === id);
    if (!entry) continue;
    const overrideKey = `journal:${id}`;
    const photo = chapter.photoOverrides?.[overrideKey] || entry.image_url;
    if (photo) photoItems.push({ label: entry.title, imageUrl: photo });
  }
  for (const id of chapter.selectedFirstTimeIds || []) {
    const ft = firsts.find(f => f.id === id);
    if (!ft) continue;
    const overrideKey = `first_time:${id}`;
    const photo = chapter.photoOverrides?.[overrideKey] || ft.imageUrl;
    if (photo) photoItems.push({ label: ft.label, imageUrl: photo });
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await onPublish(chapter.id);
    } catch {
      onError('Failed to publish chapter');
    }
    setPublishing(false);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate(chapter.id);
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('402') || msg.includes('credit')) {
        onError('No AI credits remaining this month');
      } else {
        onError('Failed to regenerate — please try again');
      }
    }
    setRegenerating(false);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await onPublish(chapter.id, editBody);
      setEditing(false);
    } catch {
      onError('Failed to save changes');
    }
    setSaving(false);
  }

  return (
    <div className="rounded-xl overflow-hidden bg-[#fdf9f2] dark:bg-card border border-[#ddd0b8] dark:border-border shadow-sm">
      <div className="px-8 py-10">
        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          Memory Book Chapter
        </p>
        <h2 className="text-center font-display font-semibold text-2xl text-foreground mb-3 leading-snug">
          {chapter.anchorLabel}
        </h2>
        <div className="flex items-center justify-center gap-2 mb-7">
          <div className="h-px w-14 bg-color-highlight/25" />
          <span className="text-color-highlight/50 text-xs">◆</span>
          <div className="h-px w-14 bg-color-highlight/25" />
        </div>

        {editing ? (
          <div className="space-y-3">
            <Textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              rows={12}
              className="font-serif leading-relaxed text-base focus-visible:ring-color-highlight"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={saving}
                className="bg-color-highlight hover:bg-color-highlight/90"
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditing(false); setEditBody(chapter.body || ''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {chapter.body?.split('\n\n').map((para, i) => (
              <p
                key={i}
                className={`font-serif text-[15px] leading-8 text-foreground/85 ${i === 0 ? 'book-chapter-first' : 'mt-4'}`}
              >
                {para.trim()}
              </p>
            ))}
          </div>
        )}

        {!editing && photoItems.length > 0 && (
          <div className="mt-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#ddd0b8] dark:bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">From this time</span>
              <div className="flex-1 h-px bg-[#ddd0b8] dark:bg-border" />
            </div>
            {photoItems.map((item, i) => (
              <div key={i} className="space-y-1.5">
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  className="w-full rounded-lg object-cover max-h-72"
                />
                <p className="text-center text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {!editing && (
        <div className="px-6 py-3 border-t border-[#ddd0b8] dark:border-border flex flex-wrap gap-2 justify-end">
          {onDesign && (
            <Button
              size="sm"
              onClick={onDesign}
              disabled={publishing || regenerating}
              className="bg-color-highlight hover:bg-color-highlight/90"
            >
              Design Your Page →
            </Button>
          )}
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishing || regenerating}
            variant={onDesign ? 'outline' : undefined}
            className={!onDesign ? 'bg-color-highlight hover:bg-color-highlight/90' : ''}
          >
            {publishing ? 'Publishing…' : onDesign ? 'Publish without layout' : 'Approve & Publish'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            disabled={publishing || regenerating}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            disabled={publishing || regenerating}
          >
            {regenerating ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Regenerating…</> : 'Regenerate'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={publishing || regenerating}
            className="ml-2"
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
