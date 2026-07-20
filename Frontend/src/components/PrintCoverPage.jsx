/**
 * Print pr4 — the print-view route for the book COVER (a single wrap sheet).
 *
 * Sibling of PrintBookPage (pr2). Rendered OUTSIDE the auth gate via a `/print/cover/{token}` pathname branch
 * in App.jsx, so the headless-Chrome sidecar (pr1) loads it unauthenticated and `page.pdf()`s it. Lulu wants
 * the cover as a SEPARATE PDF from the interior (lulu-spec-handoff.md Q13), laid out as one wide sheet:
 *
 *     ┌──────────── back ────────────┬─ spine ─┬──────────── front ────────────┐   (outside-facing view)
 *
 * Reuses the interior's render token + payload endpoint (`GET /print/payload/{token}` → the unfiltered book).
 * The only cover-specific inputs are `book.cover` (title/subtitle/photo, resolved server-side), `book.theme`,
 * and the interior PAGE COUNT (Σ chapter pages) — which drives the spine width.
 *
 * Decisions:
 *  - pr4 planning: spine/wrap dims from Lulu's PUBLISHED cover formula (Option A, 2026-07-17) — no Lulu API
 *    call here; pr5 cross-checks against Lulu's cover-dimensions endpoint. See PAPER_PPI note below.
 *  - pr0.5 gap #11: back cover = branded solid from the theme (no user back-cover editor); spine text = book
 *    title, only above Lulu's page-count threshold, else blank.
 *  - Front cover mirrors BookCover.jsx's design, FIT-whole into the trim with the theme bg bleeding to the
 *    paper edge — the same aspect handling PrintBookPage uses for interior pages (pr2 Q1).
 */
