import React from 'react';
import { contentToPlainText, renderContentHTML } from '@/lib/tiptap';
import RichTextEditor from '@/components/storybook/RichTextEditor';

// Full-page letter renderer — a layout-system page type, same contract as MomentHeroCanvas:
// drawn at the 600×800 virtual canvas (position:absolute/inset:0), it IGNORES block x/y and lays
// out its own fixed design, pulling content by role id via blk('title' | 'body' | 'signature').
//
// Background follows the active book theme (theme.bg) so the page blends into the storybook
// instead of showing a fixed cream that clashes with non-Classic themes. The warm letter accents
// (gold divider, script signature) stay fixed — they're the letter's keepsake identity — but the
// body/title ink flips to the theme's light textColor on dark themes (e.g. Midnight) for legibility.
//
// CONTRACT: the `letter` template in storybookTemplates.js must define blocks with ids
// `title`, `body`, `signature` — keep them in sync (renaming an id silently drops its zone).
//
// Builder-only props (all undefined in read-only StorybookTab / PDF) make text zones editable.

const CREAM   = '#FBF7EF';  // fallback bg when no theme is supplied
const INK     = '#3A2E22';  // warm ink for light themes
const GOLD    = '#C2A36B';
const SCRIPT  = '#9A7B4F';

// Read-only text value with a dimmed italic placeholder fallback (matches MomentHeroCanvas).
function ZoneText({ block, placeholder, style }) {
  const text = contentToPlainText(block?.content || '').trim();
  if (text) return <span style={style}>{text}</span>;
  return <span style={{ ...style, opacity: 0.3, fontStyle: 'italic' }}>{placeholder}</span>;
}

// A text zone: RichTextEditor when editing, click-to-activate in builder, plain render otherwise.
// (No droppable — letter text is written, not dragged from memories.)
function TextZone({ block, isEditing, isBuilder, onActivate, onStopEdit, onEditorReady, fontClass, textColor, children, style }) {
  if (isEditing && block) {
    return (
      <div style={{ ...style, position: 'relative', minHeight: 24 }}>
        <RichTextEditor
          block={block}
          fontClass={fontClass || 'font-serif'}
          textColor={textColor}
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

export default function LetterCanvas({
  blocks = [],
  theme,
  // The small uppercase chrome line at the top. Defaults to the keepsake "A Letter to You";
  // guided pages pass their page label (e.g. "One Year of You", "A Letter Before You Arrived")
  // so each letter page reads distinctly instead of a fixed string (sv2-s7.5b).
  eyebrow = 'A Letter to You',
  // Builder-only props — all undefined in read-only (StorybookTab / PDF).
  editingBlockId,
  onActivate,
  onStopEdit,
  onEditorReady,
}) {
  const isBuilder = !!onActivate;
  function blk(id) { return blocks.find(b => b.id === id); }
  const editing = (id) => id !== undefined && editingBlockId === id;

  // Background blends into the active theme; ink flips to light text on dark themes.
  const bg  = theme?.bg ?? CREAM;
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : INK;

  const title = blk('title');
  const body  = blk('body');
  const sign  = blk('signature');

  const bodyHasText = contentToPlainText(body?.content || '').trim().length > 0;
  const bodyHtml = bodyHasText ? renderContentHTML(body?.content || '') : '';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      padding: '54px 52px 46px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: "'Merriweather', Georgia, serif",
    }}>
      {/* Section label (chrome) */}
      <div style={{
        textAlign: 'center',
        fontFamily: "'Lato', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: GOLD,
        flexShrink: 0,
      }}>
        {eyebrow}
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
        textColor={ink}
        style={{ textAlign: 'center', marginTop: 12, flexShrink: 0 }}
      >
        <ZoneText
          block={title}
          placeholder="A Letter to You"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.18,
            color: ink,
            display: 'block',
          }}
        />
      </TextZone>

      {/* Heart divider (chrome) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '16px 0 22px', flexShrink: 0 }}>
        <div style={{ height: 1, width: 54, background: GOLD, opacity: 0.35 }} />
        <span style={{ fontSize: 13, color: GOLD, lineHeight: 1 }}>♥</span>
        <div style={{ height: 1, width: 54, background: GOLD, opacity: 0.35 }} />
      </div>

      {/* Body (role block) — italic serif, fills remaining height */}
      {editing(body?.id) ? (
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <RichTextEditor
            block={body}
            fontClass="font-merri"
            textColor={ink}
            onReady={onEditorReady}
            onStopEdit={(content) => onStopEdit?.(body.id, content)}
          />
        </div>
      ) : isBuilder ? (
        <div
          onClick={() => onActivate?.(body?.id)}
          style={{ flex: 1, minHeight: 0, overflow: 'hidden', cursor: 'pointer', fontStyle: 'italic', fontSize: 16, lineHeight: 1.85, color: ink }}
        >
          {bodyHasText
            ? <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            : <span style={{ opacity: 0.3 }}>Tap to write your letter…</span>}
        </div>
      ) : (
        <div
          style={{ flex: 1, minHeight: 0, overflow: 'hidden', fontStyle: 'italic', fontSize: 16, lineHeight: 1.85, color: ink }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}

      {/* Signature (role block) — script font, right aligned */}
      <TextZone
        block={sign}
        isEditing={editing(sign?.id)}
        isBuilder={isBuilder}
        onActivate={onActivate}
        onStopEdit={onStopEdit}
        onEditorReady={onEditorReady}
        fontClass="font-merri"
        textColor={ink}
        style={{ textAlign: 'right', marginTop: 22, flexShrink: 0 }}
      >
        <ZoneText
          block={sign}
          placeholder="With all our love, Mum & Dad"
          style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: 26,
            lineHeight: 1.3,
            color: SCRIPT,
            whiteSpace: 'pre-wrap',
            display: 'block',
          }}
        />
      </TextZone>

      {/* Corner heart (chrome) */}
      <div style={{ position: 'absolute', bottom: 16, right: 22, fontSize: 16, color: GOLD, opacity: 0.6, lineHeight: 1, pointerEvents: 'none' }}>
        ♥
      </div>
    </div>
  );
}
