import { jsPDF } from 'jspdf';
import { formatEntryDate } from './formatting';

// ── Constants ────────────────────────────────────────────────────────────────
const PAGE_W = 210;       // A4 mm
const PAGE_H = 297;       // A4 mm
const MARGIN = 18;        // left/right/top/bottom
const CONTENT_W = PAGE_W - MARGIN * 2;

const LINE_H     = 5.5;   // body text line height
const TITLE_H    = 9;     // entry title line height
const DATE_H     = 6;     // week/date line height
const IMG_MAX_H  = 140;   // max image height in mm
const SEP_H      = 10;    // vertical gap between entries
const HDR_H      = 22;    // page header block height

// ── Helpers ──────────────────────────────────────────────────────────────────

// Returns { dataUrl, drawnH } preserving aspect ratio, capped at IMG_MAX_H.
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        const drawnH = Math.min(CONTENT_W / aspectRatio, IMG_MAX_H);
        resolve({ dataUrl, drawnH });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

function formatEntryDateForPdf(entry) {
  return formatEntryDate(entry.entry_date || entry.date);
}

// imgData is { dataUrl, drawnH } or null.
function entryHeight(storyLines, imgData) {
  const imgBlock = imgData ? imgData.drawnH + 3 + 4 : 0; // 3 top gap + 4 bottom pad
  return DATE_H + TITLE_H + (storyLines.length * LINE_H) + imgBlock + SEP_H;
}

function drawCoverPage(doc, babyName) {
  const cx = PAGE_W / 2;

  // Background
  doc.setFillColor(249, 243, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Top decorative band
  doc.setFillColor(233, 213, 255);
  doc.rect(0, 0, PAGE_W, 58, 'F');

  // Decorative circles in top band
  doc.setFillColor(220, 190, 250);
  doc.ellipse(25, 26, 20, 20, 'F');
  doc.setFillColor(200, 220, 255);
  doc.ellipse(PAGE_W - 25, 28, 16, 16, 'F');
  doc.setFillColor(255, 210, 230);
  doc.ellipse(PAGE_W - 8, 8, 9, 9, 'F');

  // Baby name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.setTextColor(120, 40, 160);
  doc.text(`${babyName}'s`, cx, 118, { align: 'center' });

  // "Memory Journal"
  doc.setFontSize(30);
  doc.setTextColor(50, 120, 180);
  doc.text('Memory Journal', cx, 138, { align: 'center' });

  // Decorative rule
  doc.setDrawColor(200, 160, 235);
  doc.setLineWidth(0.8);
  doc.line(cx - 45, 148, cx + 45, 148);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(150, 110, 185);
  doc.text('A collection of precious moments', cx, 161, { align: 'center' });

  // Generation date
  const genDate = formatEntryDate(new Date());
  doc.setFontSize(9);
  doc.setTextColor(185, 165, 210);
  doc.text(`Generated ${genDate}`, cx, 272, { align: 'center' });

  // Bottom decorative band
  doc.setFillColor(210, 230, 255);
  doc.rect(0, PAGE_H - 18, PAGE_W, 18, 'F');
}

function drawPageHeader(doc, babyName, pageNum, totalPages) {
  doc.setFillColor(250, 245, 255);
  doc.rect(0, 0, PAGE_W, HDR_H - 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(120, 40, 160);
  doc.text(`${babyName}'s Memory Journal`, MARGIN, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const genDate = formatEntryDate(new Date());
  doc.text(`Generated ${genDate}`, MARGIN, 19);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, 19, { align: 'right' });

  // Thin rule under header
  doc.setDrawColor(220, 200, 240);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, HDR_H - 2, PAGE_W - MARGIN, HDR_H - 2);
}

// ── Core: render one entry at currentY, return new Y ────────────────────────
function renderEntry(doc, entry, storyLines, imgData, y) {
  const h = entryHeight(storyLines, imgData);
  const cardH = h - SEP_H + 2;

  // Left accent bar
  doc.setFillColor(180, 90, 220);
  doc.rect(MARGIN - 5, y - 2, 2.5, cardH, 'F');

  // Week pill background
  doc.setFillColor(248, 240, 255);
  doc.rect(MARGIN, y, 22, DATE_H - 1.5, 'F');

  // Week label inside pill
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(140, 60, 190);
  doc.text(`Week ${entry.week}`, MARGIN + 1.5, y + DATE_H - 3);

  // Date to the right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 150, 175);
  doc.text(`  ${formatEntryDateForPdf(entry)}`, MARGIN + 24, y + DATE_H - 3);
  y += DATE_H;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(40, 30, 60);
  doc.text(entry.title, MARGIN, y + TITLE_H - 2);
  y += TITLE_H;

  // Story
  if (storyLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 60, 85);
    doc.text(storyLines, MARGIN, y + LINE_H - 1);
    y += storyLines.length * LINE_H;
  }

  // Image — aspect-ratio-preserving
  if (imgData) {
    y += 3;
    doc.setDrawColor(220, 200, 240);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, CONTENT_W, imgData.drawnH);
    doc.addImage(imgData.dataUrl, 'JPEG', MARGIN, y, CONTENT_W, imgData.drawnH, undefined, 'FAST');
    y += imgData.drawnH + 4;
  }

  // Separator line
  y += 3;
  doc.setDrawColor(230, 215, 245);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 10, y, PAGE_W - MARGIN - 10, y);
  y += SEP_H - 3;

  return y;
}

// ── Public: build the PDF doc object (paywall seam: caller decides to download) ──
export async function generatePdf(entries, babyName) {
  const sorted = [...entries].sort((a, b) => a.week - b.week);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Pre-load all images in parallel (returns { dataUrl, drawnH } or null)
  const imageDatas = await Promise.all(
    sorted.map(e => e.image_url ? loadImageDataUrl(e.image_url) : Promise.resolve(null))
  );

  // Pre-compute wrapped story lines for each entry
  doc.setFontSize(9.5);
  const storyLinesArr = sorted.map(e =>
    e.story ? doc.splitTextToSize(e.story, CONTENT_W) : []
  );

  // Cover page
  drawCoverPage(doc, babyName);
  doc.addPage();

  // Two-pass: count pages so header can show "Page X of Y"
  function countPages() {
    let y = HDR_H;
    let pages = 1;
    const usableH = PAGE_H - MARGIN;
    for (let i = 0; i < sorted.length; i++) {
      const h = entryHeight(storyLinesArr[i], imageDatas[i]);
      if (i > 0 && y + h > usableH) {
        pages++;
        y = HDR_H;
      }
      y += h;
    }
    return pages;
  }
  const totalPages = countPages();

  // Real render
  let y = HDR_H;
  let pageNum = 1;
  const usableH = PAGE_H - MARGIN;

  drawPageHeader(doc, babyName, pageNum, totalPages);

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const storyLines = storyLinesArr[i];
    const imgData = imageDatas[i];
    const h = entryHeight(storyLines, imgData);

    // Page break if needed (never break mid-entry)
    if (i > 0 && y + h > usableH) {
      doc.addPage();
      pageNum++;
      drawPageHeader(doc, babyName, pageNum, totalPages);
      y = HDR_H;
    }

    y = renderEntry(doc, entry, storyLines, imgData, y);
  }

  return doc;
}

// ── Public: trigger download (drop paywall logic here when ready) ─────────────
export function downloadPdf(doc, babyName) {
  const slug = (babyName || 'baby').toLowerCase().replace(/\s+/g, '-');
  doc.save(`${slug}-memory-journal.pdf`);
}
