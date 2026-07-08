// Pure layout helpers for the scrapbook builder. Extracted from
// ScrapbookBuilder.jsx so the logic-heavy bits (text splitting, page
// initialization, v2 layout payload building, block migration) are independently
// unit testable. No React, no DOM — keep it pure.

import { toTiptapDoc } from "@/lib/tiptap";

export function makeId() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makePageId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

// Split text into n parts at natural boundaries (paragraph → sentence → word).
export function splitTextParts(text, n) {
  if (n <= 1) return [text];
  const paras = text.split(/\n\n+/).filter(Boolean);
  if (paras.length >= n) {
    const mid = Math.ceil(paras.length / n);
    return [paras.slice(0, mid).join('\n\n'), paras.slice(mid).join('\n\n')];
  }
  const mid = Math.floor(text.length / 2);
  const sentenceEnd = text.indexOf('. ', mid);
  if (sentenceEnd > 0 && sentenceEnd < text.length - 2) {
    return [text.slice(0, sentenceEnd + 1).trim(), text.slice(sentenceEnd + 2).trim()];
  }
  const wordBound = text.indexOf(' ', mid);
  if (wordBound > 0) {
    return [text.slice(0, wordBound).trim(), text.slice(wordBound).trim()];
  }
  return [text, ''];
}

// Ensure every block has an id; migrate plain-string text content to Tiptap JSON.
export function migrateBlock(b) {
  const block = { ...b, id: b.id || makeId() };
  if (block.type === 'text' || block.type === 'l-wrap') block.content = toTiptapDoc(block.content);
  return block;
}

// Clone a template's blocks into fresh, empty editable blocks: text/l-wrap get an empty Tiptap doc,
// photo/l-wrap reset their fill (sourceKey/url/label), and explicit role ids (moment-hero, divider,
// gallery, etc.) are preserved. Shared by the builder's "apply template" and the guided-arc seeder
// (sv2-s7b) so both produce identical page shapes.
export function emptyBlocksForTemplate(tpl) {
  return (tpl?.blocks || []).map(b => ({
    ...b,
    id: b.id || makeId(), // preserve explicit template ids (e.g. moment-hero / divider role ids)
    content: (b.type === 'text' || b.type === 'l-wrap') ? toTiptapDoc('') : undefined,
    sourceKey: (b.type === 'photo' || b.type === 'l-wrap') ? null : undefined,
    url: (b.type === 'photo' || b.type === 'l-wrap') ? null : undefined,
    label: (b.type === 'photo' || b.type === 'l-wrap') ? null : undefined,
    photoSourceKey: b.type === 'l-wrap' ? null : undefined,
  }));
}

export function initPages(chapter) {
  if (chapter.layoutData?.version === 2) {
    return (chapter.layoutData.pages || []).map(p => ({
      id: p.id || makePageId(),
      sourceKeys: p.sourceKeys || (p.sourceKey ? [p.sourceKey] : []),
      templateId: p.templateId || null,
      backgroundColor: p.backgroundColor || null,
      blocks: (p.blocks || []).map(migrateBlock),
    }));
  }
  // v1 / empty — fold into a single page.
  const blocks = (chapter.layoutData?.blocks || []).map(migrateBlock);
  return [{ id: makePageId(), sourceKeys: [], templateId: null, backgroundColor: null, blocks }];
}

export function buildLayoutData(thePages) {
  return {
    version: 2,
    pages: thePages.map(p => ({
      id: p.id,
      sourceKeys: p.sourceKeys || [],
      templateId: p.templateId || null,
      backgroundColor: p.backgroundColor || null,
      blocks: p.blocks,
    })),
  };
}
