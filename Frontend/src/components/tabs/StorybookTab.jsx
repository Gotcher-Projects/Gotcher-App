import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, PenLine } from "lucide-react";
import ScrapbookBuilder from "@/components/storybook/ScrapbookBuilder";
import LayoutRenderer from "@/components/storybook/LayoutRenderer";
import { BOOK_THEMES, getTheme } from "@/lib/bookThemes";
import { formatDate } from "@/lib/formatting";
import { buildAchievedMilestones } from "@/lib/milestonesPage";
import { apiRequest } from "@/lib/api";
import BookCover from "@/components/storybook/BookCover";
import NewBookChooser from "@/components/storybook/NewBookChooser";
import GuidedBookView from "@/components/storybook/GuidedBookView";
import FirstPicker from "@/components/storybook/FirstPicker";
import { arcFor, expandArcToChapterSeeds, arcEntryById } from "@/lib/guidedBookArc";
import { seedMomentHeroFromFirst, featuredFirstTimeIds, chapterHasContent, guidedProgress, collectUsedKeys } from "@/lib/guidedBook";
import BookSwitcher from "@/components/storybook/BookSwitcher";
import YourBooksShelf from "@/components/storybook/YourBooksShelf";
import ShareSection from "@/components/storybook/ShareSection";

// Remembers the last-opened book across sessions (single profile per session, so one key is enough).
const ACTIVE_BOOK_KEY = 'cradlehq-active-book';

