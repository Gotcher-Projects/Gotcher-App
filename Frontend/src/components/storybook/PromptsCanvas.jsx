import React from 'react';
import { contentToPlainText } from '@/lib/tiptap';
import RichTextEditor from '@/components/storybook/RichTextEditor';

// "All About You" prompt page (sv2-s6) — fixed preset labels (locked 2026-06-27) with editable
// value lines the parent fills in. Same contract as LetterCanvas: drawn at the 600×800 virtual
// canvas, IGNORES block x/y, pulls each answer by role id via blk('val0'..'val4').
//
// CONTRACT: the `prompts` template must define value blocks with ids `val0`..`val4` (one per label
// below) — keep PROMPT_LABELS and the template block ids the same length & order.

const GOLD = '#C2A36B';

// Fixed preset labels — the "guided" part. Order maps to block ids val0..valN.
export const PROMPT_LABELS = [
  'Your nickname',
  'Favourite food',
  'You love',
  'What makes you laugh',
  'Your best friend',
];

function ValueZone({ block, isEditing, isBuilder, onActivate, onStopEdit, onEditorReady, ink }) {
  const text = contentToPlainText(block?.content || '').trim();
  if (isEditing && block) {
    return (
      <div style={{ position: 'relative', minHeight: 22 }}>
        <RichTextEditor block={block} fontClass="font-merri" onReady={onEditorReady} onStopEdit={(content) => onStopEdit?.(block.id, content)} />
      </div>
    );
  }
  const filled = <span style={{ fontFamily: "'Merriweather', Georgia, serif", fontStyle: 'italic', fontSize: 17, color: ink }}>{text}</span>;
  // Builder: make the empty slot an obvious tap target — a dashed "field" with a hint, in the
  // app's highlight colour, rather than a bare underline the user can't tell is clickable.
  if (isBuilder && block?.id) {
    const empty = (
      <span style={{
        display: 'inline-block', minWidth: '60%', padding: '3px 8px', borderRadius: 6,
        border: '1px dashed rgba(217,123,138,0.6)', background: 'rgba(217,123,138,0.06)',
        fontStyle: 'italic', fontSize: 13, color: '#D97B8A',
      }}>+ Tap to add</span>
    );
    return (
      <div style={{ cursor: 'pointer', minHeight: 24 }} onClick={() => onActivate?.(block.id)}>
        {text ? filled : empty}
      </div>
    );
  }
  // Published / PDF: a clean underline when empty (no hint chrome).
  const published = text
    ? filled
    : <span style={{ display: 'block', height: 1, borderBottom: '1.5px solid rgba(74,55,40,0.18)', width: '80%' }} />;
  return <div style={{ minHeight: 22 }}>{published}</div>;
}

export default function PromptsCanvas({
  blocks = [], theme,
  editingBlockId, onActivate, onStopEdit, onEditorReady,
}) {
  const isBuilder = !!onActivate;
  function blk(id) { return blocks.find(b => b.id === id); }
  const editing = (id) => id !== undefined && editingBlockId === id;

  const bg  = theme?.bg ?? '#FBF7EF';
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      display: 'flex', flexDirection: 'column',
      padding: '48px 52px 44px', boxSizing: 'border-box', overflow: 'hidden',
      fontFamily: "'Lato', sans-serif",
    }}>
      {/* Section label */}
      <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: GOLD, flexShrink: 0 }}>
        At One Year Old
      </div>

      {/* Title */}
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: ink, marginTop: 10, textAlign: 'center', flexShrink: 0 }}>
        All About You
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '16px 0 26px', flexShrink: 0 }}>
        <div style={{ height: 1, width: 48, background: GOLD, opacity: 0.35 }} />
        <span style={{ fontSize: 12, color: GOLD, lineHeight: 1 }}>♥</span>
        <div style={{ height: 1, width: 48, background: GOLD, opacity: 0.35 }} />
      </div>

      {/* Prompt rows */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
        {PROMPT_LABELS.map((labelText, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: sub(theme), marginBottom: 5 }}>
              {labelText}
            </div>
            <ValueZone block={blk(`val${i}`)} isEditing={editing(`val${i}`)} isBuilder={isBuilder}
              onActivate={onActivate} onStopEdit={onStopEdit} onEditorReady={onEditorReady} ink={ink} />
          </div>
        ))}
      </div>
    </div>
  );
}

function sub(theme) { return theme?.isDark ? (theme.textColor ?? '#cdd2ee') : '#A07860'; }
