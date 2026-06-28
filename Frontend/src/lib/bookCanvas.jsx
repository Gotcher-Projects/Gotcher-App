import React, { useState, useEffect, useRef, useMemo } from "react";
import { useFittedFontSize } from "@/lib/fitText";
import { renderContentHTML } from "@/lib/tiptap";

// Shared book-page render model — the single source of truth for how a v2 layout
// block is drawn. LayoutRenderer (published view) and ScrapbookBuilder both render
// through these helpers so a page looks pixel-identical everywhere.

export const FONT_MAP = {
  serif: 'font-serif', playf: 'font-playf', merri: 'font-merri',
  sans: 'font-sans', lato: 'font-lato', nunito: 'font-nunito', display: 'font-display',
};

// Font-family choices for the block font picker (label = display name).
export const FONT_OPTIONS = [
  { key: 'serif',   label: 'Georgia' },
  { key: 'playf',   label: 'Playfair' },
  { key: 'merri',   label: 'Merri' },
  { key: 'sans',    label: 'Inter' },
  { key: 'lato',    label: 'Lato' },
  { key: 'nunito',  label: 'Nunito' },
  { key: 'display', label: 'Poppins' },
];

// Reverse lookup: tailwind class → font key (used to highlight the theme default).
export const REVERSE_FONT_MAP = Object.fromEntries(
  Object.entries(FONT_MAP).map(([k, v]) => [v, k])
);

// Virtual page canvas — fixed 3:4 portrait so every surface renders identically
// regardless of display width (CSS-scaled to fit).
export const CANVAS_W = 600;
export const CANVAS_H = 800;
export const BASE_FONT = Math.max(9, CANVAS_W * 0.025);

// Track a container's rendered width via ResizeObserver and derive the canvas scale factor.
// Shared by ScrapbookBuilder (editor) and LayoutRenderer (published view) so both CSS-scale the
// fixed 600px virtual page to the available width identically.
export function useCanvasScale(ref) {
  const [containerSize, setContainerSize] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerSize(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const scale = containerSize > 0 ? containerSize / CANVAS_W : 1;
  return { containerSize, scale };
}

// Circular-avatar initial, centered GEOMETRICALLY via SVG (text-anchor:middle +
// dominant-baseline:central) rather than CSS line-height/flex. The browser and html2canvas disagree
// on text baselines — a CSS-centered glyph renders low in the exported PDF — but both rasterize this
// SVG identically. Shared by FamilyTreeCanvas + PeopleCanvas (the circular book-page avatars).
// Pair it with `borderRadius:'50%'` on the sibling <img> so the photo clips cleanly in html2canvas
// (which doesn't reliably clip a rounded parent's overflow).
export function CircleInitial({ letter, color = '#fff' }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
      <text
        x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fontFamily="'Playfair Display', Georgia, serif" fontWeight="700" fontSize="56" fill={color}
      >
        {(letter || '?').toString().trim().charAt(0).toUpperCase()}
      </text>
    </svg>
  );
}

export function injectDropCap(html) {
  // Wrap the first letter in an explicit span so html2canvas renders it
  // (html2canvas ignores ::first-letter pseudo-elements).
  // Matches the first letter immediately after any closing HTML tag angle bracket.
  return html.replace(/>(\s*)([A-Za-z])/, (_, ws, letter) =>
    `>${ws}<span class="book-drop-cap">${letter}</span>`
  );
}

