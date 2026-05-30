import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFittedFontSize } from "@/lib/fitText";
import { stickerMaskStyle } from "@/lib/stickers";
import { renderContentHTML } from "@/lib/tiptap";

const FONT_MAP = { serif: 'font-serif', playf: 'font-playf', merri: 'font-merri', sans: 'font-sans', lato: 'font-lato', nunito: 'font-nunito', display: 'font-display' };

// Virtual page canvas — fixed 3:4 portrait so the editor and published view
// render identically regardless of display width (CSS-scaled to fit).
const CANVAS_W = 600;
const CANVAS_H = 800;
const BASE_FONT = Math.max(9, CANVAS_W * 0.025);

function RenderedText({ block, fontClass, textColor }) {
  const ref = useRef(null);
  const html = useMemo(() => renderContentHTML(block.content), [block.content]);
  const w = block.width * CANVAS_W;
  const h = block.height * CANVAS_H;
  const fontSize = useFittedFontSize(ref, BASE_FONT, 8, [html, fontClass, w, h]);
  return (
    <div
      ref={ref}
      className={`book-rich ${fontClass} w-full h-full p-3 overflow-hidden`}
      style={{ fontSize, lineHeight: 1.8, color: textColor || undefined }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderBlocks(blocks, theme) {
  return blocks.map((block, i) => {
    const fontClass = FONT_MAP[block.fontFamily] ?? theme?.fontClass ?? 'font-serif';
    return (
      <div
        key={block.id || i}
        style={{
          position: 'absolute',
          left: block.x * CANVAS_W,
          top: block.y * CANVAS_H,
          width: block.width * CANVAS_W,
          height: block.height * CANVAS_H,
          overflow: 'hidden',
        }}
      >
        {block.type === 'text' ? (
          <RenderedText block={block} fontClass={fontClass} textColor={theme?.textColor} />
        ) : block.type === 'sticker' ? (
          <div style={stickerMaskStyle(block.stickerKey, block.color || theme?.accent)} />
        ) : (
          block.url && (
            <img
              src={block.url}
              alt={block.label || ''}
              className="w-full h-full object-cover"
            />
          )
        )}
      </div>
    );
  });
}

export default function LayoutRenderer({ layout, theme }) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerSize(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = containerSize > 0 ? containerSize / CANVAS_W : 1;

  if (layout?.version === 2) {
    const pages = layout.pages || [];
    const page = pages[currentPage] || {};
    const blocks = page.blocks || [];
    const pageBg = page.backgroundColor || theme?.bg || '#fdf9f2';

    return (
      <div>
        <div
          ref={containerRef}
          className="relative w-full mx-auto overflow-hidden"
          style={{ aspectRatio: '3 / 4' }}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) < 50) return;
            if (delta < 0) setCurrentPage(p => Math.min(pages.length - 1, p + 1));
            else setCurrentPage(p => Math.max(0, p - 1));
          }}
        >
          {containerSize > 0 && (
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: CANVAS_W, height: CANVAS_H,
              transform: `scale(${scale})`, transformOrigin: 'top left',
              backgroundColor: pageBg,
            }}>
              {renderBlocks(blocks, theme)}
            </div>
          )}
        </div>
        {pages.length > 1 && (
          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {currentPage + 1} / {pages.length}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
              disabled={currentPage === pages.length - 1}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // v1: single-page (existing behavior)
  const blocks = layout?.blocks || [];
  const v1Bg = theme?.bg || '#fdf9f2';
  return (
    <div
      ref={containerRef}
      className="relative w-full mx-auto overflow-hidden"
      style={{ aspectRatio: '3 / 4' }}
    >
      {containerSize > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: CANVAS_W, height: CANVAS_H,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          backgroundColor: v1Bg,
        }}>
          {renderBlocks(blocks, theme)}
        </div>
      )}
    </div>
  );
}
