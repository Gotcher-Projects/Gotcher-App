import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { contentToPlainText } from '@/lib/tiptap';
import { sizeForWeek } from '@/lib/pregnancySizes';
import RichTextEditor from '@/components/storybook/RichTextEditor';
import { Camera, Image as ImageIcon } from 'lucide-react';

// Bump page (sv2-s6) — a 2-up: two bump photos + a shared note, with a small AUTO week→size tag
// layered bottom-left on each photo (from the 37-row pregnancySizes dataset). Same render contract
// as MomentHeroCanvas: drawn at the 600×800 canvas, IGNORES block x/y, pulls content by role id via
// blk('title'|'photo1'|'week1'|'photo2'|'week2'|'note'). The guided book uses this template twice —
// "The Bump — Early Days" and "The Bump — Full Bloom" (sv2-s8) — so a book curates to ~4 bump photos.
//
// The size tag shows ONLY when its week field parses to a number. In the S8 data-driven path the
// weeks come from bump_photos; here in the scrapbook they're typed into the editable week zones.

const GOLD = '#C2A36B';
// Fixed photo height (not flex:1) — html2canvas computes flex vertical heights unreliably, which left
// the absolutely-positioned size tag mis-placed/clipped in the PDF. An explicit height fixes that.
const PHOTO_H = 415;

function ZoneText({ block, placeholder, style }) {
  const text = contentToPlainText(block?.content || '').trim();
  if (text) return <span style={style}>{text}</span>;
  return <span style={{ ...style, opacity: 0.3, fontStyle: 'italic' }}>{placeholder}</span>;
}

function TextZone({ block, isEditing, isBuilder, onActivate, onStopEdit, onEditorReady, fontClass, textColor, children, style }) {
  if (isEditing && block) {
    return (
      <div style={{ ...style, position: 'relative', minHeight: 20 }}>
        <RichTextEditor block={block} fontClass={fontClass || 'font-sans'} textColor={textColor} onReady={onEditorReady} onStopEdit={(content) => onStopEdit?.(block.id, content)} />
      </div>
    );
  }
  if (isBuilder && block?.id) {
    return <div style={{ ...style, cursor: 'pointer' }} onClick={() => onActivate?.(block.id)}>{children}</div>;
  }
  return <div style={style}>{children}</div>;
}

function DroppableZone({ id, onClick, style, children }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'photo' } });
  return (
    <div ref={setNodeRef} onClick={onClick} style={{ ...style, ...(isOver ? { outline: '2px solid rgba(217,123,138,0.75)', outlineOffset: 2 } : {}) }}>
      {children}
    </div>
  );
}

// Parse a week field ("28", "Week 28", "wk 30") → integer week, or null.
function parseWeek(block) {
  const m = contentToPlainText(block?.content || '').match(/\d{1,2}/);
  if (!m) return null;
  const w = parseInt(m[0], 10);
  return w >= 1 && w <= 45 ? w : null;
}

