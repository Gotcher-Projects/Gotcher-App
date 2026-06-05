import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CANVAS_W, CANVAS_H, renderBlocks } from "@/lib/bookCanvas";

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
