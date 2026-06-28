import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { contentToPlainText } from '@/lib/tiptap';
import { SlotImage } from '@/lib/bookCanvas';
import RichTextEditor from '@/components/storybook/RichTextEditor';
import { Camera, Crop, Image as ImageIcon } from 'lucide-react';

// Registers an @dnd-kit drop target. Must only be rendered inside a DndContext
// (i.e. in builder mode only — LayoutRenderer and PDF paths never render this).
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

// Read-only display of a text value. Falls back to `placeholder` (dimmed, italic).
function HeroText({ block, placeholder, style }) {
  const text = contentToPlainText(block?.content || '').trim();
  if (text) return <span style={style}>{text}</span>;
  return <span style={{ ...style, opacity: 0.3, fontStyle: 'italic' }}>{placeholder}</span>;
}

// Text zone: shows RichTextEditor when active, DroppableZone wrapper in builder, plain div in read-only.
function TextZone({ block, isEditing, isBuilder, onActivate, onStopEdit, onEditorReady, fontClass, children, style }) {
  if (isEditing && block) {
    return (
      <div style={{ ...style, position: 'relative', minHeight: 28 }}>
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
      <DroppableZone
        id={block.id}
        type="text"
        onClick={() => onActivate?.(block.id)}
        style={{ ...style, cursor: 'pointer' }}
      >
        {children}
      </DroppableZone>
    );
  }
  return <div style={style}>{children}</div>;
}

