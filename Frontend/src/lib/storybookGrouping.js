import { TEMPLATES } from '@/lib/storybookTemplates';
import { toTiptapDoc } from '@/lib/tiptap';
import { cleanBodyText } from '@/lib/storybookText';

// ── Word counting ─────────────────────────────────────────────────────────────

function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Memory list builder ───────────────────────────────────────────────────────

// sourceKey grammar (the string that ties a memory to its blocks / generated content):
//   `journal:<id>`      — a journal entry
//   `first_time:<id>`   — a first-time memory
//   `upload:<uuid>`     — a standalone chapter photo (minted by the backend on upload)
//   `slot:<N>`          — a photo-only template slot with no owning memory
// l-wrap blocks carry the photo provenance on a SEPARATE `photoSourceKey` (the text
// keeps `sourceKey`), because one l-wrap mixes text from one memory + a photo from another.
// The backend mirrors `journal:`/`first_time:` in buildBatchPagesPrompt (StorybookService).
export function buildMemoryList({ journalIds, firstTimeIds, journalEntries, firsts, photoOverrides, entryNotes }) {
  const memories = [];

  for (const id of journalIds || []) {
    const entry = journalEntries.find(e => e.id === id);
    if (!entry) continue;
    const sourceKey = `journal:${id}`;
    const photoUrl = photoOverrides?.[sourceKey] || entry.image_url || null;
    memories.push({
      sourceKey,
      date: entry.entry_date || '',
      label: entry.title || '',
      preview: entry.story ? entry.story.split(/\s+/).slice(0, 20).join(' ') : '',
      wordCount: wordCount(entry.story),
      hasPhoto: !!photoUrl,
      photoUrl,
      type: 'journal',
    });
  }

  for (const id of firstTimeIds || []) {
    const ft = firsts.find(f => f.id === id);
    if (!ft) continue;
    const sourceKey = `first_time:${id}`;
    const photoUrl = photoOverrides?.[sourceKey] || ft.imageUrl || null;
    memories.push({
      sourceKey,
      date: ft.occurredDate || '',
      label: ft.label || '',
      preview: ft.notes ? ft.notes.split(/\s+/).slice(0, 20).join(' ') : '',
      wordCount: wordCount(ft.notes),
      hasPhoto: !!photoUrl,
      photoUrl,
      type: 'first_time',
    });
  }

  memories.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return memories;
}

// ── Template selection ────────────────────────────────────────────────────────

function pickTemplate(memoryCount, availablePhotos) {
  const candidates = TEMPLATES.filter(
    t => t.memoryCount === memoryCount && t.minPhotos <= availablePhotos
  );
  if (!candidates.length) {
    const textOnly = TEMPLATES.filter(t => t.memoryCount === memoryCount && t.maxPhotos === 0);
    return textOnly[0] || TEMPLATES.find(t => t.memoryCount === 1 && t.maxPhotos === 0) || TEMPLATES[0];
  }
  // Prefer templates that use photos when photos are available
  if (availablePhotos > 0) {
    const withPhotos = candidates.filter(t => t.maxPhotos > 0);
    if (withPhotos.length) return withPhotos.sort((a, b) => b.maxPhotos - a.maxPhotos)[0];
  }
  return candidates[0];
}

// Build photo assignments for a group given a template
function buildPhotoAssignments(groupMemories, template) {
  const assignments = {};
  for (const block of template.blocks) {
    if (block.type !== 'photo' || !block.contentSource) continue;
    const { memoryIndex, photoIndex } = block.contentSource;
    if (memoryIndex != null && photoIndex != null) {
      const mem = groupMemories[memoryIndex];
      if (mem?.hasPhoto && mem.photoUrl) {
        if (!assignments[mem.sourceKey]) assignments[mem.sourceKey] = [];
        assignments[mem.sourceKey][photoIndex] = mem.photoUrl;
      }
    }
    // Photo-only slots (no memoryIndex) are left empty — user picks
  }
  // Compact sparse arrays
  for (const key of Object.keys(assignments)) {
    assignments[key] = assignments[key].filter(Boolean);
    if (assignments[key].length === 0) delete assignments[key];
  }
  return assignments;
}