export default function BumpCanvas({
  blocks = [], theme,
  editingBlockId, onActivate, onStopEdit, onEditorReady, onOpenTray, onReCrop,
}) {
  const isBuilder = !!onActivate;
  function blk(id) { return blocks.find(b => b.id === id); }
  const editing = (id) => id !== undefined && editingBlockId === id;

  const bg  = theme?.bg ?? '#FBF7EF';
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';

  const title = blk('title');
  const note  = blk('note');

  // Called as a plain function (not <PhotoColumn/>) so the columns reconcile as inline children of
  // BumpCanvas across renders. As a nested *component* it got a new identity every render → React
  // remounted the subtree → the week field's Tiptap editor lost focus and couldn't be edited.
  const renderPhotoColumn = (photoId, weekId) => {
    const photo = blk(photoId);
    const week  = blk(weekId);
    const wk = parseWeek(week);
    const size = wk != null ? sizeForWeek(wk) : null;

    const slotStyle = { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 10, background: '#C5CFD6', cursor: (isBuilder && !photo?.url) ? 'pointer' : undefined };
    const inner = (
      <>
        {photo?.url ? (
          // object-fit:cover fills the tall bump slot. We intentionally don't apply the stored crop
          // letterbox here — cropStyle's height:auto left a grey band under landscape-cropped photos.
          <img src={photo.url} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ImageIcon style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.55)' }} />
            {isBuilder && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', textAlign: 'center', padding: '0 12px' }}>Drop a bump photo</span>}
          </div>
        )}
        {isBuilder && photo?.url && (
          <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 20, display: 'flex', gap: 4 }}>
            <button onClick={(e) => { e.stopPropagation(); onOpenTray?.(photo.id); }} title="Replace photo"
              style={{ padding: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <Camera style={{ width: 13, height: 13, color: '#444' }} />
            </button>
          </div>
        )}
      </>
    );

    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: PHOTO_H, position: 'relative', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>
          {isBuilder && photo?.id
            ? <DroppableZone id={photo.id} onClick={!photo?.url ? () => onActivate?.(photo.id) : undefined} style={slotStyle}>{inner}</DroppableZone>
            : <div style={slotStyle}>{inner}</div>}
        </div>
        {/* Caption under the photo — week (editable) + the auto size comparison as a normal text
            line (no overlaid pill, so nothing to clip in the PDF). */}
        <div style={{ marginTop: 12, textAlign: 'center', minHeight: 26 }}>
          {editing(weekId) ? (
            <div style={{ position: 'relative', minHeight: 24, maxWidth: 130, margin: '0 auto' }}>
              <RichTextEditor block={week} fontClass="font-sans" textColor={ink} onReady={onEditorReady} onStopEdit={(c) => onStopEdit?.(week.id, c)} />
            </div>
          ) : isBuilder ? (
            <div onClick={() => onActivate?.(week?.id)} style={{ cursor: 'pointer', display: 'inline-block' }}>
              {wk != null
                ? <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 700, color: ink }}>Week {wk} <span style={{ color: '#D97B8A', fontWeight: 400, fontFamily: "'Lato', sans-serif" }}>✎</span></span>
                : <span style={{
                    display: 'inline-block', padding: '4px 12px', borderRadius: 100,
                    border: '1px dashed rgba(217,123,138,0.6)', background: 'rgba(217,123,138,0.06)',
                    fontSize: 12, fontStyle: 'italic', color: '#D97B8A',
                  }}>+ Add week</span>}
            </div>
          ) : (
            wk != null ? <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 700, color: ink }}>Week {wk}</span> : null
          )}

          {/* Auto size comparison — derived from the week, plain text (no pill) */}
          {size && (
            <div style={{ marginTop: 4, fontSize: 12.5, fontStyle: 'italic', color: sub(theme), lineHeight: 1.4 }}>
              you were the size of {size.label} <span style={{ fontStyle: 'normal' }}>{size.emoji}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '44px 44px 40px', boxSizing: 'border-box', overflow: 'hidden',
      fontFamily: "'Lato', sans-serif",
    }}>
      {/* Section label */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: GOLD, flexShrink: 0 }}>
        The Bump Grows
      </div>

      {/* Editable title */}
      <TextZone block={title} isEditing={editing(title?.id)} isBuilder={isBuilder}
        onActivate={onActivate} onStopEdit={onStopEdit} onEditorReady={onEditorReady} fontClass="font-playf" textColor={ink}
        style={{ marginTop: 10, textAlign: 'center', flexShrink: 0 }}>
        <ZoneText block={title} placeholder="The Bump — Early Days"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: ink, display: 'block' }} />
      </TextZone>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '14px 0 18px', flexShrink: 0, width: '100%' }}>
        <div style={{ height: 1, flex: 1, background: GOLD, opacity: 0.3 }} />
        <span style={{ fontSize: 12, color: GOLD, lineHeight: 1 }}>♥</span>
        <div style={{ height: 1, flex: 1, background: GOLD, opacity: 0.3 }} />
      </div>

      {/* Two photos — fixed-height row (not flex:1) for predictable html2canvas layout */}
      <div style={{ width: '100%', display: 'flex', gap: 16, flexShrink: 0 }}>
        {renderPhotoColumn('photo1', 'week1')}
        {renderPhotoColumn('photo2', 'week2')}
      </div>

      {/* Note */}
      <div style={{ width: '100%', marginTop: 20, background: '#FFF8E8', border: '1px solid #E5CB8A', borderRadius: 8, padding: '10px 14px', flexShrink: 0 }}>
        <TextZone block={note} isEditing={editing(note?.id)} isBuilder={isBuilder}
          onActivate={onActivate} onStopEdit={onStopEdit} onEditorReady={onEditorReady} fontClass="font-sans"
          style={{}}>
          <ZoneText block={note} placeholder={isBuilder ? 'Tap to write a note…' : ''}
            style={{ display: 'block', fontStyle: 'italic', fontSize: 13, lineHeight: 1.7, color: '#4A3728', whiteSpace: 'pre-wrap' }} />
        </TextZone>
      </div>
    </div>
  );
}

function sub(theme) { return theme?.isDark ? (theme.textColor ?? '#cdd2ee') : '#A07860'; }