export default function MomentHeroCanvas({
  blocks = [],
  orientation = 'portrait',
  theme,
  // Builder-only props — all undefined in read-only (StorybookTab / PDF).
  editingBlockId,
  onActivate,
  onStopEdit,
  onEditorReady,
  onOpenTray,
  onReCrop,
}) {
  const isBuilder  = !!onActivate;
  const isPortrait = orientation !== 'landscape';

  // Background follows the active book theme; the title/date sit directly on it, so flip them
  // to the theme's light textColor on dark themes (Midnight). The polaroid/note-card content
  // keeps its own colors — it's drawn on its own light surfaces, independent of the theme bg.
  const pageBg     = theme?.bg ?? '#FDF6ED';
  const titleColor = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';
  const dateColor  = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#A07860';

  // CONTRACT: this layout is keyed to fixed role ids defined on the moment_hero
  // templates in storybookTemplates.js. Each blk('<role>') must match a block id
  // there — keep the two lists in sync (renaming an id silently drops its zone).
  function blk(id) { return blocks.find(b => b.id === id); }

  const badge  = blk('badge');
  const title  = blk('title');
  const date   = blk('date');
  const photo  = blk('photo');
  const note   = blk('note');
  const attrib = blk('attrib');

  const photoW = isPortrait ? 240 : 336;
  const photoH = isPortrait ? 320 : 252;
  const polBottomPad = isPortrait ? 46 : 42;
  const tilt = isPortrait ? 'rotate(1.8deg)' : 'rotate(-1.4deg)';

  const editing = (id) => id !== undefined && editingBlockId === id;

  // Photo slot inner content — extracted to avoid duplication between droppable/plain branches.
  const photoInner = (
    <>
      {photo?.url ? (
        <>
          <SlotImage url={photo.url} crop={photo.crop} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

          {isBuilder && (
            <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 20, display: 'flex', gap: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenTray?.(photo.id); }}
                style={{ padding: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Replace photo"
              >
                <Camera style={{ width: 14, height: 14, color: '#444' }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReCrop?.(photo.id); }}
                style={{ padding: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Re-frame"
              >
                <Crop style={{ width: 14, height: 14, color: '#444' }} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ImageIcon style={{ width: 32, height: 32, color: 'rgba(255,255,255,0.5)' }} />
          {isBuilder && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center', padding: '0 16px' }}>
              Drop a photo or tap to browse
            </span>
          )}
        </div>
      )}
    </>
  );

  const photoSlotStyle = {
    width: photoW,
    height: photoH,
    position: 'relative',
    overflow: 'hidden',
    background: '#C5CFD6',
    cursor: (isBuilder && !photo?.url) ? 'pointer' : undefined,
  };

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: pageBg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 32px 28px',
      fontFamily: "'Lato', sans-serif",
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', width: '100%', marginBottom: 26, flexShrink: 0 }}>

        {/* Badge pill */}
        <TextZone
          block={badge}
          isEditing={editing(badge?.id)}
          isBuilder={isBuilder}
          onActivate={onActivate}
          onStopEdit={onStopEdit}
          onEditorReady={onEditorReady}
          fontClass="font-sans"
          style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}
        >
          <span style={{
            display: 'inline-block',
            background: '#FBCFE8',
            color: '#9D174D',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            padding: '4px 14px',
            borderRadius: 100,
          }}>
            <HeroText block={badge} placeholder="FIRST TIME" style={{}} />
          </span>
        </TextZone>

        {/* Title */}
        <TextZone
          block={title}
          isEditing={editing(title?.id)}
          isBuilder={isBuilder}
          onActivate={onActivate}
          onStopEdit={onStopEdit}
          onEditorReady={onEditorReady}
          fontClass="font-playf"
          style={{ marginBottom: 6 }}
        >
          <HeroText
            block={title}
            placeholder={isBuilder ? 'Your title' : ''}
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 38,
              fontWeight: 700,
              color: titleColor,
              lineHeight: 1.1,
              display: 'block',
            }}
          />
        </TextZone>

        {/* Date */}
        <TextZone
          block={date}
          isEditing={editing(date?.id)}
          isBuilder={isBuilder}
          onActivate={onActivate}
          onStopEdit={onStopEdit}
          onEditorReady={onEditorReady}
          fontClass="font-sans"
          style={{}}
        >
          <HeroText
            block={date}
            placeholder={isBuilder ? 'Date' : ''}
            style={{ fontStyle: 'italic', fontSize: 13, color: dateColor, letterSpacing: '0.03em' }}
          />
        </TextZone>
      </div>

      {/* ── Polaroid ───────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, marginBottom: 22 }}>
        <div style={{
          background: '#FFFFFF',
          padding: `14px 14px ${polBottomPad}px`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.1)',
          transform: tilt,
          display: 'inline-block',
        }}>
          {/* Photo slot — droppable in builder, plain div in read-only */}
          {isBuilder && photo?.id ? (
            <DroppableZone
              id={photo.id}
              type="photo"
              onClick={!photo?.url ? () => onActivate?.(photo.id) : undefined}
              style={photoSlotStyle}
            >
              {photoInner}
            </DroppableZone>
          ) : (
            <div style={photoSlotStyle}>{photoInner}</div>
          )}

          {/* Caption strip — uses title text as the polaroid label */}
          <div style={{ paddingTop: 10, textAlign: 'center' }}>
            <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: 14, color: '#6B4F3A' }}>
              {contentToPlainText(title?.content || '').trim() || ' '}
            </span>
          </div>
        </div>
      </div>

      {/* ── Note card ──────────────────────────────────────────────────── */}
      <div style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        background: '#FFF8E8',
        border: '1px solid #E5CB8A',
        borderRadius: 10,
        padding: '14px 18px 12px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* NOTE label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9, flexShrink: 0 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4A017', flexShrink: 0 }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#B8860B' }}>Note</span>
        </div>

        {/* Note body */}
        <TextZone
          block={note}
          isEditing={editing(note?.id)}
          isBuilder={isBuilder}
          onActivate={onActivate}
          onStopEdit={onStopEdit}
          onEditorReady={onEditorReady}
          fontClass="font-sans"
          style={{ flex: 1, minHeight: 0, marginBottom: 10, overflow: 'hidden' }}
        >
          <HeroText
            block={note}
            placeholder={isBuilder ? 'Tap to write your note…' : ''}
            style={{ display: 'block', fontStyle: 'italic', fontSize: 12, lineHeight: 1.75, color: '#4A3728', whiteSpace: 'pre-wrap' }}
          />
        </TextZone>

        {/* Attribution */}
        <TextZone
          block={attrib}
          isEditing={editing(attrib?.id)}
          isBuilder={isBuilder}
          onActivate={onActivate}
          onStopEdit={onStopEdit}
          onEditorReady={onEditorReady}
          fontClass="font-sans"
          style={{ flexShrink: 0, textAlign: 'right' }}
        >
          <HeroText
            block={attrib}
            placeholder={isBuilder ? '— Your name' : ''}
            style={{ fontFamily: "'Dancing Script', cursive", fontSize: 16, color: '#7A5C4A' }}
          />
        </TextZone>
      </div>

      {/* ── Heart ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 18, right: 24, fontSize: 18, color: '#F9A8D4', lineHeight: 1, pointerEvents: 'none' }}>
        ♥
      </div>
    </div>
  );
}
