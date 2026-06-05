// Shared Tiptap configuration for storybook text blocks.
// The builder's inline editor (RichTextEditor) and the static renderer
// (LayoutRenderer) MUST use the same extension set so that JSON produced in one
// renders identically in the other.

import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { generateHTML } from "@tiptap/html";

// Relative font sizes (em) so a block still shrinks-to-fit as a unit — "large"
// stays proportionally larger than "normal" even after auto-fit scales the
// whole block down. `null` = unset = inherit the block's base size.
export const FONT_SIZES = {
  small: "0.8em",
  normal: null,
  large: "1.35em",
};

// Map a stored fontSize em string back to a size key (for toolbar active state).
export function fontSizeKey(emValue) {
  if (emValue === FONT_SIZES.small) return "small";
  if (emValue === FONT_SIZES.large) return "large";
  return "normal";
}

// Block-level extras are disabled: storybook text blocks are simple prose, so
// headings/lists/code/quotes/links would only invite accidental markdown input.
export const tiptapExtensions = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    horizontalRule: false,
    code: false,
    strike: false,
    link: false,
  }),
  TextStyle,
  FontSize,
  TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right"] }),
];

export function isTiptapDoc(content) {
  return !!content && typeof content === "object" && content.type === "doc";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert legacy plain-string content (\n\n-separated paragraphs) to a Tiptap doc.
export function stringToTiptapDoc(str) {
  const text = (str || "").trim();
  const paras = text ? text.split(/\n{2,}/) : [];
  return {
    type: "doc",
    content: paras.length
      ? paras.map((p) => {
          const t = p.trim();
          return {
            type: "paragraph",
            content: t ? [{ type: "text", text: t }] : [],
          };
        })
      : [{ type: "paragraph" }],
  };
}

// Normalize any stored content to a Tiptap doc (idempotent for docs).
export function toTiptapDoc(content) {
  return isTiptapDoc(content) ? content : stringToTiptapDoc(content);
}

// Render content (Tiptap doc or legacy string) to an HTML string for display.
export function renderContentHTML(content) {
  if (isTiptapDoc(content)) {
    try {
      return generateHTML(content, tiptapExtensions);
    } catch {
      return "";
    }
  }
  const text = (content || "").trim();
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join("");
}

// Flatten content to plain text (used to detect "empty" blocks).
export function contentToPlainText(content) {
  if (!isTiptapDoc(content)) return (content || "").trim();
  let out = "";
  const walk = (node) => {
    if (!node) return;
    if (node.type === "text") out += node.text || "";
    (node.content || []).forEach(walk);
  };
  walk(content);
  return out.trim();
}
