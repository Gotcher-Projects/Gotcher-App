import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { tiptapExtensions, toTiptapDoc } from "@/lib/tiptap";
import { BASE_FONT } from "@/lib/bookCanvas";

// Tiptap rich-text editor for a single text block. Reports the editor instance to
// the parent (for the format toolbar) and commits content on blur.
// `flow` mode drops the overflow/height wrappers so the editor does NOT establish
// a block-formatting context — its text then wraps around a preceding float
// (used by the l-wrap block so the photo stays visible while editing).
export default function RichTextEditor({ block, fontClass, textColor, onReady, onStopEdit, flow = false }) {
  const editor = useEditor({
    extensions: tiptapExtensions,
    content: toTiptapDoc(block.content),
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: `book-rich book-rich--edit ${fontClass} w-full p-3 outline-none ${flow ? '' : 'h-full overflow-y-auto'}`,
        style: textColor ? `color: ${textColor}` : '',
      },
    },
    onBlur: ({ editor }) => onStopEdit(editor.getJSON()),
  });

  useEffect(() => {
    if (editor) onReady(editor);
    return () => onReady(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div
      className={`w-full border border-color-highlight/50 rounded bg-transparent ${flow ? '' : 'h-full overflow-hidden'}`}
      style={{ fontSize: BASE_FONT, lineHeight: 1.8 }}
    >
      <EditorContent editor={editor} className={flow ? 'w-full' : 'w-full h-full'} />
    </div>
  );
}
