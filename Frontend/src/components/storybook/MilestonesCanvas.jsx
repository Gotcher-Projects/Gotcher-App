import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { contentToPlainText } from '@/lib/tiptap';
import { SlotImage, CANVAS_W, CANVAS_H } from '@/lib/bookCanvas';
import { MAX_MILESTONE_ROWS, seededMilestoneDate } from '@/lib/milestonesPage';
import RichTextEditor from '@/components/storybook/RichTextEditor';
import { Camera, Image as ImageIcon } from 'lucide-react';

// "How You Grew" milestones page (sv2-s6.5) — HYBRID prefill + fill, Panel F "polaroid scatter".
// Same render contract as MomentHeroCanvas/BumpCanvas: drawn at the 600×800 canvas, IGNORES block
// x/y, pulls content by role id. Layout: title + divider top-left, the milestone list down a left
// column, two tilted polaroid frames in the right corners.
//   - NAMES: data-driven from `achievedMilestones` (pageData) — not blocks.
//   - DATES: prefill — blk('date0'..'date4') override if edited, else seed-on-display from the
//     achieved date (lib/milestonesPage). Editable in the builder.
//   - PHOTOS: fill — blk('photo1'|'photo2') + script caption blk('cap1'|'cap2'); empty slots show a
//     drop frame in the builder and are hidden in the read/PDF view (so the page reads list-only).
// html2canvas: the polaroids use transform:rotate + box-shadow on real positioned divs (no
// pseudo-elements, no mask-image) so they export cleanly.

const GOLD = '#C2A36B';
const POLAROID_PAD = 9;

// The display slot MUST render at the exact aspect the photo was cropped to, or SlotImage's cropStyle
// mis-fits the stored crop (clipping). The crop modal uses `block.slotAR ?? width/height` (see
// ScrapbookBuilder.placePhotoIntoSlot) — so derive the slot aspect from the block the same way. This
// self-heals pages saved before `slotAR` was added to the template (their blocks fall back to geometry).
function slotAspectOf(block) {
  if (block?.slotAR) return block.slotAR;
  if (block?.width && block?.height) return (block.width * CANVAS_W) / (block.height * CANVAS_H);
  return 1.2;
}

function DroppableZone({ id, onClick, style, children }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'photo' } });
  return (
    <div ref={setNodeRef} onClick={onClick} style={{ ...style, ...(isOver ? { outline: '2px solid rgba(217,123,138,0.75)', outlineOffset: 2 } : {}) }}>
      {children}
    </div>
  );
}

