import React, { useState, useEffect, useRef } from "react";

export default function LayoutRenderer({ layout }) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState(0);

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
  const blocks = layout?.blocks || [];

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: '1 / 1' }}
    >
      {containerSize > 0 && blocks.map((block, i) => (
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
                  className={`font-serif text-foreground/85 leading-snug ${j > 0 ? 'mt-2' : ''}`}
                  style={{ fontSize: 'clamp(9px, 1.4vw, 13px)' }}
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
      ))}
    </div>
  );
}
