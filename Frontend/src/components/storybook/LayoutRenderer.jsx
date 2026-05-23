import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function renderBlocks(blocks, cs) {
  const fontSize = Math.max(9, cs * 0.025);
  return blocks.map((block, i) => (
    <div
      key={block.id || i}
      style={{
        position: 'absolute',
        left: block.x * cs,
        top: block.y * cs,
        width: block.width * cs,
        height: block.height * cs,
        overflow: 'hidden',
      }}
    >
      {block.type === 'text' ? (
        <div className="w-full h-full p-3 overflow-hidden">
          {(block.content || '').split('\n\n').map((para, j) => (
            <p
              key={j}
              className={`font-serif text-foreground/85 ${j === 0 ? 'book-chapter-first' : ''}`}
              style={{ fontSize, lineHeight: 1.8, marginTop: j > 0 ? fontSize : 0 }}
            >
              {para.trim()}
            </p>
          ))}
        </div>
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
  ));
}

export default function LayoutRenderer({ layout }) {
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

  const cs = containerSize || 400;

  if (layout?.version === 2) {
    const pages = layout.pages || [];
    const blocks = pages[currentPage]?.blocks || [];

    return (
      <div>
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-white"
          style={{ aspectRatio: '1 / 1' }}
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
          {containerSize > 0 && renderBlocks(blocks, cs)}
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
  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: '1 / 1' }}
    >
      {containerSize > 0 && renderBlocks(blocks, cs)}
    </div>
  );
}