import { useState, useEffect } from 'react';
import { getTheme } from '@/lib/bookThemes';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Print geometry (parameterized — pr0's real pod_package_id sets these numbers) ───────────────────
// SKU 0850X1100FCPREPB080CW444GXX → 8.5×11 trim, perfect-bound, 80# coated white stock.
const TRIM_W_IN = 8.5;
const TRIM_H_IN = 11;
const BLEED_IN = 0.125;

// Spine width = (pages / PPI) + 0.06"  — Lulu's published softcover perfect-bound formula.
// PAPER_PPI = 444 is the pages-per-inch of our SKU's paper (the "444" in …080CW444G).
// ⚠️ FLAGGED TO VERIFY in pr5 against Lulu's authoritative cover-dimensions API before real orders.
// Source: help.api.lulu.com "How is spine width calculated?".
const PAPER_PPI = 444;
const SPINE_PAD_IN = 0.06;
// Lulu best-practice: spine text only reads cleanly on a thick-enough spine. Below this page count the spine
// is left blank (pr0.5 gap #11). Also flagged to verify against Lulu's cover-dimensions output in pr5.
const SPINE_TEXT_MIN_PAGES = 80;

// FIT the fixed 3:4 cover canvas (600×800) to the trim HEIGHT, exactly like PrintBookPage's interior pages:
// 3:4 by trim height → 8.25in wide, centered on the panel; the theme bg fills to the bleed edge (no crop).
const CANVAS_W = 600;
const CANVAS_H = 800;
const FIT_W_IN = (TRIM_H_IN * 3) / 4; // 8.25
const CANVAS_SCALE = (FIT_W_IN * 96) / CANVAS_W; // CSS px-per-inch is fixed at 96 → deterministic scale

const spineWidthIn = (pageCount) => pageCount / PAPER_PPI + SPINE_PAD_IN;

export default function PrintCoverPage({ token }) {
  const [status, setStatus] = useState('loading'); // loading | ok | notfound | error
  const [book, setBook] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Plain fetch (NOT apiRequest) — headless Chrome has no session; the token is a short-lived render JWT.
    fetch(`${API_BASE}/print/payload/${encodeURIComponent(token)}`)
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

  // Ready signal for the sidecar: fonts + the cover image decoded, then a short settle. Mirrors PrintBookPage.
  useEffect(() => {
    if (status !== 'ok') return;
    let cancelled = false;
    (async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map(img =>
            img.complete ? Promise.resolve() : img.decode().catch(() => {})
          )
        );
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 250));
      } finally {
        if (!cancelled) document.documentElement.setAttribute('data-print-ready', 'true');
      }
    })();
    return () => {
      cancelled = true;
      document.documentElement.removeAttribute('data-print-ready');
    };
  }, [status, book]);

  if (status !== 'ok') {
    return <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }} data-print-status={status}>
      {status === 'loading' ? 'Loading…' : status === 'notfound' ? 'Book not found' : 'Something went wrong'}
    </div>;
  }

  const theme = getTheme(book.theme || 'classic');
  const bg = theme?.bg || '#fdf9f2';
  const accent = theme?.accent || '#c9a96e';
  const textColor = theme?.textColor || '#2d2013';
  const fontClass = theme?.fontClass || 'font-serif';
  const divider = theme?.dividerChar || '◆';

  const cover = book.cover || {};
  const title = cover.title || `${book.babyName || 'Baby'}'s Memory Book`;
  const subtitle = cover.subtitle || 'A memory book';
  const coverPhotoUrl = cover.coverPhotoUrl || book.pageData?.coverPhotoUrl || null;

  // Page count = interior sheets = Σ chapter pages (one page → one interior PDF sheet, same as PrintBookPage).
  const pageCount = (book.chapters || []).reduce((n, ch) => n + (ch.pages?.length || 0), 0);
  const spineIn = spineWidthIn(pageCount);
  const showSpineText = pageCount >= SPINE_TEXT_MIN_PAGES;

  // Full wrap: back(trim) | spine | front(trim), with bleed on the outer edges. Height = trim + 2·bleed.
  const wrapWidthIn = 2 * BLEED_IN + 2 * TRIM_W_IN + spineIn;
  const wrapHeightIn = 2 * BLEED_IN + TRIM_H_IN;
  const backPanelIn = BLEED_IN + TRIM_W_IN;   // back cover carries the left/top/bottom bleed
  const frontPanelIn = TRIM_W_IN + BLEED_IN;  // front cover carries the right/top/bottom bleed

  return (
    <>
      <style>{`
        @page { size: ${wrapWidthIn}in ${wrapHeightIn}in; margin: 0; }
        html, body { margin: 0; padding: 0; background: #ffffff; }
        .cover-wrap {
          width: ${wrapWidthIn}in;
          height: ${wrapHeightIn}in;
          display: flex;
          flex-direction: row;
          overflow: hidden;
        }
        .cover-panel { height: 100%; overflow: hidden; box-sizing: border-box; }
        .cover-back  { width: ${backPanelIn}in;  background: ${bg}; position: relative; }
        .cover-spine { width: ${spineIn}in;       background: ${bg}; position: relative; }
        .cover-front { width: ${frontPanelIn}in; background: ${bg};
                       display: flex; align-items: center; justify-content: center; }
        /* FIT the 3:4 cover canvas to trim height; the panel bg fills the rest (bleed). */
        .cover-fit { width: ${FIT_W_IN}in; height: ${TRIM_H_IN}in; overflow: hidden; }
        .cover-canvas {
          width: ${CANVAS_W}px; height: ${CANVAS_H}px;
          /* pr5.5 Part B: CSS zoom (not transform: scale) scales the cover canvas WITHOUT emitting a Chrome
             /Transparency group, so the cover PDF stays vector like the interior. */
          zoom: ${CANVAS_SCALE};
          background: ${bg}; color: ${textColor};
          display: flex; flex-direction: column;
        }
        /* Back-cover branding: a small wordmark, kept well inside the 0.5" safety margin. */
        .cover-brand {
          position: absolute; left: 0; right: 0; bottom: 0.75in;
          text-align: center; color: ${textColor}; opacity: 0.45;
          font-size: 12pt; letter-spacing: 0.04em;
        }
        /* Spine text: rotated book title, centered, inside the vertical safety margin. */
        .cover-spine-text {
          position: absolute; top: 0.5in; bottom: 0.5in; left: 0; right: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .cover-spine-text > span {
          writing-mode: vertical-rl; transform: rotate(180deg);
          white-space: nowrap; color: ${textColor}; opacity: 0.8;
          font-size: ${Math.min(11, Math.max(7, spineIn * 96 * 0.42))}px; line-height: 1;
        }
      `}</style>

      <div className="cover-wrap" data-print-cover={book.babyName || ''} data-page-count={pageCount}>
        {/* BACK cover — branded solid from the theme (pr0.5 gap #11). */}
        <div className="cover-panel cover-back">
          <div className={`cover-brand ${fontClass}`}>CradleHQ</div>
        </div>

        {/* SPINE — book title above the page-count threshold, else blank. */}
        <div className="cover-panel cover-spine">
          {showSpineText && (
            <div className="cover-spine-text">
              <span className={fontClass}>{title}</span>
            </div>
          )}
        </div>

        {/* FRONT cover — mirrors BookCover.jsx, scaled from the 600×800 canvas. */}
        <div className="cover-panel cover-front">
          <div className="cover-fit">
            <div className="cover-canvas">
              {/* Hero photo — a 4:3 slot (canvas is 600 wide → 450 tall) matching BookCover's 4:3 hero and the
                  4:3-locked upload crop, so object-fit:cover never re-crops. (pr4 follow-up) */}
              <div style={{ width: '100%', height: Math.round((CANVAS_W * 3) / 4), overflow: 'hidden', flexShrink: 0,
                            backgroundColor: coverPhotoUrl ? undefined : accent + '22' }}>
                {coverPhotoUrl && (
                  <img src={coverPhotoUrl} crossOrigin="anonymous" alt=""
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
              </div>

              {/* Title + subtitle — bottom 45%. */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', padding: '32px 40px', textAlign: 'center', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: accent, opacity: 0.3 }} />
                  <span style={{ fontSize: 10, color: accent, opacity: 0.5 }}>{divider}</span>
                  <div style={{ flex: 1, height: 1, background: accent, opacity: 0.3 }} />
                </div>
                <h2 className={fontClass}
                    style={{ fontSize: 28, fontWeight: 600, margin: '0 0 10px', color: textColor, lineHeight: 1.3 }}>
                  {title}
                </h2>
                <p className={fontClass} style={{ fontSize: 14, margin: 0, color: textColor, opacity: 0.6 }}>
                  {subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