export default function StorybookTab({
  week,
  journalEntries, firsts, bumpPhotos, birthdate, babyName, parentName,
  phase, dueDate,
  onUpload, onError,
}) {
  // ── Books (the container layer, sv2-s7a) ───────────────────────────────────
  const [books, setBooks] = useState([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [activeBookId, setActiveBookId] = useState(null);
  const [showChooser, setShowChooser] = useState(false);
  const [showShelf, setShowShelf] = useState(false);

  // Chapters belong to the active book.
  const [chapters, setChapters] = useState([]);

  const [builderChapter, setBuilderChapter] = useState(null);
  const [pickerChapter, setPickerChapter] = useState(null); // guided pick page awaiting a First
  const [bookProgress, setBookProgress] = useState({}); // { [bookId]: { done, total, autoFilled } } for the shelf

  // Live data for the data-driven book pages (birth_day, people, milestones). Fetched here so the
  // builder, published view, and PDF all read the current values.
  const [birthDetails, setBirthDetails] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [achievedMilestones, setAchievedMilestones] = useState([]);

  const activeBook = books.find(b => b.id === activeBookId) || null;
  const activeTheme = getTheme(activeBook?.theme || 'classic');
  const coverPhotoUrl = activeBook?.coverPhotoUrl ?? null;
  const coverSubtitle = activeBook?.coverSubtitle ?? null;

  // Load books once, then apply the 0 / 1 / 2+ landing logic.
  useEffect(() => {
    apiRequest('/books')
      .then(list => {
        const arr = list || [];
        setBooks(arr);
        setBooksLoaded(true);
        if (arr.length === 0) {
          setShowChooser(true);
        } else {
          const remembered = Number(localStorage.getItem(ACTIVE_BOOK_KEY));
          const exists = arr.some(b => b.id === remembered);
          setActiveBookId(exists ? remembered : arr[0].id);
        }
      })
      .catch(() => { setBooksLoaded(true); onError?.('Failed to load your books'); });
  }, []);

  // Persist the active book + (re)load its chapters whenever it changes.
  useEffect(() => {
    if (activeBookId == null) { setChapters([]); return; }
    localStorage.setItem(ACTIVE_BOOK_KEY, String(activeBookId));
    apiRequest(`/storybook?bookId=${activeBookId}`)
      .then(list => setChapters(list || []))
      .catch(() => setChapters([]));
  }, [activeBookId]);

  // Re-pulled whenever the builder closes too — people/birth/milestone edits made inside the builder
  // must flow into the published view + PDF (otherwise pageData stays at its mount-time snapshot).
  const loadPageData = useCallback(() => {
    apiRequest('/birth-details').then(setBirthDetails).catch(() => {});
    apiRequest('/family-members').then(list => setFamilyMembers(list || [])).catch(() => {});
    apiRequest('/milestones')
      .then(res => setAchievedMilestones(buildAchievedMilestones(res?.achieved || [])))
      .catch(() => {});
  }, []);
  useEffect(() => { loadPageData(); }, [loadPageData]);

  // Share s13c: after a share/bundle purchase, the webhook sets share_unlocked_at server-side. The
  // Stripe return is a full reload (so books reload on mount in the common case); this focus refetch
  // additionally flips activeBook.shareUnlocked when the webhook lands while the tab is backgrounded —
  // without the landing logic in the mount-only loader above.
  useEffect(() => {
    const onFocus = () => { apiRequest('/books').then(list => { if (list) setBooks(list); }).catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Shelf progress: when the shelf opens, fetch each guided book's chapters and compute its X/Y so the
  // cards show fill progress. Freeform books have no guided progress. Bounded to guided books only.
  useEffect(() => {
    if (!showShelf) return;
    const guided = books.filter(b => b.type === 'guided');
    if (guided.length === 0) { setBookProgress({}); return; }
    let cancelled = false;
    Promise.all(guided.map(b =>
      apiRequest(`/storybook?bookId=${b.id}`)
        .then(list => [b.id, guidedProgress(list || [])])
        .catch(() => [b.id, null])
    )).then(entries => {
      if (cancelled) return;
      const map = {};
      for (const [id, p] of entries) if (p) map[id] = p;
      setBookProgress(map);
    });
    return () => { cancelled = true; };
  }, [showShelf, books]);

  const pageData = { birthDetails, familyMembers, achievedMilestones, babyName, parentName, birthdate, coverPhotoUrl };

  // ── Book handlers ───────────────────────────────────────────────────────────

  async function handleCreateBook(type) {
    try {
      const body = { type };
      // A guided book materialises its locked arc now (Model A, sv2-s7b): pick the arc by pregnancy
      // data and send the expanded pages so the backend writes them in one transaction with the book.
      if (type === 'guided') {
        body.chapters = expandArcToChapterSeeds(arcFor({ phase, dueDate }));
      }
      const book = await apiRequest('/books', { method: 'POST', body: JSON.stringify(body) });
      setBooks(b => [...b, book]);
      setActiveBookId(book.id); // switching active book triggers the chapter-load effect (GET /storybook)
      setShowChooser(false);
      setShowShelf(false);
      // A freeform book gets a single flat-pages chapter seeded server-side (sv2-s8.5) — open the
      // builder straight onto it so creation drops the user into the editor (no period wizard).
      if (type === 'freeform') {
        const list = await apiRequest(`/storybook?bookId=${book.id}`);
        if (list?.[0]) setBuilderChapter(list[0]);
      }
    } catch { onError?.('Failed to create book'); }
  }

  async function handleRenameBook(id, title) {
    try {
      const updated = await apiRequest(`/books/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      setBooks(b => b.map(x => x.id === id ? updated : x));
    } catch { onError?.('Failed to rename book'); }
  }

  async function handleDuplicateBook(id) {
    try {
      const copy = await apiRequest(`/books/${id}/duplicate`, { method: 'POST' });
      setBooks(b => [...b, copy]);
    } catch { onError?.('Failed to duplicate book'); }
  }

  async function handleDeleteBook(id) {
    try {
      await apiRequest(`/books/${id}`, { method: 'DELETE' });
      setBooks(prev => {
        const remaining = prev.filter(x => x.id !== id);
        if (id === activeBookId) {
          if (remaining.length > 0) {
            setActiveBookId(remaining[0].id);
            setShowShelf(false);
          } else {
            setActiveBookId(null);
            setShowShelf(false);
            setShowChooser(true);
          }
        }
        return remaining;
      });
    } catch { onError?.('Failed to delete book'); }
  }

  function handleSelectBook(id) {
    setActiveBookId(id);
    setShowShelf(false);
  }

  async function handleThemeSelect(key) {
    if (!activeBook) return;
    const prev = activeBook.theme;
    setBooks(b => b.map(x => x.id === activeBookId ? { ...x, theme: key } : x));
    try {
      await apiRequest(`/books/${activeBookId}`, { method: 'PATCH', body: JSON.stringify({ theme: key }) });
    } catch {
      setBooks(b => b.map(x => x.id === activeBookId ? { ...x, theme: prev } : x));
      onError?.('Failed to save theme');
    }
  }

  // Cover photo / subtitle persistence lives in BookCover; reflect the result in local book state.
  function applyCoverPatch(patch) {
    setBooks(b => b.map(x => x.id === activeBookId ? { ...x, ...patch } : x));
  }

  // ── Chapter handlers (book-scoped) ────────────────────────────────────────────

  async function updateChapter(id, patch) {
    const chapter = await apiRequest(`/storybook/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setChapters(c => c.map(ch => ch.id === id ? chapter : ch));
    return chapter;
  }

  // Guided pick flow: choosing a First seeds the page's moment_hero, then opens the builder to refine.
  // If the page already has content, confirm before overwriting (re-pick).
  async function handleChooseFirst(first) {
    const chapter = pickerChapter;
    setPickerChapter(null);
    if (!chapter) return;
    // Re-picking overwrites the seeded title/date/note/photo — confirm if the page already has content.
    if (chapterHasContent(chapter) &&
        !window.confirm('Feature this First here? It will replace the photo and words currently on this page.')) {
      return;
    }
    try {
      const seeded = await updateChapter(chapter.id, { layoutData: seedMomentHeroFromFirst(chapter, first) });
      setBuilderChapter(seeded);
    } catch { onError?.('Failed to add that First'); }
  }

  async function deleteChapter(id) {
    await apiRequest(`/storybook/${id}`, { method: 'DELETE' });
    setChapters(c => c.filter(ch => ch.id !== id));
  }

  // ── Chapter ordering ──────────────────────────────────────────────────────────
  // `sorted` mirrors `chapters` in stable order — consumed by the guided view, the PDF export, and the
  // freeform single-chapter lookup. (Freeform reordering is gone: a freeform book is one chapter.)

  const [sorted, setSorted] = useState([]);

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

  // ── Full-screen sub-views ──────────────────────────────────────────────────────

  if (builderChapter) {
    // Guided pages are locked (single fixed page, no layout/page controls) and show their arc prompt.
    const guidedEntry = activeBook?.type === 'guided' ? arcEntryById(builderChapter.anchorKey) : null;
    // The memory panel (sv2-s7.5a) is for fill/pick pages only; auto/prefill render from data.
    const showMemories = guidedEntry ? (guidedEntry.kind === 'fill' || guidedEntry.kind === 'pick') : true;
    // Book-wide "used" dimming: which pieces are placed on OTHER chapters of this book (each guided
    // page is its own chapter, so the builder can't see them). Exclude the page being edited — its
    // placements are tracked live inside the builder.
    const guidedUsedKeys = guidedEntry
      ? collectUsedKeys(chapters.filter(c => c.id !== builderChapter.id))
      : null;
    return (
      <ScrapbookBuilder
        chapter={builderChapter}
        journalEntries={journalEntries ?? []}
        firsts={firsts ?? []}
        bumpPhotos={bumpPhotos ?? []}
        birthdate={birthdate}
        theme={activeTheme}
        onUpdate={updateChapter}
        onClose={() => { setBuilderChapter(null); loadPageData(); }}
        pageData={pageData}
        locked={!!guidedEntry}
        showMemories={showMemories}
        defaultBucket={guidedEntry?.defaultBucket || null}
        usedKeys={guidedUsedKeys}
        promptText={guidedEntry?.prompt || null}
        eyebrow={guidedEntry?.section || null}
        onError={onError}
      />
    );
  }

  if (showShelf) {
    return (
      <YourBooksShelf
        books={books}
        activeBookId={activeBookId}
        progress={bookProgress}
        onSelect={handleSelectBook}
        onRename={handleRenameBook}
        onDuplicate={handleDuplicateBook}
        onDelete={handleDeleteBook}
        onNewBook={() => { setShowShelf(false); setShowChooser(true); }}
        onClose={() => setShowShelf(false)}
      />
    );
  }

  // ── Loading / empty-library states ─────────────────────────────────────────────

  if (!booksLoaded) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpen className="w-16 h-16 text-primary/30 mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">Start your first book</p>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs mb-4">
            Create a keepsake book to fill with your favourite memories.
          </p>
          <Button onClick={() => setShowChooser(true)} className="bg-color-highlight hover:bg-color-highlight/90 gap-2">
            <PenLine className="w-4 h-4" /> Create a book
          </Button>
        </div>
        {showChooser && (
          <NewBookChooser onCreate={handleCreateBook} onClose={() => setShowChooser(false)} dismissable={false} />
        )}
      </>
    );
  }

  // ── Main book view ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <BookSwitcher
        title={activeBook?.title || `${babyName || 'Baby'}'s Memory Book`}
        onOpen={() => setShowShelf(true)}
      />

      <BookCover
        bookId={activeBookId}
        babyName={babyName}
        birthdate={birthdate}
        coverPhotoUrl={coverPhotoUrl}
        coverSubtitle={coverSubtitle}
        theme={activeTheme}
        onCoverPhotoChange={(url) => applyCoverPatch({ coverPhotoUrl: url })}
        onCoverSubtitleChange={(val) => applyCoverPatch({ coverSubtitle: val })}
        onError={onError}
      />

      {/* Book theme picker + PDF download */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium shrink-0">Book theme:</span>
        <div className="flex gap-3 flex-wrap">
          {BOOK_THEMES.map(t => {
            const selected = (activeBook?.theme || 'classic') === t.key;
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
      </div>

      {activeBook?.type === 'guided' ? (
        <GuidedBookView
          title={activeBook?.title || `${babyName || 'Baby'}'s Memory Book`}
          chapters={sorted}
          firsts={firsts ?? []}
          onOpenBuilder={(ch) => setBuilderChapter(ch)}
          onPick={(ch) => setPickerChapter(ch)}
        />
      ) : (
        // sv2-s8.5: a freeform book is one continuous page sequence (one chapter). No chapter cards,
        // no time-period step — just open the whole-book editor.
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <BookOpen className="w-14 h-14 text-primary/25" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Your book is one continuous set of pages. Open the editor to add pages and arrange your
            photos and words.
          </p>
          <Button
            onClick={() => { const ch = sorted[0]; if (ch) setBuilderChapter(ch); }}
            disabled={!sorted[0]}
            className="bg-color-highlight hover:bg-color-highlight/90 gap-2"
          >
            <PenLine className="w-4 h-4" />
            Edit book
          </Button>
        </div>
      )}

      <ShareSection
        bookId={activeBookId}
        shareUnlocked={!!activeBook?.shareUnlocked}
        onError={onError}
      />

      {pickerChapter && (
        <FirstPicker
          firsts={firsts ?? []}
          featuredIds={featuredFirstTimeIds(sorted)}
          onChoose={handleChooseFirst}
          onClose={() => setPickerChapter(null)}
        />
      )}

      {showChooser && (
        <NewBookChooser onCreate={handleCreateBook} onClose={() => setShowChooser(false)} dismissable />
      )}
    </div>
  );
}
