import React, { useEffect, useReducer } from "react";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { FONT_SIZES, fontSizeKey } from "@/lib/tiptap";
import AiAssistField from "@/components/storybook/AiAssistField";

// Inline formatting toolbar bound to an active Tiptap editor: bold, italic,
// alignment, and S/M/L font size. Shown while a text block is being edited.
// `assist` (optional) adds a ✨ AI-draft button for rich-text fields that support it
// (currently the letter body) — { promptType, context, onResult }.
export default function FormatToolbar({ editor, assist }) {
  const [, force] = useReducer(x => x + 1, 0);

  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', force);
    editor.on('selectionUpdate', force);
    return () => {
      editor.off('transaction', force);
      editor.off('selectionUpdate', force);
    };
  }, [editor]);

  if (!editor) return null;

  const curSize = fontSizeKey(editor.getAttributes('textStyle').fontSize);
  const setSize = (key) => {
    const val = FONT_SIZES[key];
    if (val == null) editor.chain().focus().unsetFontSize().run();
    else editor.chain().focus().setFontSize(val).run();
  };
  const curAlign = ['center', 'right'].find(a => editor.isActive({ textAlign: a })) || 'left';

  const btn = "w-8 h-8 rounded-md flex items-center justify-center transition-colors";
  const on = "bg-color-highlight text-white";
  const off = "text-foreground hover:bg-muted";

  return (
    <div
      className="flex items-center gap-1 flex-wrap justify-center max-w-[480px] mx-auto rounded-xl border border-border bg-card px-2 py-1.5 shadow-sm"
      onMouseDown={e => e.preventDefault()}
    >
      <button className={`${btn} ${editor.isActive('bold') ? on : off}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
        <Bold className="w-4 h-4" />
      </button>
      <button className={`${btn} ${editor.isActive('italic') ? on : off}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
        <Italic className="w-4 h-4" />
      </button>

      <span className="w-px h-5 bg-border mx-0.5" />

      <button className={`${btn} ${curAlign === 'left' ? on : off}`} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">
        <AlignLeft className="w-4 h-4" />
      </button>
      <button className={`${btn} ${curAlign === 'center' ? on : off}`} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center">
        <AlignCenter className="w-4 h-4" />
      </button>
      <button className={`${btn} ${curAlign === 'right' ? on : off}`} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">
        <AlignRight className="w-4 h-4" />
      </button>

      <span className="w-px h-5 bg-border mx-0.5" />

      {[['small', 'S'], ['normal', 'M'], ['large', 'L']].map(([key, label]) => (
        <button
          key={key}
          className={`${btn} text-xs font-semibold ${curSize === key ? on : off}`}
          onClick={() => setSize(key)}
          title={`${label} text`}
        >
          {label}
        </button>
      ))}

      {assist && (
        <>
          <span className="w-px h-5 bg-border mx-0.5" />
          <AiAssistField
            variant="toolbar"
            promptType={assist.promptType}
            context={{ ...assist.context, seedText: editor.getText() }}
            onResult={assist.onResult}
            requireSeed={assist.requireSeed}
          />
        </>
      )}
    </div>
  );
}
