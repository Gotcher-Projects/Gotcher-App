import { createRoot } from 'react-dom/client';
import React from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import LayoutRenderer from '@/components/storybook/LayoutRenderer';
import MomentHeroCanvas from '@/components/storybook/MomentHeroCanvas';
import LetterCanvas from '@/components/storybook/LetterCanvas';
import GalleryCanvas from '@/components/storybook/GalleryCanvas';
import BirthDayCanvas from '@/components/storybook/BirthDayCanvas';
import PeopleCanvas from '@/components/storybook/PeopleCanvas';
import FamilyTreeCanvas from '@/components/storybook/FamilyTreeCanvas';
import ChapterDividerCanvas from '@/components/storybook/ChapterDividerCanvas';
import PromptsCanvas from '@/components/storybook/PromptsCanvas';
import BumpCanvas from '@/components/storybook/BumpCanvas';
import MilestonesCanvas from '@/components/storybook/MilestonesCanvas';
import { formatDate } from '@/lib/formatting';
import { cleanBodyText } from '@/lib/storybookText';
import { CANVAS_W, CANVAS_H } from '@/lib/bookCanvas';

// PDF page size: 3:4 portrait, 150×200mm.
const PDF_W = 150;
const PDF_H = 200;

// theme.fontClass → CSS font-family (for cover / classic DOM elements only;
// LayoutRenderer pages use Tailwind classes from the loaded stylesheet directly).
const FONT_CLASS_MAP = {
  'font-serif':   'Georgia, serif',
  'font-playf':   '"Playfair Display", Georgia, serif',
  'font-merri':   '"Merriweather", Georgia, serif',
  'font-sans':    'system-ui, sans-serif',
  'font-lato':    '"Lato", system-ui, sans-serif',
  'font-nunito':  '"Nunito", system-ui, sans-serif',
  'font-display': '"Poppins", system-ui, sans-serif',
};

// Capture an already-in-DOM element at the virtual canvas size with html2canvas at 2× scale for
// print quality, returning a JPEG data URL. Waits for fonts and any contained images to load plus a
// short settle for trailing paint. Shared by every capture path so the html2canvas options stay in
// lock-step.
async function captureElement(el, bgColor) {
  await document.fonts.ready;

  // Wait for any images inside the element to fully load.
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(imgs.map(img =>
    img.complete
      ? Promise.resolve()
      : new Promise(r => { img.onload = r; img.onerror = r; })
  ));

  // Small additional settle for any trailing paint.
  await new Promise(r => setTimeout(r, 100));

  const canvas = await html2canvas(el, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: bgColor,
    logging: false,
    x: 0,
    y: 0,
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}

// Render a React element off-screen at the virtual canvas size, then capture it.
//
// Uses position:absolute (NOT position:fixed) so the element is off the visible
// viewport without overlaying it — position:fixed at y=0 would bleed the live app
// UI into the capture when backgroundColor is not opaque.
async function captureComponent(jsx, bgColor, accentColor) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:absolute',
    'top:-9999px',
    'left:0',
    `width:${CANVAS_W}px`,
    `height:${CANVAS_H}px`,
    'overflow:hidden',
  ].join(';');
  // Provide --book-accent so .book-drop-cap gets the correct color.
  if (accentColor) wrapper.style.setProperty('--book-accent', accentColor);
  document.body.appendChild(wrapper);

  const root = createRoot(wrapper);
  root.render(jsx);

  // Wait for ResizeObserver (inside LayoutRenderer) to fire, React to re-render
  // with the correct scale, and useLayoutEffect (useFittedFontSize) to size text.
  await new Promise(r => setTimeout(r, 400));

  const dataUrl = await captureElement(wrapper, bgColor || '#fdf9f2');

  root.unmount();
  document.body.removeChild(wrapper);

  return dataUrl;
}

