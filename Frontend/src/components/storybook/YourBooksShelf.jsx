import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MoreHorizontal, Plus, BookOpen, Check, X, Pencil, Copy, Trash2 } from "lucide-react";
import { getTheme } from "@/lib/bookThemes";

// The "Your Books" shelf (sv2-s7a): cover-thumb cards + per-book ⋯ menu + a new-book tile.
export default function YourBooksShelf({
  books, activeBookId, progress, onSelect, onRename, onDuplicate, onDelete, onNewBook, onClose,
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Back">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-display font-semibold text-xl text-foreground">Your Books</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {books.map(book => (
          <BookShelfCard
            key={book.id}
            book={book}
            active={book.id === activeBookId}
            progress={progress?.[book.id]}
            onSelect={onSelect}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        ))}

        <button
          onClick={onNewBook}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-color-highlight/50 hover:bg-color-warm/10 transition-all min-h-[180px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-7 h-7" />
          <span className="text-sm font-medium">Start a new book</span>
        </button>
      </div>
    </div>
  );
}

function BookShelfCard({ book, active, progress, onSelect, onRename, onDuplicate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(book.title || '');

  const theme = getTheme(book.theme);
  const typeLabel = book.type === 'guided' ? 'Guided' : 'Freeform';

  function startRename() {
    setDraft(book.title || '');
    setRenaming(true);
    setMenuOpen(false);
  }
  function saveRename() {
    const t = draft.trim();
    setRenaming(false);
    if (t && t !== book.title) onRename(book.id, t);
  }
  function handleDelete() {
    setMenuOpen(false);
    if (window.confirm(`Delete "${book.title || 'this book'}"? This removes the book and all its pages.`)) {
      onDelete(book.id);
    }
  }

  return (
    <div className={`relative rounded-xl border overflow-hidden bg-card transition-all ${active ? 'border-color-highlight ring-1 ring-color-highlight/40' : 'border-border hover:border-color-highlight/30'}`}>
      {/* Cover thumb (also the open affordance) */}
      <button onClick={() => onSelect(book.id)} className="block w-full text-left" title="Open book">
        <div className="w-full aspect-[4/3] overflow-hidden" style={{ backgroundColor: theme?.bg || '#fdf9f2' }}>
          {book.coverPhotoUrl ? (
            <img src={book.coverPhotoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: (theme?.accent || '#c9a96e') + '22' }}>
              <BookOpen className="w-8 h-8 opacity-25" style={{ color: theme?.accent }} />
            </div>
          )}
        </div>
      </button>

      <div className="p-3">
        {renaming ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(false); }}
              className="flex-1 min-w-0 text-sm border-b border-input bg-transparent focus:outline-none focus:border-ring px-0.5 py-0.5"
            />
            <button onClick={saveRename} className="p-0.5 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
            <button onClick={() => setRenaming(false)} className="p-0.5 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => onSelect(book.id)} className="block w-full text-left">
            <p className="font-medium text-sm text-foreground leading-snug truncate">{book.title || 'Untitled book'}</p>
          </button>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{typeLabel}</span>
          <span className="text-[10px] text-muted-foreground capitalize">{book.theme || 'classic'}</span>
        </div>

        {/* Guided fill progress (sv2-s7b) */}
        {book.type === 'guided' && progress && progress.total > 0 && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-color-highlight transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{progress.done} / {progress.total} pages</p>
          </div>
        )}
      </div>

      {/* ⋯ menu */}
      <div className="absolute top-2 right-2">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="p-1 rounded-full bg-white/80 hover:bg-white text-foreground shadow-sm"
          title="More"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-1 z-20 w-40 rounded-lg border border-border bg-popover shadow-lg py-1 text-sm">
              <MenuItem icon={Pencil} label="Rename" onClick={startRename} />
              <MenuItem icon={Copy} label="Duplicate" onClick={() => { setMenuOpen(false); onDuplicate(book.id); }} />
              <MenuItem icon={Trash2} label="Delete" danger onClick={handleDelete} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-1.5 hover:bg-muted text-left ${danger ? 'text-red-600 hover:text-red-700' : 'text-foreground'}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
