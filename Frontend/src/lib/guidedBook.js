// Runtime view logic for a guided book (sv2-s7b work items C + D). Pure helpers, no React/DOM, so
// they're independently unit-testable. The guided arc CONFIG + instantiation live in guidedBookArc.js;
// this module is the read-side: progress, section grouping, "is this page done", and seeding a pick
// page from a chosen First. A guided chapter carries its arc entry id as `anchorKey`, so its kind /
// prompt / section are re-derived via arcEntryById (never persisted — see the s7b decisions).

import { contentToPlainText, toTiptapDoc } from "@/lib/tiptap";
import { formatDate } from "@/lib/formatting";
import { arcEntryById, isFilledByDefault } from "@/lib/guidedBookArc";

const FT_PREFIX = "first_time:";

/** The arc kind for a guided chapter (defaults to 'fill' for an unknown anchorKey). */
export function chapterKind(chapter) {
  return arcEntryById(chapter?.anchorKey)?.kind ?? "fill";
}

/** True if a single page's blocks carry real content — non-empty text or a placed photo. */
export function pageHasBlockContent(page) {
  for (const b of page?.blocks || []) {
    if (b.type === "photo" && b.url) return true;
    if (b.type === "text" && contentToPlainText(b.content || "").trim()) return true;
    if (b.type === "l-wrap" && (b.url || contentToPlainText(b.content || "").trim())) return true;
  }
  return false;
}

/** True if any page block carries real content — non-empty text or a placed photo. */
export function chapterHasContent(chapter) {
  return (chapter?.layoutData?.pages || []).some(pageHasBlockContent);
}

/**
 * Share s13e-3: a rough "N pages added" count for the owner's share section — pages with block content
 * across all chapters. Approximate on purpose (it doesn't count data-driven pages, whose fill lives in
 * profile data, not blocks); the public link's authoritative content filter runs server-side.
 */
export function filledPageCount(chapters) {
  let n = 0;
  for (const ch of chapters || []) {
    for (const page of ch?.layoutData?.pages || []) {
      if (pageHasBlockContent(page)) n++;
    }
  }
  return n;
}

// ── Tri-state page progress (sv2-s7.5c) ──────────────────────────────────────
// A guided page is 'empty' (no content), 'partial' (some-but-not-all required slots) or 'done' (all
// required slots filled). auto/prefill/divider need no input → always 'done'. "Required" follows
// Michael's rule (2026-07-01): EVERY photo slot must have a url, and every KEY TEXT slot must have
// text — key text being the body-bound zones (a template text slot with contentSource.piece==='body',
// the letter 'body', or the prompt 'val0..N' answers). Titles, dates, captions, week tags and notes
// that aren't body-bound are optional, so they don't hold a page back from 'done'. (moment_hero's note
// IS body-bound, so a pick page needs its note filled to count as done.)

const KEY_TEXT_ID_RE = /^val\d+$/;

/** True if a text/l-wrap block is "key text" — its content is required for the page to be done. */
function isKeyTextBlock(b) {
  return b?.contentSource?.piece === "body" || b?.id === "body" || KEY_TEXT_ID_RE.test(b?.id || "");
}

function blockHasText(b) {
  return contentToPlainText(b?.content || "").trim().length > 0;
}

// The required slots for a chapter as fill-check fns: every photo needs a url, every key-text zone
// needs text, and an l-wrap (photo + body in one) needs both.
function requiredChecks(chapter) {
  const checks = [];
  for (const page of chapter?.layoutData?.pages || []) {
    for (const b of page.blocks || []) {
      if (b.type === "photo") checks.push(() => !!b.url);
      else if (b.type === "text") { if (isKeyTextBlock(b)) checks.push(() => blockHasText(b)); }
      else if (b.type === "l-wrap") checks.push(() => !!b.url && blockHasText(b));
    }
  }
  return checks;
}

/** Tri-state fill status of a guided page: 'empty' | 'partial' | 'done'. */
export function chapterStatus(chapter) {
  if (isFilledByDefault(chapterKind(chapter))) return "done";
  if (!chapterHasContent(chapter)) return "empty";
  const checks = requiredChecks(chapter);
  if (checks.length === 0) return "done"; // has content, nothing specific required → done
  const filled = checks.reduce((n, fn) => n + (fn() ? 1 : 0), 0);
  return filled === checks.length ? "done" : "partial";
}

// Progress for the guided header. Dividers are section openers, not "pages", so they're excluded from
// the denominator; `done` counts only fully-completed pages (sv2-s7.5c — a partial page does NOT
// count), `partial` is surfaced separately, and auto/prefill pages are also reported as the "filled
// from your data" count.
export function guidedProgress(chapters) {
  const pages = (chapters || []).filter((c) => chapterKind(c) !== "divider");
  let done = 0;
  let partial = 0;
  for (const c of pages) {
    const s = chapterStatus(c);
    if (s === "done") done++;
    else if (s === "partial") partial++;
  }
  const autoFilled = pages.filter((c) => {
    const k = chapterKind(c);
    return k === "auto" || k === "prefill";
  }).length;
  return { done, partial, total: pages.length, autoFilled };
}