// Build a read-only cover DOM element (no React / no edit controls).
// position:absolute keeps it off-screen without overlaying the viewport.
function buildCoverElement(babyName, birthdate, coverPhotoUrl, coverSubtitle, theme) {
  const bg         = theme?.bg         ?? '#fdf9f2';
  const accent     = theme?.accent     ?? '#c9a96e';
  const textColor  = theme?.textColor  ?? '#2d2013';
  const divider    = theme?.dividerChar ?? '◆';
  const fontFamily = FONT_CLASS_MAP[theme?.fontClass] ?? 'Georgia, serif';

  const defaultSubtitle = birthdate
    ? `A memory book · Born ${formatDate(birthdate)}`
    : 'A memory book';
  const subtitle = coverSubtitle ?? defaultSubtitle;

  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute',
    'top:-9999px',
    'left:0',
    `width:${CANVAS_W}px`,
    `height:${CANVAS_H}px`,
    `background-color:${bg}`,
    'overflow:hidden',
    `font-family:${fontFamily}`,
    `color:${textColor}`,
    'display:flex',
    'flex-direction:column',
  ].join(';');

  // Photo area — top 55% of page
  const photoH = Math.round(CANVAS_H * 0.55);
  const photoArea = document.createElement('div');
  photoArea.style.cssText = `width:100%;height:${photoH}px;overflow:hidden;flex-shrink:0;`;
  if (coverPhotoUrl) {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = coverPhotoUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    photoArea.appendChild(img);
  } else {
    photoArea.style.backgroundColor = accent + '22';
  }
  el.appendChild(photoArea);

  // Text area — bottom 45%
  const textArea = document.createElement('div');
  textArea.style.cssText = [
    'flex:1',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'padding:32px 40px',
    'text-align:center',
    'box-sizing:border-box',
  ].join(';');

  const divRow = document.createElement('div');
  divRow.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;margin-bottom:16px;';
  const l1 = document.createElement('div'); l1.style.cssText = `flex:1;height:1px;background:${accent};opacity:0.3;`;
  const dot = document.createElement('span'); dot.style.cssText = `font-size:10px;color:${accent};opacity:0.5;`; dot.textContent = divider;
  const l2 = document.createElement('div'); l2.style.cssText = `flex:1;height:1px;background:${accent};opacity:0.3;`;
  divRow.appendChild(l1); divRow.appendChild(dot); divRow.appendChild(l2);
  textArea.appendChild(divRow);

  const title = document.createElement('h2');
  title.style.cssText = `font-size:28px;font-weight:600;margin:0 0 10px;color:${textColor};line-height:1.3;`;
  title.textContent = `${babyName || 'Baby'}'s Memory Book`;
  textArea.appendChild(title);

  const sub = document.createElement('p');
  sub.style.cssText = `font-size:14px;margin:0;color:${textColor};opacity:0.6;`;
  sub.textContent = subtitle;
  textArea.appendChild(sub);

  el.appendChild(textArea);
  return el;
}

// Capture the cover DOM element (not React-based).
async function captureCoverElement(el, bgColor) {
  document.body.appendChild(el);
  const dataUrl = await captureElement(el, bgColor);
  document.body.removeChild(el);
  return dataUrl;
}

/**
 * Generate a jsPDF document from published storybook chapters.
 *
 * For v2 layout chapters, renders each page through the actual <LayoutRenderer>
 * component off-screen at the virtual canvas size (600×800, scale=1) so the
 * output is 1:1 with what the user sees on screen — same fonts, same text sizing,
 * same photo positions.
 *
 * @param {Array}  chapters  - sorted ChapterResponse array (all statuses; filters to published)
 * @param {object} theme     - active book theme object from bookThemes.js
 * @param {object} coverInfo - { babyName, birthdate, coverPhotoUrl, coverSubtitle }
 * @returns {Promise<jsPDF>}
 */
