import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Type, Image as ImageIcon, Camera, Crop } from "lucide-react";
import { contentToPlainText } from "@/lib/tiptap";
import {
  CANVAS_W, CANVAS_H, FONT_MAP, REVERSE_FONT_MAP,
  RenderedText, LWrapBlock, blockBoxStyle, SlotImage,
} from "@/lib/bookCanvas";
import RichTextEditor from "@/components/storybook/RichTextEditor";
import FontPicker from "@/components/storybook/FontPicker";

function SlotPlaceholder({ kind, armed }) {
  const Icon = kind === 'photo' ? ImageIcon : Type;
  const label = kind === 'photo' ? 'Add a photo' : 'Drop a memory';
  return (
    <div className={`w-full h-full border-2 border-dashed rounded flex flex-col items-center justify-center gap-1.5 transition-colors ${
      armed ? 'border-color-highlight bg-color-warm/20' : 'border-color-highlight/30 bg-color-warm/5'
    }`}>
      <Icon className={`w-6 h-6 ${armed ? 'text-color-highlight' : 'text-color-highlight/40'}`} />
      <span className="text-sm text-muted-foreground/70 text-center px-2">
        {armed ? 'Tap to place' : label}
      </span>
    </div>
  );
}

// Empty-state hint for an l-wrap text region. A flat rectangle misrepresents the
// layout (it suggests text fills the photo corner too), so this draws a dashed
// outline that follows the actual L — the full block minus the top-right photo
// notch — with the label centered in the full-width strip below the photo.
function LWrapTextPlaceholder({ armed, boxW, boxH, notchW, notchH }) {
  const d = `M 0 0 H ${boxW - notchW} V ${notchH} H ${boxW} V ${boxH} H 0 Z`;
  return (
    <div className={`relative w-full h-full ${armed ? 'text-color-highlight' : 'text-color-highlight/30'}`}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${boxW} ${boxH}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={d}
          fill="currentColor"
          fillOpacity={armed ? 0.12 : 0.04}
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        className="absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center gap-1.5"
        style={{ top: notchH }}
      >
        <Type className={`w-6 h-6 ${armed ? 'text-color-highlight' : 'text-color-highlight/40'}`} />
        <span className="text-sm text-muted-foreground/70 text-center px-2">
          {armed ? 'Tap to place' : 'Drop a memory'}
        </span>
      </div>
    </div>
  );
}

