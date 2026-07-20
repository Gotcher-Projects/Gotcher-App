/**
 * Print pr2 — the print-view route for the book INTERIOR.
 *
 * Rendered OUTSIDE the auth gate via a `/print/book/{token}` pathname branch in App.jsx (mirrors the
 * `/book/{token}` public branch), so the headless-Chrome sidecar (pr1) can load it unauthenticated and
 * `page.pdf()` it. It lays out EVERY page in book order at physical trim+bleed dimensions, with no app chrome,
 * through the same `LayoutRenderer` dispatch the app uses. The cover is a separate PDF (pr4), so this route is
 * interior-only.
 *
 * Decisions (pr2 planning, see plans/storybook-v2/print/pr2-print-view-route.md):
 *  - Q1 aspect mapping = FIT-WHOLE + bleed the page background (no crop; flat bg extends to the paper edge).
 *  - Q2 interior only (cover → pr4).
 *  - Q3 fetch-by-token; the payload is UNFILTERED (all pages). The `{token}` is a short-lived render JWT
 *      (pr3) minted by the backend after an owner check; `GET /print/payload/{token}` returns the payload.
 *
 * The sidecar waits for `[data-print-ready="true"]` on <html> before capturing — set once fonts + images have
 * settled and the ResizeObserver-driven canvas scaling has applied.
 */
import { useState, useEffect } from 'react';
import LayoutRenderer from '@/components/storybook/LayoutRenderer';
import { getTheme } from '@/lib/bookThemes';
import { buildAchievedMilestones } from '@/lib/milestonesPage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Print geometry (parameterized — pr0's real pod_package_id just sets these numbers) ──────────────
// Trim 8.5×11 + 0.125"/side bleed → an 8.75×11.25in sheet. The book canvas is a fixed 3:4 (600×800), so it
// can't fill the 0.773 trim exactly; per Q1 we FIT the whole 3:4 canvas (no crop) and let the flat page
// background extend to the bleed edge. Fit to the trim: 3:4 by trim height → 8.25×11in, centered on the sheet.
const TRIM_W_IN = 8.5;
const TRIM_H_IN = 11;
const BLEED_IN = 0.125;
const SHEET_W_IN = TRIM_W_IN + 2 * BLEED_IN;   // 8.75
const SHEET_H_IN = TRIM_H_IN + 2 * BLEED_IN;   // 11.25
const FIT_W_IN = TRIM_H_IN * 3 / 4;            // 8.25 — LayoutRenderer (w-full, aspect 3/4) → 11in tall

export default function PrintBookPage({ token }) {
  const [status, setStatus] = useState('loading'); // loading | ok | notfound | error
  const [book, setBook] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Plain fetch (NOT apiRequest) — headless Chrome has no session, and apiRequest would trigger the
    // token-refresh machinery. The token is a short-lived render JWT that authorizes the unfiltered payload.
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

  // Ready signal for the sidecar: fonts + images decoded, then let the canvas ResizeObserver scaling settle.
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
        // Two frames + a short settle so useCanvasScale (ResizeObserver → setState) has applied to every page.
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 350));
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
    // Minimal, chrome-free status text. A non-ok state should never reach the sidecar (pr3 checks first).
    return <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }} data-print-status={status}>
      {status === 'loading' ? 'Loading…' : status === 'notfound' ? 'Book not found' : 'Something went wrong'}
    </div>;
  }

  const theme = getTheme(book.theme || 'classic');
  const chapters = book.chapters || [];

  // Rebuild canvas-ready pageData exactly as StorybookTab / PublicBookPage do (milestones resolved client-side).
  const pageData = {
    ...book.pageData,
    achievedMilestones: buildAchievedMilestones(book.pageData?.milestonesAchieved || []),
  };

  // Flatten chapters → an ordered list of { page, letterEyebrow } so each becomes one print sheet.
  const sheets = [];
  for (const chapter of chapters) {
    const eyebrow = chapter.anchorType === 'guided' ? chapter.anchorLabel : undefined;
    for (const page of chapter.pages || []) {
      sheets.push({ page, eyebrow });
    }
  }

  return (
    <>
      <style>{`
        @page { size: ${SHEET_W_IN}in ${SHEET_H_IN}in; margin: 0; }
        html, body { margin: 0; padding: 0; background: #ffffff; }
        .print-root { background: #e5e7eb; }
        .print-sheet {
          width: ${SHEET_W_IN}in;
          height: ${SHEET_H_IN}in;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-sizing: border-box;
        }
        /* Each sheet its own PDF page; no break after the last avoids a trailing blank page. */
        .print-sheet:not(:last-child) { break-after: page; page-break-after: always; }
        .print-fit { width: ${FIT_W_IN}in; }
      `}</style>

      <div className="print-root" data-print-book={book.babyName || ''}>
        {sheets.map(({ page, eyebrow }, i) => {
          const pageBg = page.backgroundColor || theme?.bg || '#fdf9f2';
          return (
            <div className="print-sheet" key={i} style={{ backgroundColor: pageBg }}>
              <div className="print-fit">
                <LayoutRenderer
                  layout={{ version: 2, pages: [page] }}
                  theme={theme}
                  pageData={pageData}
                  letterEyebrow={eyebrow}
                  scaleMode="zoom"
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