export function RenderedText({ block, fontClass, textColor }) {
  const ref = useRef(null);
  const rawHtml = useMemo(() => renderContentHTML(block.content), [block.content]);
  // For drop-cap blocks, inject an explicit span (works in html2canvas unlike ::first-letter).
  // Always use book-rich--edit on the wrapper so the CSS ::first-letter rule doesn't
  // double-fire on top of our span.
  const html = useMemo(
    () => (!block.suppressDropCap && rawHtml ? injectDropCap(rawHtml) : rawHtml),
    [rawHtml, block.suppressDropCap]
  );
  const w = block.width * CANVAS_W;
  const h = block.height * CANVAS_H;
  const fontSize = useFittedFontSize(ref, BASE_FONT, 8, [html, fontClass, w, h], BASE_FONT * 1.7);
  return (
    <div
      ref={ref}
      className={`book-rich--edit ${fontClass} w-full h-full p-3 overflow-hidden`}
      style={{ fontSize, lineHeight: 1.8, color: textColor || undefined }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// L-Wrap block: a single cohesive text body that flows around a photo floated
// into the top-right corner, producing a true L-shape. One container, one fitted
// font size — unlike the old two-rectangle approach where each block fitted
// independently and the sizes diverged.
export function LWrapBlock({ block, fontClass, textColor }) {
  const ref = useRef(null);
  const rawHtml = useMemo(() => renderContentHTML(block.content), [block.content]);
  // l-wrap suppresses the drop cap by default; honor an explicit override anyway.
  const html = useMemo(
    () => (!block.suppressDropCap && rawHtml ? injectDropCap(rawHtml) : rawHtml),
    [rawHtml, block.suppressDropCap]
  );
  const w = block.width * CANVAS_W;
  const h = block.height * CANVAS_H;
  // Photo occupies the top-right ~47% of the block; gap to the wrapping text.
  const photoW = Math.round(w * 0.47);
  const photoH = Math.round(h * 0.47);
  const marginL = Math.round(w * 0.03);
  const marginB = Math.round(h * 0.03);

  // overflow:hidden makes this container a block-formatting context, so it
  // contains the float and scrollHeight reflects both float and text height —
  // which lets useFittedFontSize converge correctly.
  const fontSize = useFittedFontSize(ref, BASE_FONT, 8, [html, fontClass, w, h], BASE_FONT * 1.7);

  return (
    <div
      ref={ref}
      className={`book-rich--edit ${fontClass} w-full h-full p-3 overflow-hidden`}
      style={{ fontSize, lineHeight: 1.8, color: textColor || undefined, boxSizing: 'border-box' }}
    >
      {/* Float MUST come before the text in DOM order — float wrapping only
          applies to content that follows the float in source order. The fixed-size
          floated box clips its image so a stored crop (cropStyle) renders correctly.
          The box is ALWAYS rendered (even with no photo) so a text-first l-wrap still
          reserves the corner and the text wraps into the L-shape; a photo-less box is
          transparent in the published view + PDF (no frame). A constant-size reserved
          box also means adding/removing a photo never reflows the text or re-fits. */}
      <div
        style={{
          float: 'right',
          width: photoW,
          height: photoH,
          marginLeft: marginL,
          marginBottom: marginB,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <SlotImage url={block.url} crop={block.crop} label={block.label} className="w-full h-full object-cover" />
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// Absolute box style positioning a block on the virtual canvas.
export function blockBoxStyle(block) {
  return {
    position: 'absolute',
    left: block.x * CANVAS_W,
    top: block.y * CANVAS_H,
    width: block.width * CANVAS_W,
    height: block.height * CANVAS_H,
    overflow: 'hidden',
  };
}

// Compute absolute positioning style that shows only the stored crop region.
// Works with overflow:hidden on the parent (provided by blockBoxStyle).
export function cropStyle(crop) {
  return {
    position: 'absolute',
    left: `${-crop.x / crop.width * 100}%`,
    top: `${-crop.y / crop.height * 100}%`,
    width: `${100 / crop.width}%`,
    height: 'auto',
    maxWidth: 'none',
  };
}

// Render a slot's photo: a stored crop region (via cropStyle, needs an
// overflow:hidden positioned parent) or a plain cover fill. Single source of truth
// for the `crop ? cropStyle : cover` ternary repeated across the book canvases.
// Cover callers pass their own fill style — Tailwind `object-cover` sites pass
// `className`; MomentHeroCanvas passes an inline `style` (it needs display:block) —
// so each call site keeps its exact markup.
export function SlotImage({ url, crop, label, className, style }) {
  if (!url) return null;
  if (crop) return <img src={url} alt={label || ''} style={cropStyle(crop)} />;
  return <img src={url} alt={label || ''} className={className} style={style} />;
}

// Render a list of blocks (text / photo). Empty slots draw nothing —
// callers that want placeholders (e.g. the builder) render their own slot view.
// opts.suppressDropCap forces the journal drop-cap OFF for every text block — used by the fill-in
// layouts (Trio+Note / Pair+Caption) whose text is short titles/captions, not body paragraphs. It's
// applied at render time (keyed on the template) so it fixes pages already saved without the per-block
// flag, not just newly-added ones.
export function renderBlocks(blocks, theme, opts = {}) {
  return blocks.map((block, i) => {
    const fontClass = FONT_MAP[block.fontFamily] ?? theme?.fontClass ?? 'font-serif';
    const tblock = opts.suppressDropCap ? { ...block, suppressDropCap: true } : block;
    return (
      <div key={block.id || i} style={blockBoxStyle(block)}>
        {block.type === 'text' ? (
          <RenderedText block={tblock} fontClass={fontClass} textColor={theme?.textColor} />
        ) : block.type === 'l-wrap' ? (
          <LWrapBlock block={tblock} fontClass={fontClass} textColor={theme?.textColor} />
        ) : (
          <SlotImage url={block.url} crop={block.crop} label={block.label} className="w-full h-full object-cover" />
        )}
      </div>
    );
  });
}

// Template ids whose text blocks must never get the journal drop-cap (short title/caption fields).
export const DROP_CAP_FREE_TEMPLATES = new Set(['growth-spread', 'hands-feet']);
