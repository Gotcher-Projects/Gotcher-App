import React from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, Check } from "lucide-react";
import { arcEntryById } from "@/lib/guidedBookArc";
import { guidedProgress, groupGuidedSections, chapterStatus, chapterKind } from "@/lib/guidedBook";

// The guided book view (sv2-s7b): replaces the freeform chapter list for type='guided' books with a
// progress header + the locked, sectioned page sequence. Tapping a fill/auto/prefill page opens the
// builder; a pick page opens the First picker. Pages are pre-set — no add / remove / reorder.

const KIND_BADGE = {
  auto:    { label: "auto", cls: "bg-amber-100 text-amber-700" },
  prefill: { label: "auto", cls: "bg-amber-100 text-amber-700" },
  fill:    { label: "fill", cls: "bg-color-highlight/15 text-color-highlight" },
  pick:    { label: "pick", cls: "bg-indigo-100 text-indigo-600" },
};

function KindBadge({ kind }) {
  const b = KIND_BADGE[kind] || KIND_BADGE.fill;
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${b.cls}`}>
      {b.label}
    </span>
  );
}

// Tri-state status pill (sv2-s7.5c): a partial page reads "In progress" (amber), a done page reads
// ✓ Done — or ✓ Filled for the auto/prefill pages that fill from data. Empty pages show no pill
// (their Add / Choose button carries the state instead).
function StatusPill({ status, kind }) {
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
      <Check className="w-3.5 h-3.5" /> {kind === "auto" || kind === "prefill" ? "Filled" : "Done"}
    </span>
  );
}

function PageRow({ chapter, onOpenBuilder, onPick, firstsAvailable }) {
  const entry = arcEntryById(chapter.anchorKey);
  const kind = chapterKind(chapter);
  const label = entry?.label || chapter.anchorLabel;
  const prompt = entry?.prompt || "";
  const status = chapterStatus(chapter); // 'empty' | 'partial' | 'done'
  const done = status === "done";

  // Right-side status / action by kind + tri-state.
  let action;
  if (kind === "pick") {
    if (status === "empty") {
      action = firstsAvailable ? (
        <Button size="sm" className="h-8 bg-indigo-500 hover:bg-indigo-500/90 text-white" onClick={(e) => { e.stopPropagation(); onPick(chapter); }}>
          Choose
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Add by hand</span>
      );
    } else {
      // A First is chosen — surface its status and keep "Change" to re-pick.
      action = (
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={status} kind={kind} />
          <button onClick={(e) => { e.stopPropagation(); onPick(chapter); }} className="text-xs font-semibold text-indigo-600 hover:underline">
            Change
          </button>
        </div>
      );
    }
  } else if (status === "empty") {
    action = (
      <Button size="sm" className="h-8 bg-color-highlight hover:bg-color-highlight/90" onClick={(e) => { e.stopPropagation(); onOpenBuilder(chapter); }}>
        Add
      </Button>
    );
  } else {
    action = <StatusPill status={status} kind={kind} />;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenBuilder(chapter)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpenBuilder(chapter); }}
      className={`flex items-center gap-3 p-3.5 rounded-xl border bg-card hover:border-color-highlight/40 transition-colors cursor-pointer ${done ? "border-border" : "border-color-highlight/30"}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{label}</p>
        {prompt && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{prompt}</p>}
      </div>
      <KindBadge kind={kind} />
      <div className="flex-shrink-0 min-w-[72px] text-right" onClick={(e) => e.stopPropagation()}>
        {action}
      </div>
    </div>
  );
}

export default function GuidedBookView({
  title, chapters, firsts, onOpenBuilder, onPick,
}) {
  const { done, partial, total, autoFilled } = guidedProgress(chapters);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const sections = groupGuidedSections(chapters);
  const firstsAvailable = (firsts?.length || 0) > 0;

  // "Continue" jumps to the first page still needing input (fill/pick, not yet done).
  const nextChapter = chapters.find((c) => {
    const k = chapterKind(c);
    return (k === "fill" || k === "pick") && chapterStatus(c) !== "done";
  });

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="rounded-2xl border border-border p-5 bg-gradient-to-b from-card to-color-warm/5">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-7 h-7 text-color-highlight/70 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground leading-tight truncate">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">A guided fill-in book — pages are pre-set, you fill them in</p>
          </div>
          {nextChapter && (
            <Button size="sm" className="ml-auto flex-shrink-0 bg-color-highlight hover:bg-color-highlight/90" onClick={() => onOpenBuilder(nextChapter)}>
              Continue
            </Button>
          )}
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-color-highlight transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2.5">
          <b className="text-foreground">{done}</b> of {total} pages ready
          {partial > 0 && <> · <b className="text-amber-600">{partial}</b> in progress</>}
          {autoFilled > 0 && <> · <b className="text-foreground">{autoFilled}</b> filled automatically from your data</>}
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground px-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> auto — fills from your data</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-color-highlight" /> fill — you add photos / words</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400" /> pick — you choose which First</span>
      </div>

      {/* Sections */}
      {sections.map((sec, i) => (
        <div key={sec.dividerChapter?.id ?? `sec-${i}`} className="space-y-2.5">
          {sec.section && (
            <div className="flex items-center gap-3 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{sec.section}</span>
              <span className="flex-1 h-px bg-border" />
            </div>
          )}
          {sec.rows.map((chapter) => (
            <PageRow
              key={chapter.id}
              chapter={chapter}
              firstsAvailable={firstsAvailable}
              onOpenBuilder={onOpenBuilder}
              onPick={onPick}
            />
          ))}
        </div>
      ))}

      <p className="text-xs text-muted-foreground pt-2 text-center">🔒 Pages are pre-set — fill them in any order.</p>
    </div>
  );
}