// Group chapters into sections for the guided view: each divider chapter opens a section (rendered as
// the header), and the following non-divider chapters are its rows. Chapters before any divider fall
// into a leading untitled section (defensive — the locked arcs always start with a divider).
export function groupGuidedSections(chapters) {
  const sections = [];
  let current = null;
  for (const ch of chapters || []) {
    const entry = arcEntryById(ch.anchorKey);
    if (entry?.kind === "divider") {
      current = { section: entry.label, subtitle: entry.prompt, dividerChapter: ch, rows: [] };
      sections.push(current);
    } else {
      if (!current) {
        current = { section: null, subtitle: null, dividerChapter: null, rows: [] };
        sections.push(current);
      }
      current.rows.push(ch);
    }
  }
  return sections;
}

// ── Book-wide "used" keys (sv2-s7.5a, decision B) ────────────────────────────
// Which memory pieces are already placed anywhere in the given chapters. Each guided page is its own
// chapter (Model A), so the builder can't see other pages' placements — StorybookTab collects this
// across the whole book and passes it in so the panel can dim items used elsewhere. A text piece
// counts when its block has non-empty content; a photo piece when its block has a url. Mirrors the
// builder's own per-page derivation so local + book-wide sets union cleanly.
export function collectUsedKeys(chapters) {
  const text = new Set();
  const photo = new Set();
  for (const ch of chapters || []) {
    for (const page of ch?.layoutData?.pages || []) {
      for (const b of page.blocks || []) {
        if (b.type === "text") {
          if (b.sourceKey && contentToPlainText(b.content || "").trim()) text.add(b.sourceKey);
        } else if (b.type === "photo") {
          if (b.sourceKey && b.url) photo.add(b.sourceKey);
        } else if (b.type === "l-wrap") {
          if (b.sourceKey && contentToPlainText(b.content || "").trim()) text.add(b.sourceKey);
          if (b.photoSourceKey && b.url) photo.add(b.photoSourceKey);
        }
      }
    }
  }
  return { text, photo };
}

// ── Time-bucket memory routing (sv2-s7.5a) ───────────────────────────────────
// Guided fill pages surface the user's Journals/Firsts/bump photos for drag-and-drop, grouped into
// collapsible time buckets so a 30-page book doesn't feel cluttered. A memory lands in a bucket by
// its age at the time (memory date − birthdate); bump photos always go to Pregnancy. Bucket windows
// are clean quarters ([0,3) / [3,6) / [6,9) / [9,12) months) — the labels are cosmetic and match the
// growth-spread pages (see sv2-s7.5d). "1 year+" catches anything at/after 12 months.
export const BUCKETS = [
  { id: "pregnancy", label: "Pregnancy" },
  { id: "m0-3",      label: "Months 0–3" },
  { id: "m4-6",      label: "Months 4–6" },
  { id: "m7-9",      label: "Months 7–9" },
  { id: "m10-12",    label: "Months 10–12" },
  { id: "y1plus",    label: "1 year+" },
];

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4375;

// Parse a 'YYYY-MM-DD' string to a noon-anchored local Date (avoids TZ off-by-one, matches
// lib/formatting.js). Falls back to Date.parse for other shapes; returns null if unparseable.
function parseNoon(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  const t = Date.parse(str);
  return Number.isNaN(t) ? null : new Date(t);
}

function ageInMonths(dateStr, birthdate) {
  const d = parseNoon(dateStr);
  const b = parseNoon(birthdate);
  if (!d || !b) return null;
  return (d - b) / MS_PER_MONTH;
}

/** The bucket id a memory belongs to (bump → always Pregnancy; undated → Months 0–3 as a neutral default). */
export function bucketForMemory(memory, birthdate) {
  if (memory?.type === "bump") return "pregnancy";
  const months = ageInMonths(memory?.date, birthdate);
  if (months == null) return "m0-3";
  if (months < 0)  return "pregnancy";
  if (months < 3)  return "m0-3";
  if (months < 6)  return "m4-6";
  if (months < 9)  return "m7-9";
  if (months < 12) return "m10-12";
  return "y1plus";
}