export default function MilestonesCanvas({
  blocks = [], theme, achievedMilestones = [],
  editingBlockId, onActivate, onStopEdit, onEditorReady, onOpenTray,
}) {
  const isBuilder = !!onActivate;
  function blk(id) { return blocks.find(b => b.id === id); }
  const editing = (id) => id !== undefined && editingBlockId === id;

  const bg  = theme?.bg ?? '#FBF7EF';
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';
  const subColor = sub(theme);

  const rows = (achievedMilestones || []).slice(0, MAX_MILESTONE_ROWS);

  // One milestone row: tick + name (data) + editable date (prefill).
  const renderRow = (m, i) => {
    const dateBlock = blk(`date${i}`);
    const override = contentToPlainText(dateBlock?.content || '').trim();
    const seeded = seededMilestoneDate(achievedMilestones, i);
    const shown = override || seeded;

    return (
      <div key={m.key || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '9px 0', borderBottom: '1px dashed rgba(160,120,96,0.22)' }}>
        <div style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: '50%', background: 'rgba(123,168,107,0.18)', color: '#7BA86B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, marginTop: 1 }}>✓</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: ink, lineHeight: 1.2 }}>{m.name}</div>
          {/* Editable date */}
          {editing(dateBlock?.id) ? (
            <div style={{ position: 'relative', minHeight: 20, maxWidth: 160 }}>
              <RichTextEditor block={dateBlock} fontClass="font-sans" textColor={subColor} onReady={onEditorReady} onStopEdit={(c) => onStopEdit?.(dateBlock.id, c)} />
            </div>
          ) : isBuilder ? (
            <div onClick={() => onActivate?.(dateBlock?.id)} style={{ cursor: 'pointer', display: 'inline-block', marginTop: 2 }}>
              {shown
                ? <span style={{ fontSize: 12.5, color: subColor, letterSpacing: '0.02em' }}>{shown} <span style={{ color: '#D97B8A' }}>✎</span></span>
                : <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 100, border: '1px dashed rgba(217,123,138,0.6)', background: 'rgba(217,123,138,0.06)', fontSize: 11, fontStyle: 'italic', color: '#D97B8A' }}>+ add date</span>}
            </div>
          ) : (
            shown ? <div style={{ fontSize: 12.5, color: subColor, marginTop: 2, letterSpacing: '0.02em' }}>{shown}</div> : null
          )}
        </div>
      </div>
    );
  };

  // One polaroid (white frame + photo slot + optional script caption). Hidden in read/PDF when empty.
  const renderPolaroid = (photoId, capId, frameStyle) => {
    const photo = blk(photoId);
    const cap = blk(capId);
    if (!isBuilder && !photo?.url) return null; // degrade to list-only when no photo

    // Slot height derives from the frame width so the slot aspect == the aspect the photo was cropped to.
    const slotH = Math.round((frameStyle.width - POLAROID_PAD * 2) / slotAspectOf(photo));
    const slotStyle = { position: 'relative', width: '100%', height: slotH, overflow: 'hidden', background: '#C5CFD6', cursor: (isBuilder && !photo?.url) ? 'pointer' : undefined };
    const inner = (
      <>
        {photo?.url ? (
          <SlotImage url={photo.url} crop={photo.crop} label={photo.label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ImageIcon style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.55)' }} />
            {isBuilder && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', textAlign: 'center', padding: '0 10px' }}>Drop a photo</span>}
          </div>
        )}
        {isBuilder && photo?.url && (
          <button onClick={(e) => { e.stopPropagation(); onOpenTray?.(photo.id); }} title="Replace photo"
            style={{ position: 'absolute', top: 6, left: 6, zIndex: 20, padding: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <Camera style={{ width: 13, height: 13, color: '#444' }} />
          </button>
        )}
      </>
    );

    const capText = contentToPlainText(cap?.content || '').trim();
    return (
      <div style={{ ...frameStyle, background: '#fff', padding: '9px 9px 8px', boxShadow: '0 8px 20px rgba(0,0,0,0.18)' }}>
        {isBuilder && photo?.id
          ? <DroppableZone id={photo.id} onClick={!photo?.url ? () => onActivate?.(photo.id) : undefined} style={slotStyle}>{inner}</DroppableZone>
          : <div style={slotStyle}>{inner}</div>}
        {/* Optional script caption */}
        <div style={{ textAlign: 'center', marginTop: 6, minHeight: 18 }}>
          {editing(cap?.id) ? (
            <div style={{ position: 'relative', minHeight: 18 }}>
              <RichTextEditor block={cap} fontClass="font-sans" onReady={onEditorReady} onStopEdit={(c) => onStopEdit?.(cap.id, c)} />
            </div>
          ) : isBuilder ? (
            <div onClick={() => onActivate?.(cap?.id)} style={{ cursor: 'pointer' }}>
              {capText
                ? <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: 18, color: '#A07860' }}>{capText}</span>
                : <span style={{ fontSize: 11, fontStyle: 'italic', color: '#D97B8A' }}>+ caption</span>}
            </div>
          ) : (
            capText ? <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: 18, color: '#A07860' }}>{capText}</span> : null
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      padding: '48px 48px 44px', boxSizing: 'border-box', overflow: 'hidden',
      fontFamily: "'Lato', sans-serif",
    }}>
      {/* Section label */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: GOLD }}>
        You at One
      </div>

      {/* Title */}
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: ink, marginTop: 8 }}>
        How You Grew
      </div>

      {/* Divider (left-aligned) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 8px' }}>
        <div style={{ height: 1, width: 44, background: GOLD, opacity: 0.4 }} />
        <span style={{ fontSize: 12, color: GOLD, lineHeight: 1 }}>♥</span>
      </div>

      {/* Milestone list — left column */}
      <div style={{ width: 320, maxWidth: '56%' }}>
        {rows.length > 0
          ? rows.map(renderRow)
          : <div style={{ fontSize: 14, fontStyle: 'italic', color: subColor, marginTop: 10 }}>
              {isBuilder ? 'Milestones you mark in the Milestones tab will appear here.' : ''}
            </div>}
      </div>

      {/* Two tilted polaroids — right corners */}
      {renderPolaroid('photo1', 'cap1', { position: 'absolute', top: 150, right: 40, width: 196, transform: 'rotate(4deg)' })}
      {renderPolaroid('photo2', 'cap2', { position: 'absolute', bottom: 64, right: 56, width: 206, transform: 'rotate(-5deg)' })}
    </div>
  );
}

function sub(theme) { return theme?.isDark ? (theme.textColor ?? '#cdd2ee') : '#A07860'; }
