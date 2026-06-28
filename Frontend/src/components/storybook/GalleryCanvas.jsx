import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { contentToPlainText } from '@/lib/tiptap';
import { SlotImage } from '@/lib/bookCanvas';
import RichTextEditor from '@/components/storybook/RichTextEditor';
import { Camera, Crop, Image as ImageIcon } from 'lucide-react';

// "More from …" gallery page — a layout-system page type, same contract as MomentHeroCanvas:
// drawn at the 600×800 virtual canvas (position:absolute/inset:0), it IGNORES block x/y and lays
// out its own fixed design, pulling content by role id via blk('title' | 'subtitle' | 'photoN' | 'capN').
//
// CONTRACT: the `gallery` template in storybookTemplates.js must define blocks with ids
// `title`, `subtitle`, `photo1`..`photo4`, `cap1`..`cap4` — keep them in sync (renaming an id
// silently drops its zone). Photos fill from the photo tray today; sv2-s5/s7 wires it to
// first_time_photos data. Up to 4 photos; in read/PDF only filled cells show (adaptive grid).
//
// Builder-only props (all undefined in read-only StorybookTab / PDF) make text/photo zones editable.

const GOLD = '#C2A36B';

// Registers an @dnd-kit drop target. Builder mode only (DndContext present there).
function DroppableZone({ id, type, onClick, style, children }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type } });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        ...style,
        ...(isOver ? { outline: '2px solid rgba(217,123,138,0.75)', outlineOffset: 2, borderRadius: 4 } : {}),
      }}
    >
      {children}
    </div>
  );
}

function ZoneText({ block, placeholder, style }) {
  const text = contentToPlainText(block?.content || '').trim();
  if (text) return <span style={style}>{text}</span>;
  return <span style={{ ...style, opacity: 0.3, fontStyle: 'italic' }}>{placeholder}</span>;
}

function TextZone({ block, isEditing, isBuilder, onActivate, onStopEdit, onEditorReady, fontClass, children, style }) {
  if (isEditing && block) {
    return (
      <div style={{ ...style, position: 'relative', minHeight: 20 }}>
        <RichTextEditor
          block={block}
          fontClass={fontClass || 'font-sans'}
          onReady={onEditorReady}
          onStopEdit={(content) => onStopEdit?.(block.id, content)}
        />
      </div>
    );
  }
  if (isBuilder && block?.id) {
    return (
      <div style={{ ...style, cursor: 'pointer' }} onClick={() => onActivate?.(block.id)}>
        {children}
      </div>
    );
  }
  return <div style={style}>{children}</div>;
}