// Build the flat guided memory list from every pool: all journals, all firsts (hero + V38 additional
// photos), and bump photos. Each memory is a card with a text piece (when it has text) and 0..N
// draggable photo pieces, every photo carrying its own unique sourceKey so placement + used-dimming
// track it individually. Sorted by date so buckets read chronologically.
export function buildGuidedMemories({ journalEntries, firsts, bumpPhotos } = {}) {
  const memories = [];

  for (const e of journalEntries || []) {
    const key = `journal:${e.id}`;
    const story = e.story || "";
    const photoUrl = e.image_url || null;
    memories.push({
      sourceKey: key,
      type: "journal",
      label: e.title || "",
      date: e.entry_date || "",
      rawText: story,
      hasText: !!story.trim(),
      preview: story ? story.split(/\s+/).slice(0, 20).join(" ") : "",
      photoUrl,
      photos: photoUrl ? [{ sourceKey: key, url: photoUrl, label: e.title || "" }] : [],
      aiTitle: null,
      aiBody: null,
    });
  }

  for (const f of firsts || []) {
    const key = `first_time:${f.id}`;
    const notes = f.notes || "";
    const hero = f.imageUrl || null;
    const photos = [];
    if (hero) photos.push({ sourceKey: key, url: hero, label: f.label || "" });
    for (const p of f.additionalPhotos || []) {
      if (p?.imageUrl) photos.push({ sourceKey: `first_time_photo:${p.id}`, url: p.imageUrl, label: p.caption || f.label || "" });
    }
    memories.push({
      sourceKey: key,
      type: "first_time",
      label: f.label || "",
      date: f.occurredDate || "",
      rawText: notes,
      hasText: !!notes.trim(),
      preview: notes ? notes.split(/\s+/).slice(0, 20).join(" ") : "",
      photoUrl: hero,
      photos,
      aiTitle: null,
      aiBody: null,
    });
  }

  // Bump photos are photo-only (the week note shows as the card preview, not a draggable text piece).
  for (const b of bumpPhotos || []) {
    if (!b?.imageUrl) continue;
    const key = `bump:${b.id}`;
    const label = b.week != null ? `Week ${b.week}` : "Bump";
    memories.push({
      sourceKey: key,
      type: "bump",
      label,
      date: b.takenDate || "",
      rawText: "",
      hasText: false,
      preview: b.note || "",
      photoUrl: b.imageUrl,
      photos: [{ sourceKey: key, url: b.imageUrl, label: b.note || label }],
      aiTitle: null,
      aiBody: null,
    });
  }

  memories.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return memories;
}

// Group a flat memory list into the ordered buckets, dropping empty buckets so the panel stays tidy.
export function groupMemoriesIntoBuckets(memories, birthdate) {
  const byId = new Map(BUCKETS.map((b) => [b.id, []]));
  for (const m of memories || []) {
    const id = bucketForMemory(m, birthdate);
    (byId.get(id) || byId.get("m0-3")).push(m);
  }
  return BUCKETS
    .map((b) => ({ id: b.id, label: b.label, memories: byId.get(b.id) }))
    .filter((b) => b.memories.length > 0);
}

/** First-time ids already featured on a pick page (read off the moment_hero photo block sourceKey). */
export function featuredFirstTimeIds(chapters) {
  const ids = new Set();
  for (const ch of chapters || []) {
    if (chapterKind(ch) !== "pick") continue;
    for (const page of ch.layoutData?.pages || []) {
      for (const b of page.blocks || []) {
        if (b.type === "photo" && typeof b.sourceKey === "string" && b.sourceKey.startsWith(FT_PREFIX)) {
          const id = Number(b.sourceKey.slice(FT_PREFIX.length));
          if (!Number.isNaN(id)) ids.add(id);
        }
      }
    }
  }
  return ids;
}

// Seed a pick page's moment_hero from a chosen First: fill title/date/note/photo and tag the photo
// block's sourceKey with the first id (so it's tracked for the "already featured" hint and survives
// the builder's autosave, which preserves blocks). Everything stays editable afterwards. Returns a new
// layoutData object (does not mutate the chapter).
export function seedMomentHeroFromFirst(chapter, first) {
  const layout = chapter?.layoutData || { version: 2, pages: [] };
  const pages = (layout.pages || []).map((page, idx) => {
    if (idx !== 0) return page;
    const blocks = (page.blocks || []).map((b) => {
      switch (b.id) {
        case "badge": return { ...b, content: toTiptapDoc("A First") };
        case "title": return { ...b, content: toTiptapDoc(first.label || "") };
        case "date":  return { ...b, content: toTiptapDoc(first.occurredDate ? formatDate(first.occurredDate) : "") };
        case "note":  return { ...b, content: toTiptapDoc(first.notes || "") };
        case "photo": return {
          ...b,
          url: first.imageUrl || null,
          label: first.label || "",
          sourceKey: `${FT_PREFIX}${first.id}`,
          crop: undefined,
        };
        default: return b;
      }
    });
    return { ...page, blocks };
  });
  return { ...layout, pages };
}