// ── Auto-suggest algorithm ────────────────────────────────────────────────────

const SHORT_WORD_THRESHOLD = 80;
const MAX_GROUP_SIZE = 3;

export function autoSuggestGroups(memories) {
  const groups = [];
  let i = 0;
  let pageNum = 0;

  while (i < memories.length) {
    const mem = memories[i];
    // First times and short journal entries can be grouped
    const isShort =
      mem.type === 'first_time' ||
      (mem.type === 'journal' && mem.wordCount <= SHORT_WORD_THRESHOLD);

    if (isShort) {
      // Collect consecutive short memories up to MAX_GROUP_SIZE
      const groupMems = [mem];
      let j = i + 1;
      while (j < memories.length && groupMems.length < MAX_GROUP_SIZE) {
        const next = memories[j];
        const nextShort =
          next.type === 'first_time' ||
          (next.type === 'journal' && next.wordCount <= SHORT_WORD_THRESHOLD);
        if (!nextShort) break;
        groupMems.push(next);
        j++;
      }
      const photoCount = groupMems.filter(m => m.hasPhoto).length;
      const template = pickTemplate(groupMems.length, photoCount);
      groups.push({
        pageId: `page-${pageNum++}`,
        sourceKeys: groupMems.map(m => m.sourceKey),
        templateId: template.id,
        photoAssignments: buildPhotoAssignments(groupMems, template),
      });
      i = j;
    } else {
      // Long journal entry gets its own page
      const photoCount = mem.hasPhoto ? 1 : 0;
      const template = pickTemplate(1, photoCount);
      groups.push({
        pageId: `page-${pageNum++}`,
        sourceKeys: [mem.sourceKey],
        templateId: template.id,
        photoAssignments: buildPhotoAssignments([mem], template),
      });
      i++;
    }
  }

  return groups;
}

// ── Layout data builder ───────────────────────────────────────────────────────

// Pull a single content piece (body / title / caption / pullQuote) out of a
// generated-content record, applying the same body cleanup everywhere.
export function extractPieceText(gc, piece = 'body') {
  if (!gc) return '';
  if (piece === 'pullQuote') return gc.pullQuote || '';
  if (piece === 'title') return gc.title || '';
  if (piece === 'caption') return gc.caption || '';
  return cleanBodyText(gc.body);
}

export function buildGroupedLayoutData(pageGroups, generatedPages) {
  const contentByKey = {};
  for (const p of generatedPages) {
    if (p.sourceKey) contentByKey[p.sourceKey] = p;
  }

  const pages = pageGroups.map(group => {
    const template = TEMPLATES.find(t => t.id === group.templateId) || TEMPLATES[0];
    const blocks = template.blocks.map((b, bi) => {
      const block = {
        id: `b-${group.pageId}-${bi}`,
        type: b.type,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
      };

      if (b.type === 'text' && b.contentSource) {
        const { memoryIndex = 0, piece = 'body' } = b.contentSource;
        const sourceKey = group.sourceKeys[memoryIndex];
        const content = sourceKey ? contentByKey[sourceKey] : null;
        block.content = toTiptapDoc(extractPieceText(content, piece));
        block.suppressDropCap = true;
      } else if (b.type === 'photo' && b.contentSource) {
        const { memoryIndex, photoIndex = 0 } = b.contentSource;
        let photoUrl = null;
        let photoSourceKey = null;
        if (memoryIndex != null) {
          const sourceKey = group.sourceKeys[memoryIndex];
          const urls = sourceKey ? group.photoAssignments?.[sourceKey] : null;
          photoUrl = urls?.[photoIndex] || null;
          photoSourceKey = sourceKey || null;
        } else {
          // Photo-only slot — keyed by "slot:N"
          const slotKey = `slot:${photoIndex}`;
          const urls = group.photoAssignments?.[slotKey];
          photoUrl = urls?.[0] || null;
        }
        if (photoUrl) {
          block.url = photoUrl;
          block.sourceKey = photoSourceKey;
          block.label = '';
        }
      }

      return block;
    });

    return {
      id: group.pageId,
      sourceKeys: group.sourceKeys,
      templateId: group.templateId,
      backgroundColor: null,
      blocks,
    };
  });

  return { version: 2, pages };
}