export async function generateStorybookPdf(chapters, theme, coverInfo = {}) {
  const published = chapters.filter(c => c.status === 'published');
  if (published.length === 0) throw new Error('No published chapters to export');

  const doc = new jsPDF({ unit: 'mm', format: [PDF_W, PDF_H] });
  let firstPage = true;

  function addPage(dataUrl) {
    if (!firstPage) doc.addPage([PDF_W, PDF_H]);
    doc.addImage(dataUrl, 'JPEG', 0, 0, PDF_W, PDF_H);
    firstPage = false;
  }

  // Cover page
  const { babyName, birthdate, coverPhotoUrl, coverSubtitle, pageData } = coverInfo;
  const coverEl  = buildCoverElement(babyName, birthdate, coverPhotoUrl, coverSubtitle, theme);
  const coverUrl = await captureCoverElement(coverEl, theme?.bg ?? '#fdf9f2');
  addPage(coverUrl);

  // Chapter pages
  for (const chapter of published) {
    const hasLayoutV2 = chapter.layoutData?.version === 2;

    if (hasLayoutV2) {
      const pages = chapter.layoutData.pages || [];
      for (const page of pages) {
        const pageBg = page.backgroundColor || theme?.bg || '#fdf9f2';
        // Render the actual LayoutRenderer at 600px wide (scale=1, no CSS transform).
        // At this size LayoutRenderer renders identically to what the user sees on screen.
        const isMomentHero = page.templateId?.startsWith('moment-hero');
        const isLetter = page.templateId === 'letter';
        const isGallery = page.templateId === 'gallery';
        const isBirthDay = page.templateId === 'birth_day';
        const isPeople = page.templateId === 'people';
        const isFamilyTree = page.templateId === 'family_tree';
        const isChapterDivider = page.templateId === 'chapter_divider';
        const isPrompts = page.templateId === 'prompts';
        const isBump = page.templateId === 'bump';
        const isMilestones = page.templateId === 'milestones';
        const dataUrl = await captureComponent(
          isMomentHero
            ? React.createElement(MomentHeroCanvas, {
                blocks: page.blocks || [],
                orientation: page.templateId === 'moment-hero-landscape' ? 'landscape' : 'portrait',
                theme,
              })
            : isLetter
            ? React.createElement(LetterCanvas, {
                blocks: page.blocks || [],
                theme,
                eyebrow: chapter.anchorType === 'guided' ? chapter.anchorLabel : undefined,
              })
            : isGallery
            ? React.createElement(GalleryCanvas, { blocks: page.blocks || [], theme })
            : isBirthDay
            ? React.createElement(BirthDayCanvas, {
                birthDetails: pageData?.birthDetails,
                babyName: pageData?.babyName ?? babyName,
                birthdate: pageData?.birthdate ?? birthdate,
                coverPhotoUrl: pageData?.coverPhotoUrl ?? coverPhotoUrl,
                theme,
              })
            : isPeople
            ? React.createElement(PeopleCanvas, {
                blocks: page.blocks || [],
                familyMembers: pageData?.familyMembers,
                theme,
              })
            : isFamilyTree
            ? React.createElement(FamilyTreeCanvas, {
                familyMembers: pageData?.familyMembers,
                babyName: pageData?.babyName ?? babyName,
                coverPhotoUrl: pageData?.coverPhotoUrl ?? coverPhotoUrl,
                theme,
              })
            : isChapterDivider
            ? React.createElement(ChapterDividerCanvas, { blocks: page.blocks || [], theme })
            : isPrompts
            ? React.createElement(PromptsCanvas, { blocks: page.blocks || [], theme })
            : isBump
            ? React.createElement(BumpCanvas, { blocks: page.blocks || [], theme })
            : isMilestones
            ? React.createElement(MilestonesCanvas, { blocks: page.blocks || [], theme, achievedMilestones: pageData?.achievedMilestones })
            : React.createElement(LayoutRenderer, {
                layout: { version: 2, pages: [page] },
                theme,
                pageData,
              }),
          pageBg,
          theme?.accent
        );
        addPage(dataUrl);
      }
    } else if (chapter.body) {
      // Classic chapter — plain text render matching the on-screen published view.
      const bg         = theme?.bg ?? '#fdf9f2';
      const textColor  = theme?.textColor ?? '#2d2013';
      const accent     = theme?.accent ?? '#c9a96e';
      const fontFamily = FONT_CLASS_MAP[theme?.fontClass] ?? 'Georgia, serif';

      const wrapper = document.createElement('div');
      wrapper.style.cssText = [
        'position:absolute', 'top:-9999px', 'left:0',
        `width:${CANVAS_W}px`, `height:${CANVAS_H}px`,
        `background-color:${bg}`, 'overflow:hidden',
        `font-family:${fontFamily}`, `color:${textColor}`,
        'padding:48px 40px', 'box-sizing:border-box',
      ].join(';');

      const titleEl = document.createElement('h2');
      titleEl.style.cssText = `font-size:22px;font-weight:600;text-align:center;margin:0 0 12px;color:${textColor};line-height:1.3;`;
      titleEl.textContent = chapter.anchorLabel || '';
      wrapper.appendChild(titleEl);

      const divEl = document.createElement('div');
      divEl.style.cssText = `height:1px;background:${accent};opacity:0.3;margin:0 40px 20px;`;
      wrapper.appendChild(divEl);

      const bodyEl = document.createElement('div');
      bodyEl.style.cssText = `font-size:15px;line-height:1.8;overflow:hidden;`;
      const rawText = cleanBodyText(chapter.body);
      bodyEl.innerHTML = rawText
        .split(/\n{2,}/)
        .map(p => `<p style="margin:0 0 12px;">${p.trim()}</p>`)
        .join('');
      wrapper.appendChild(bodyEl);

      document.body.appendChild(wrapper);
      const dataUrl = await captureElement(wrapper, bg);
      document.body.removeChild(wrapper);
      addPage(dataUrl);
    }
  }

  return doc;
}

export function downloadPdf(doc, babyName) {
  const slug = (babyName || 'storybook').toLowerCase().replace(/\s+/g, '-');
  doc.save(`${slug}-storybook.pdf`);
}
