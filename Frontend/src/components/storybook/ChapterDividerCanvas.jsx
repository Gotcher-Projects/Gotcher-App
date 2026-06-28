import React from 'react';
import { contentToPlainText } from '@/lib/tiptap';
import RichTextEditor from '@/components/storybook/RichTextEditor';

// Chapter-divider page (sv2-s6) — opens a section of the guided book. Same contract as
// LetterCanvas: drawn at the 600×800 virtual canvas (position:absolute/inset:0), it IGNORES block
// x/y and lays out its own fixed design, pulling content by role id via blk('label'|'title'|'subtitle').
// The decoratives are absolutely-positioned spans (html2canvas-safe — no pseudo-elements / mask-image).
//
// CONTRACT: the `chapter_divider` template in storybookTemplates.js must define blocks with ids
// `label`, `title`, `subtitle` — keep them in sync (renaming an id silently drops its zone).

const GOLD = '#C2A36B';

function ZoneText({ block, placeholder, style }) {
  const text = contentToPlainText(block?.content || '').trim();
  if (text) return <span style={style}>{text}</span>;
  return <span style={{ ...style, opacity: 0.3, fontStyle: 'italic' }}>{placeholder}</span>;
}

function TextZone({ block, isEditing, isBuilder, onActivate, onStopEdit, onEditorReady, fontClass, children, style }) {
  if (isEditing && block) {
    return (
      <div style={{ ...style, position: 'relative', minHeight: 24 }}>
        <RichTextEditor block={block} fontClass={fontClass || 'font-sans'} onReady={onEditorReady} onStopEdit={(content) => onStopEdit?.(block.id, content)} />
      </div>
    );
  }
  if (isBuilder && block?.id) {
    return <div style={{ ...style, cursor: 'pointer' }} onClick={() => onActivate?.(block.id)}>{children}</div>;
  }
  return <div style={style}>{children}</div>;
}

// Fixed floating decoratives — positioned spans (capture cleanly in html2canvas).
const DECOR = [
  { top: 70,  left: 56,  size: 30, ch: '✿' },
  { top: 130, right: 70, size: 20, ch: '❀' },
  { bottom: 150, left: 80, size: 24, ch: '✦' },
  { bottom: 80, right: 64, size: 34, ch: '✿' },
];

export default function ChapterDividerCanvas({
  blocks = [], theme,
  editingBlockId, onActivate, onStopEdit, onEditorReady,
}) {
  const isBuilder = !!onActivate;
  function blk(id) { return blocks.find(b => b.id === id); }
  const editing = (id) => id !== undefined && editingBlockId === id;

  const bg  = theme?.bg ?? '#FBF7EF';
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';

  const label    = blk('label');
  const title    = blk('title');
  const subtitle = blk('subtitle');

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 48px', boxSizing: 'border-box', overflow: 'hidden',
      fontFamily: "'Lato', sans-serif", textAlign: 'center',
    }}>
      {/* Decoratives */}
      {DECOR.map((d, i) => (
        <span key={i} style={{
          position: 'absolute', top: d.top, bottom: d.bottom, left: d.left, right: d.right,
          fontSize: d.size, color: GOLD, opacity: 0.45, lineHeight: 1, pointerEvents: 'none',
        }}>{d.ch}</span>
      ))}

      {/* Chapter label */}
      <TextZone block={label} isEditing={editing(label?.id)} isBuilder={isBuilder}
        onActivate={onActivate} onStopEdit={onStopEdit} onEditorReady={onEditorReady} fontClass="font-sans"
        style={{ flexShrink: 0 }}>
        <ZoneText block={label} placeholder="Chapter One"
          style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: sub(theme) }} />
      </TextZone>

      {/* Icon badge */}
      <div style={{
        width: 64, height: 64, borderRadius: '50%', background: 'rgba(217,123,138,0.14)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '20px 0', flexShrink: 0,
      }}>🌿</div>

      {/* Title */}
      <TextZone block={title} isEditing={editing(title?.id)} isBuilder={isBuilder}
        onActivate={onActivate} onStopEdit={onStopEdit} onEditorReady={onEditorReady} fontClass="font-playf"
        style={{ flexShrink: 0 }}>
        <ZoneText block={title} placeholder="Chapter Title"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 40, fontWeight: 700, lineHeight: 1.12, color: ink, display: 'block' }} />
      </TextZone>

      {/* Subtitle */}
      <TextZone block={subtitle} isEditing={editing(subtitle?.id)} isBuilder={isBuilder}
        onActivate={onActivate} onStopEdit={onStopEdit} onEditorReady={onEditorReady} fontClass="font-merri"
        style={{ marginTop: 16, flexShrink: 0 }}>
        <ZoneText block={subtitle} placeholder="a few words to set the scene"
          style={{ fontFamily: "'Dancing Script', cursive", fontSize: 22, color: sub(theme), display: 'block' }} />
      </TextZone>
    </div>
  );
}

function sub(theme) { return theme?.isDark ? (theme.textColor ?? '#cdd2ee') : '#A07860'; }
