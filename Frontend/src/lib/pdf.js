import { jsPDF } from 'jspdf';
import { formatEntryDate } from './formatting';

// ── Constants ────────────────────────────────────────────────────────────────
const PAGE_W    = 210;
const PAGE_H    = 297;
const MARGIN    = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CARD_PAD  = 5;
const HDR_H     = 24;
const ENTRY_GAP = 10;

const META_H  = 5.5;
const TITLE_H = 9;
const LINE_H  = 5.5;

// Portrait side-by-side column layout
const IMG_COL_W   = CONTENT_W * 0.40;
const COL_GAP     = 4;
const TXT_COL_W   = CONTENT_W - IMG_COL_W - COL_GAP;

// ── Image helpers ─────────────────────────────────────────────────────────────

async function loadImageDataUrl(url) {
  try {
    return await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

// Returns layout descriptor used by both entryBlockH and renderEntry.
function resolveImgLayout(raw, orientation) {
  if (!raw) return null;
  if (orientation === 'portrait') {
    const drawW = IMG_COL_W;
    const ratio = (raw.naturalWidth > 0) ? raw.naturalHeight / raw.naturalWidth : (4 / 3);
    const drawH = Math.min(drawW * ratio, 130); // cap at 130mm to prevent page overflow
    return { dataUrl: raw.dataUrl, drawW, drawH, portrait: true };
  }
  // landscape — full width, capped at 90mm tall
  const drawH = Math.min(CONTENT_W * 0.75, 90);
  return { dataUrl: raw.dataUrl, drawW: CONTENT_W, drawH, portrait: false };
}

// storyLines must already be wrapped to the correct column width for this entry.
function entryBlockH(storyLines, imgLayout) {
  if (imgLayout?.portrait) {
    // Side-by-side: height = taller of image column or text column
    const textColH = CARD_PAD + META_H + TITLE_H + 2
      + (storyLines.length > 0 ? storyLines.length * LINE_H + 3 : 0)
      + CARD_PAD;
    const imgColH = CARD_PAD + imgLayout.drawH + CARD_PAD;
    return Math.max(textColH, imgColH);
  }
  // Stacked landscape layout
  let h = CARD_PAD + META_H + TITLE_H + 3;
  if (imgLayout) h += 4 + imgLayout.drawH + 5;
  if (storyLines.length > 0) h += storyLines.length * LINE_H + 4;
  h += CARD_PAD;
  return h;
}

// ── Cover page ────────────────────────────────────────────────────────────────

function drawCoverPage(doc, babyName, entryCount) {
  const cx = PAGE_W / 2;

  doc.setFillColor(252, 246, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  doc.setFillColor(237, 220, 255);
  doc.rect(0, 0, PAGE_W, 65, 'F');

  doc.setFillColor(216, 190, 248);
  doc.ellipse(22, 24, 22, 22, 'F');
  doc.setFillColor(195, 220, 255);
  doc.ellipse(PAGE_W - 22, 26, 17, 17, 'F');
  doc.setFillColor(255, 208, 230);
  doc.ellipse(PAGE_W - 6, 6, 10, 10, 'F');
  doc.setFillColor(200, 240, 220);
  doc.ellipse(8, PAGE_H - 30, 14, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(110, 35, 155);
  doc.text(`${babyName}'s`, cx, 120, { align: 'center' });

  doc.setFontSize(28);
  doc.setTextColor(45, 115, 175);
  doc.text('Memory Journal', cx, 138, { align: 'center' });

  doc.setDrawColor(195, 155, 230);
  doc.setLineWidth(0.8);
  doc.line(cx - 50, 148, cx + 50, 148);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(145, 105, 180);
  doc.text('A collection of precious moments', cx, 162, { align: 'center' });

  if (entryCount > 0) {
    doc.setFontSize(9);
    doc.setTextColor(175, 150, 205);
    doc.text(`${entryCount} ${entryCount === 1 ? 'memory' : 'memories'} inside`, cx, 174, { align: 'center' });
  }

  doc.setFontSize(8);
  doc.setTextColor(190, 170, 215);
  doc.text(`Generated ${formatEntryDate(new Date())}`, cx, 274, { align: 'center' });

  doc.setFillColor(210, 232, 255);
  doc.rect(0, PAGE_H - 16, PAGE_W, 16, 'F');
}

// ── Page header ───────────────────────────────────────────────────────────────

function drawPageHeader(doc, babyName, pageNum, totalPages) {
  doc.setFillColor(251, 247, 255);
  doc.rect(0, 0, PAGE_W, HDR_H - 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(110, 35, 155);
  doc.text(`${babyName}'s Memory Journal`, MARGIN, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 145, 175);
  doc.text(`Generated ${formatEntryDate(new Date())}`, MARGIN, 20);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, 20, { align: 'right' });

  doc.setDrawColor(220, 200, 242);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, HDR_H - 2, PAGE_W - MARGIN, HDR_H - 2);
}

// ── Entry renderer ────────────────────────────────────────────────────────────

function renderEntry(doc, entry, storyLines, imgLayout, y) {
  const blockH = entryBlockH(storyLines, imgLayout);
  const cardH  = blockH - ENTRY_GAP / 2;
  const x      = MARGIN;

  // Card background
  doc.setFillColor(252, 248, 255);
  doc.roundedRect(x - 2, y, CONTENT_W + 4, cardH, 2, 2, 'F');

  // Left accent bar
  doc.setFillColor(170, 80, 215);
  doc.roundedRect(x - 2, y, 3, cardH, 1.5, 1.5, 'F');

  if (imgLayout?.portrait) {
    // ── Portrait: image left, text right ─────────────────────────────────

    const imgX  = x + 2;
    const textX = imgX + IMG_COL_W + COL_GAP;

    // Image — starts with card top padding
    doc.addImage(
      imgLayout.dataUrl, 'JPEG',
      imgX, y + CARD_PAD,
      imgLayout.drawW, imgLayout.drawH,
      undefined, 'FAST'
    );

    // Text column
    let cy = y + CARD_PAD;

    // Week pill
    doc.setFillColor(243, 232, 255);
    doc.roundedRect(textX, cy, 22, META_H - 0.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(130, 50, 185);
    doc.text(`Week ${entry.week}`, textX + 1.5, cy + META_H - 1.8);
    cy += META_H + 1;

    // Title — slightly smaller to fit column
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(35, 25, 55);
    const titleLines = doc.splitTextToSize(entry.title, TXT_COL_W - 2);
    doc.text(titleLines, textX, cy + TITLE_H - 2);
    cy += titleLines.length * TITLE_H;

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(165, 150, 180);
    doc.text(formatEntryDate(entry.entry_date || entry.date), textX, cy + META_H - 1.5);
    cy += META_H + 3;

    // Divider
    doc.setDrawColor(225, 205, 242);
    doc.setLineWidth(0.25);
    doc.line(textX, cy, textX + TXT_COL_W - 2, cy);
    cy += 3;

    // Story
    if (storyLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(65, 55, 80);
      doc.text(storyLines, textX, cy + LINE_H - 1);
    }

  } else {
    // ── Landscape / no image: stacked ────────────────────────────────────

    let cy = y + CARD_PAD;

    // Week pill + date row
    doc.setFillColor(243, 232, 255);
    doc.roundedRect(x + 2, cy, 22, META_H - 0.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(130, 50, 185);
    doc.text(`Week ${entry.week}`, x + 3.5, cy + META_H - 1.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(165, 150, 180);
    doc.text(formatEntryDate(entry.entry_date || entry.date), x + CONTENT_W - 2, cy + META_H - 1.8, { align: 'right' });
    cy += META_H + 1;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(35, 25, 55);
    doc.text(entry.title, x + 2, cy + TITLE_H - 2);
    cy += TITLE_H;

    // Image
    if (imgLayout) {
      cy += 2;
      doc.setDrawColor(225, 205, 242);
      doc.setLineWidth(0.25);
      doc.line(x + 2, cy, x + CONTENT_W - 2, cy);
      cy += 2;
      doc.addImage(imgLayout.dataUrl, 'JPEG', x, cy, imgLayout.drawW, imgLayout.drawH, undefined, 'FAST');
      cy += imgLayout.drawH + 5;
    }

    // Story
    if (storyLines.length > 0) {
      if (!imgLayout) {
        cy += 2;
        doc.setDrawColor(225, 205, 242);
        doc.setLineWidth(0.25);
        doc.line(x + 2, cy, x + CONTENT_W - 2, cy);
        cy += 3;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(65, 55, 80);
      doc.text(storyLines, x + 2, cy + LINE_H - 1);
    }
  }

  // Separator between entries
  const sepY = y + cardH + 4;
  doc.setDrawColor(228, 212, 245);
  doc.setLineWidth(0.25);
  doc.line(x + 20, sepY, PAGE_W - MARGIN - 20, sepY);

  return y + blockH + ENTRY_GAP;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a jsPDF document from journal entries. Sorts by week then date, loads and
 * crops all images, lays out a cover page + paginated entry cards.
 * @param {Array<{id: number, week: number, title: string, story?: string, entry_date?: string,
 *   image_url?: string, image_orientation?: 'portrait'|'landscape'}>} entries
 * @param {string} babyName - used in cover title and page header
 * @returns {Promise<jsPDF>} — call downloadPdf(doc, babyName) to trigger save
 */
export async function generatePdf(entries, babyName) {
  const sorted = [...entries].sort((a, b) =>
    (a.week - b.week) || (a.entry_date || '').localeCompare(b.entry_date || '')
  );

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const rawImages = await Promise.all(
    sorted.map(e => e.image_url ? loadImageDataUrl(e.image_url) : Promise.resolve(null))
  );
  const imgLayouts = sorted.map((e, i) => resolveImgLayout(rawImages[i], e.image_orientation));

  // Wrap story at the appropriate column width for each entry's orientation
  doc.setFontSize(9.5);
  const storyLinesArr = sorted.map((e, i) => {
    if (!e.story) return [];
    const wrapW = imgLayouts[i]?.portrait ? TXT_COL_W - 2 : CONTENT_W - 4;
    return doc.splitTextToSize(e.story, wrapW);
  });

  drawCoverPage(doc, babyName, sorted.length);
  doc.addPage();

  function countPages() {
    let y = HDR_H, pages = 1;
    const usableH = PAGE_H - MARGIN;
    for (let i = 0; i < sorted.length; i++) {
      const h = entryBlockH(storyLinesArr[i], imgLayouts[i]);
      if (i > 0 && y + h > usableH) { pages++; y = HDR_H; }
      y += h;
    }
    return pages;
  }
  const totalPages = countPages();

  let y = HDR_H, pageNum = 1;
  const usableH = PAGE_H - MARGIN;
  drawPageHeader(doc, babyName, pageNum, totalPages);

  for (let i = 0; i < sorted.length; i++) {
    const h = entryBlockH(storyLinesArr[i], imgLayouts[i]);
    if (i > 0 && y + h > usableH) {
      doc.addPage();
      pageNum++;
      drawPageHeader(doc, babyName, pageNum, totalPages);
      y = HDR_H;
    }
    y = renderEntry(doc, sorted[i], storyLinesArr[i], imgLayouts[i], y);
  }

  return doc;
}

export function downloadPdf(doc, babyName) {
  const slug = (babyName || 'baby').toLowerCase().replace(/\s+/g, '-');
  doc.save(`${slug}-memory-journal.pdf`);
}
