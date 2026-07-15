/**
 * Share s13b — the public read-only view of a shared book.
 *
 * Rendered OUTSIDE the auth gate via a `/book/{token}` pathname branch in App.jsx, so a logged-out
 * visitor can open it. Fetches the PII-scoped payload from `GET /book/public/{token}` (no auth — a
 * plain fetch, NOT apiRequest, which would trigger the token-refresh machinery for a visitor with no
 * session) and renders the book's published pages through the same `LayoutRenderer` dispatch the app
 * and PDF exporter use. Outward-facing light theme; polished enough for a grandparent to keep reading.
 */
import { useState, useEffect } from 'react';
import LayoutRenderer from '@/components/storybook/LayoutRenderer';
import { getTheme } from '@/lib/bookThemes';
import { buildAchievedMilestones } from '@/lib/milestonesPage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Outward-facing surface — deliberately light/cream regardless of the app's dark theme.
const PAGE_BG = '#faf7f0';
const INK = '#2d2013';

// Each page/cover is a "sheet" on the cream desk. A warm, soft shadow (not pure black) carries the
// separation on ANY page background — including dark book themes (midnight) where a light hairline
// border alone would vanish; the border is just a low-opacity edge for light pages.
const SHEET_SHADOW = '0 2px 18px rgba(45, 32, 19, 0.13)';

export default function PublicBookPage({ token }) {
  const [status, setStatus] = useState('loading'); // loading | ok | notfound | error
  const [book, setBook] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/book/public/${encodeURIComponent(token)}`)
      .then(res => {
        if (res.status === 404) return { _notfound: true };
        if (!res.ok) throw new Error('request failed');
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        if (data._notfound) { setStatus('notfound'); return; }
        setBook(data);
        setStatus('ok');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [token]);

  if (status === 'loading') return <Shell><p style={{ color: INK, opacity: 0.6 }}>Loading…</p></Shell>;
  if (status === 'notfound') {
    return <Shell><Message title="This link is no longer active"
      body="Ask the parent to share a new one." /></Shell>;
  }
  if (status === 'error') {
    return <Shell><Message title="Something went wrong"
      body="Please try again in a moment." /></Shell>;
  }

  const theme = getTheme(book.theme || 'classic');
  const chapters = book.chapters || [];
  const hasPages = chapters.some(c => (c.pages || []).length > 0);

  // Rebuild the canvas-ready pageData exactly as StorybookTab does: the milestones list is transformed
  // client-side (name resolution lives in the frontend MILESTONES dataset), everything else passes through.
  const pageData = {
    ...book.pageData,
    achievedMilestones: buildAchievedMilestones(book.pageData?.milestonesAchieved || []),
  };

  return (
    <Shell wide>
      <header className="text-center mb-8">
        <img src="/images/cradleLogo.png" alt="CradleHQ" className="h-14 mx-auto block" />
        <h1 className="font-display font-bold text-2xl mt-2" style={{ color: INK }}>
          {book.babyName ? `${book.babyName}'s Story` : 'A Memory Book'}
        </h1>
      </header>

      <CoverCard cover={book.cover} theme={theme} />

      {!hasPages ? (
        <div className="mt-8">
          <Message title="This story is still being written" body="Check back soon." />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {chapters.map((chapter, ci) =>
            (chapter.pages || []).map((page, pi) => (
              <div
                key={`${ci}-${pi}`}
                className="w-full rounded-xl overflow-hidden border border-black/5"
                style={{ boxShadow: SHEET_SHADOW }}
              >
                <LayoutRenderer
                  layout={{ version: 2, pages: [page] }}
                  theme={theme}
                  pageData={pageData}
                  letterEyebrow={chapter.anchorType === 'guided' ? chapter.anchorLabel : undefined}
                />
              </div>
            ))
          )}
        </div>
      )}

      <footer className="text-center mt-10 pt-6" style={{ borderTop: `1px solid ${INK}22` }}>
        <p className="text-sm" style={{ color: INK, opacity: 0.6 }}>
          Created with CradleHQ — track your baby's story at{' '}
          <a href="https://cradlehq.app" className="underline" style={{ color: INK }}>cradlehq.app</a>
        </p>
      </footer>
    </Shell>
  );
}

// Full-page cream surface; `wide` widens the column for the book, narrow centers status messages.
function Shell({ children, wide }) {
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: PAGE_BG }}>
      <div className={`mx-auto px-4 py-10 ${wide ? 'max-w-[600px]' : 'max-w-md min-h-screen flex items-center justify-center'}`}>
        {children}
      </div>
    </div>
  );
}

function Message({ title, body }) {
  return (
    <div className="text-center">
      <img src="/images/cradleLogo.png" alt="CradleHQ" className="h-16 mx-auto block mb-3" />
      <h2 className="font-display font-semibold text-xl" style={{ color: INK }}>{title}</h2>
      <p className="mt-2" style={{ color: INK, opacity: 0.6 }}>{body}</p>
    </div>
  );
}

// Read-only cover card mirroring BookCover.jsx's visual (no edit/upload controls).
function CoverCard({ cover, theme }) {
  const bg = theme?.bg || '#fdf9f2';
  const accent = theme?.accent || '#c9a96e';
  const textColor = theme?.textColor || undefined;
  const fontClass = theme?.fontClass || 'font-serif';
  return (
    <div className="rounded-xl overflow-hidden border border-black/5 w-full"
      style={{ backgroundColor: bg, boxShadow: SHEET_SHADOW }}>
      <div className="relative w-full" style={{ aspectRatio: '4 / 3', minHeight: 160 }}>
        {cover?.coverPhotoUrl ? (
          <img src={cover.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: accent + '22' }} />
        )}
      </div>
      <div className="px-6 py-5 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="h-px flex-1" style={{ backgroundColor: accent, opacity: 0.3 }} />
          <span className="text-xs" style={{ color: accent, opacity: 0.5 }}>{theme?.dividerChar || '◆'}</span>
          <div className="h-px flex-1" style={{ backgroundColor: accent, opacity: 0.3 }} />
        </div>
        <h2 className={`font-display font-semibold text-2xl leading-tight ${fontClass}`} style={{ color: textColor }}>
          {cover?.title}
        </h2>
        {cover?.subtitle && (
          <p className={`text-sm ${fontClass} opacity-60`} style={{ color: textColor }}>{cover.subtitle}</p>
        )}
      </div>
    </div>
  );
}