export default function GalleryCanvas({
  blocks = [],
  theme,
  editingBlockId,
  onActivate,
  onStopEdit,
  onEditorReady,
  onOpenTray,
  onReCrop,
}) {
  const isBuilder = !!onActivate;
  function blk(id) { return blocks.find(b => b.id === id); }
  const editing = (id) => id !== undefined && editingBlockId === id;

  const bg  = theme?.bg ?? '#FBF7EF';
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';
  const sub = theme?.isDark ? (theme.textColor ?? '#cdd2ee') : '#A07860';

  const title    = blk('title');
  const subtitle = blk('subtitle');

  const cells = [1, 2, 3, 4].map(n => ({
    photo:   blk(`photo${n}`),
    caption: blk(`cap${n}`),
  }));

  // In read/PDF, only render cells that have a photo. In builder, show all 4 so they can be filled.
  const visibleCells = isBuilder ? cells : cells.filter(c => c.photo?.url);

  function PhotoCell({ photo, caption }) {
    const photoInner = photo?.url ? (
      <>
        <SlotImage url={photo.url} crop={photo.crop} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {isBuilder && (
          <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 20, display: 'flex', gap: 4 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenTray?.(photo.id); }}
              style={{ padding: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex' }}
              title="Replace photo"
            >
              <Camera style={{ width: 12, height: 12, color: '#444' }} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReCrop?.(photo.id); }}
              style={{ padding: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex' }}
              title="Re-frame"
            >
              <Crop style={{ width: 12, height: 12, color: '#444' }} />
            </button>
          </div>
        )}
      </>
    ) : (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <ImageIcon style={{ width: 26, height: 26, color: 'rgba(120,120,120,0.4)' }} />
        {isBuilder && <span style={{ fontSize: 10, color: 'rgba(120,120,120,0.6)', textAlign: 'center', padding: '0 10px' }}>Drop a photo or tap</span>}
      </div>
    );

    const slotStyle = {
      width: '100%',
      aspectRatio: '1 / 1',
      position: 'relative',
      overflow: 'hidden',
      background: '#E7E2D8',
      borderRadius: 6,
      cursor: (isBuilder && !photo?.url) ? 'pointer' : undefined,
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isBuilder && photo?.id ? (
          <DroppableZone id={photo.id} type="photo" onClick={!photo?.url ? () => onActivate?.(photo.id) : undefined} style={slotStyle}>
            {photoInner}
          </DroppableZone>
        ) : (
          <div style={slotStyle}>{photoInner}</div>
        )}

        {/* Caption — hidden in read/PDF when empty */}
        {(isBuilder || contentToPlainText(caption?.content || '').trim()) && (
          <TextZone
            block={caption}
            isEditing={editing(caption?.id)}
            isBuilder={isBuilder}
            onActivate={onActivate}
            onStopEdit={onStopEdit}
            onEditorReady={onEditorReady}
            fontClass="font-sans"
            style={{ textAlign: 'center' }}
          >
            <ZoneText block={caption} placeholder="Caption" style={{ fontSize: 11, fontStyle: 'italic', color: sub, display: 'block' }} />
          </TextZone>
        )}
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      padding: '48px 44px 40px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: "'Lato', sans-serif",
    }}>
      {/* Section label (chrome) */}
      <div style={{
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.26em',
        textTransform: 'uppercase',
        color: GOLD,
        flexShrink: 0,
      }}>
        More Moments
      </div>

      {/* Title (role block) */}
      <TextZone
        block={title}
        isEditing={editing(title?.id)}
        isBuilder={isBuilder}
        onActivate={onActivate}
        onStopEdit={onStopEdit}
        onEditorReady={onEditorReady}
        fontClass="font-playf"
        style={{ textAlign: 'center', marginTop: 10, flexShrink: 0 }}
      >
        <ZoneText
          block={title}
          placeholder="More from this moment"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, lineHeight: 1.18, color: ink, display: 'block' }}
        />
      </TextZone>

      {/* Subtitle (role block) */}
      <TextZone
        block={subtitle}
        isEditing={editing(subtitle?.id)}
        isBuilder={isBuilder}
        onActivate={onActivate}
        onStopEdit={onStopEdit}
        onEditorReady={onEditorReady}
        fontClass="font-sans"
        style={{ textAlign: 'center', marginTop: 4, flexShrink: 0 }}
      >
        <ZoneText block={subtitle} placeholder="A few more snapshots" style={{ fontSize: 13, fontStyle: 'italic', color: sub, display: 'block' }} />
      </TextZone>

      {/* Divider (chrome) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '16px 0 20px', flexShrink: 0 }}>
        <div style={{ height: 1, width: 48, background: GOLD, opacity: 0.35 }} />
        <span style={{ fontSize: 12, color: GOLD, lineHeight: 1 }}>♥</span>
        <div style={{ height: 1, width: 48, background: GOLD, opacity: 0.35 }} />
      </div>

      {/* Photo grid — adaptive: 1 photo = single column, otherwise 2 columns */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: visibleCells.length <= 1 ? '1fr' : '1fr 1fr',
        gap: 18,
        alignContent: 'start',
      }}>
        {visibleCells.map((c, i) => <PhotoCell key={c.photo?.id || i} photo={c.photo} caption={c.caption} />)}
      </div>
    </div>
  );
}