// One block rendered as a droppable, editable slot. Accepts matching content via
// drag or click-to-place; text slots become rich-text editors when activated;
// photo slots open the photo tray.
export default function Slot({
  block, theme, selectedSource, isEditing,
  onActivate, onStopEdit, onFontChange, onEditorReady, onOpenTray, onReCrop, onConvertToTextOnly,
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: block.id, data: { type: block.type } });
  const draggingKind = active?.data?.current?.kind;
  // l-wrap is a single droppable that accepts BOTH text and photo drags.
  const dragMatches = block.type === 'l-wrap'
    ? (draggingKind === 'text' || draggingKind === 'photo')
    : draggingKind === block.type;
  const clickMatches = selectedSource?.kind === block.type;
  const fontClass = FONT_MAP[block.fontFamily] ?? theme?.fontClass ?? 'font-serif';
  const activeFontKey = block.fontFamily ?? REVERSE_FONT_MAP[theme?.fontClass ?? 'font-serif'] ?? 'serif';

  let inner;
  if (block.type === 'l-wrap') {
    const bw = block.width * CANVAS_W;
    const bh = block.height * CANVAS_H;
    const photoW = Math.round(bw * 0.47);
    const photoH = Math.round(bh * 0.47);
    const marginL = Math.round(bw * 0.03);
    const marginB = Math.round(bh * 0.03);
    const PAD = 12; // matches p-3
    const hasText = contentToPlainText(block.content).trim().length > 0;

    if (isEditing) {
      // Inline text edit. The photo stays floated (read-only) and the editor runs
      // in `flow` mode so its text wraps around the float, just like the result.
      inner = (
        <div className="relative w-full h-full p-3 overflow-hidden" style={{ boxSizing: 'border-box' }}>
          {/* Always-reserved float box so text-first editing wraps into the L even
              with no photo yet. A photo-less box shows a dashed "Add a photo" hint
              (builder-only; transparent in the published view + PDF). */}
          <div
            style={{ float: 'right', width: photoW, height: photoH, marginLeft: marginL, marginBottom: marginB, position: 'relative', overflow: 'hidden', pointerEvents: 'none' }}
            className="rounded"
          >
            {block.url ? (
              <SlotImage url={block.url} crop={block.crop} label={block.label} className="w-full h-full object-cover" />
            ) : (
              <SlotPlaceholder kind="photo" armed={false} />
            )}
          </div>
          <RichTextEditor
            block={block}
            fontClass={fontClass}
            textColor={theme?.textColor}
            onReady={onEditorReady}
            onStopEdit={(content) => onStopEdit(block.id, content)}
            flow
          />
          <FontPicker
            activeFontKey={activeFontKey}
            hasOverride={!!block.fontFamily}
            onChange={(key) => onFontChange(block.id, key)}
          />
        </div>
      );
    } else {
      // Display the published render (fitted font + float + crop), then layer
      // interaction zones: photo top-right (tray/re-crop), text elsewhere (edit).
      inner = (
        <div className="relative w-full h-full">
          <LWrapBlock block={block} fontClass={fontClass} textColor={theme?.textColor} />

          {/* Empty-state text hint — L-shaped, with a notch matching the photo
              (+ its float gaps) cut out of the top-right corner. */}
          {!hasText && (
            <div
              className="absolute pointer-events-none"
              style={{ left: PAD, top: PAD, bottom: PAD, right: PAD }}
            >
              <LWrapTextPlaceholder
                armed={selectedSource?.kind === 'text'}
                boxW={bw - 2 * PAD}
                boxH={bh - 2 * PAD}
                notchW={photoW + marginL}
                notchH={photoH + marginB}
              />
            </div>
          )}

          {/* Photo interaction zone — top-right float position */}
          <div
            onClick={(e) => { e.stopPropagation(); onActivate(block.id + ':photo'); }}
            className="absolute cursor-pointer rounded"
            style={{ top: PAD, right: PAD, width: photoW, height: photoH }}
          >
            {block.url ? (
              <div className="absolute top-1 left-1 z-20 flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenTray(block.id); }}
                  className="p-1 rounded-full bg-white/80 shadow-sm hover:bg-white transition-colors"
                  title="Replace photo"
                >
                  <Camera className="w-3.5 h-3.5 text-foreground/70" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onReCrop(block.id); }}
                  className="p-1 rounded-full bg-white/80 shadow-sm hover:bg-white transition-colors"
                  title="Re-frame"
                >
                  <Crop className="w-3.5 h-3.5 text-foreground/70" />
                </button>
              </div>
            ) : (
              // No photo: offer the photo placeholder OR a one-click escape to the
              // text-only template, so a genuinely photo-less l-wrap doesn't keep an
              // empty reserved corner forever.
              <div className="w-full h-full flex flex-col gap-1">
                <div className="flex-1 min-h-0">
                  <SlotPlaceholder kind="photo" armed={selectedSource?.kind === 'photo'} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onConvertToTextOnly(block.id); }}
                  title="No photo here? Switch this page to the full-width text-only layout."
                  className="shrink-0 text-[11px] text-muted-foreground/70 hover:text-foreground underline decoration-dotted underline-offset-2 transition-colors"
                >
                  Use text-only instead
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
  } else if (block.type === 'text') {
    if (isEditing) {
      inner = (
        <div className="relative w-full h-full">
          <RichTextEditor
            block={block}
            fontClass={fontClass}
            textColor={theme?.textColor}
            onReady={onEditorReady}
            onStopEdit={(content) => onStopEdit(block.id, content)}
          />
          <FontPicker
            activeFontKey={activeFontKey}
            hasOverride={!!block.fontFamily}
            onChange={(key) => onFontChange(block.id, key)}
          />
        </div>
      );
    } else {
      const hasText = contentToPlainText(block.content).trim().length > 0;
      inner = hasText
        ? <RenderedText block={block} fontClass={fontClass} textColor={theme?.textColor} />
        : <SlotPlaceholder kind="text" armed={clickMatches} />;
    }
  } else {
    inner = block.url ? (
      <div className="relative w-full h-full overflow-hidden">
        <SlotImage url={block.url} crop={block.crop} label={block.label} className="w-full h-full object-cover" />
        <div className="absolute top-1.5 left-1.5 z-20 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenTray(block.id); }}
            className="p-1 rounded-full bg-white/80 shadow-sm hover:bg-white transition-colors"
            title="Replace photo"
          >
            <Camera className="w-3.5 h-3.5 text-foreground/70" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReCrop(block.id); }}
            className="p-1 rounded-full bg-white/80 shadow-sm hover:bg-white transition-colors"
            title="Re-frame"
          >
            <Crop className="w-3.5 h-3.5 text-foreground/70" />
          </button>
        </div>
      </div>
    ) : (
      <SlotPlaceholder kind="photo" armed={clickMatches} />
    );
  }

  const ring = (isOver && dragMatches) ? 'ring-2 ring-color-highlight ring-offset-1' : '';

  return (
    <div
      ref={setNodeRef}
      onClick={isEditing ? undefined : () => onActivate(block.id)}
      style={blockBoxStyle(block)}
      className={`${ring} ${isEditing ? '' : 'cursor-pointer'} rounded`}
    >
      {inner}
    </div>
  );
}
