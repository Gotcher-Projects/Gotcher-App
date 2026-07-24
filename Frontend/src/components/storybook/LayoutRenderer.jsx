import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CANVAS_W, CANVAS_H, renderBlocks, useCanvasScale, DROP_CAP_FREE_TEMPLATES } from "@/lib/bookCanvas";
import MomentHeroCanvas from "@/components/storybook/MomentHeroCanvas";
import LetterCanvas from "@/components/storybook/LetterCanvas";
import GalleryCanvas from "@/components/storybook/GalleryCanvas";
import BirthDayCanvas from "@/components/storybook/BirthDayCanvas";
import PeopleCanvas from "@/components/storybook/PeopleCanvas";
import FamilyTreeCanvas from "@/components/storybook/FamilyTreeCanvas";
import ChapterDividerCanvas from "@/components/storybook/ChapterDividerCanvas";
import PromptsCanvas from "@/components/storybook/PromptsCanvas";
import BumpCanvas from "@/components/storybook/BumpCanvas";
import MilestonesCanvas from "@/components/storybook/MilestonesCanvas";

export default function LayoutRenderer({ layout, theme, pageData, letterEyebrow, scaleMode }) {
  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const touchStartX = useRef(null);

  const { containerSize, scale } = useCanvasScale(containerRef);

  // pr5.5 Part B: the print route passes scaleMode="zoom". `transform: scale()` makes Chrome emit a
  // per-page /Transparency group (which forces Lulu's flatten to rasterize the whole page); CSS `zoom`
  // scales identically with NO group, keeping the PDF vector. On screen (scaleMode undefined) we keep
  // transform — `zoom` isn't in every browser and this path is print-only.
  const scaleStyle = scaleMode === 'zoom'
    ? { zoom: scale }
    : { transform: `scale(${scale})`, transformOrigin: 'top left' };

  if (layout?.version === 2) {
    const pages = layout.pages || [];
    const page = pages[currentPage] || {};
    const blocks = page.blocks || [];
    const pageBg = page.backgroundColor || theme?.bg || '#fdf9f2';

    return (
      <div>
        <div
          ref={containerRef}
          className="relative w-full mx-auto overflow-hidden"
          style={{ aspectRatio: '3 / 4' }}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) < 50) return;
            if (delta < 0) setCurrentPage(p => Math.min(pages.length - 1, p + 1));
            else setCurrentPage(p => Math.max(0, p - 1));
          }}
        >
          {containerSize > 0 && (
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: CANVAS_W, height: CANVAS_H,
              ...scaleStyle,
              backgroundColor: pageBg,
            }}>
              {page.templateId?.startsWith('moment-hero') ? (
                <MomentHeroCanvas
                  blocks={blocks}
                  orientation={page.templateId === 'moment-hero-landscape' ? 'landscape' : 'portrait'}
                  theme={theme}
                />
              ) : page.templateId === 'letter' ? (
                <LetterCanvas blocks={blocks} theme={theme} eyebrow={letterEyebrow} />
              ) : page.templateId === 'gallery' ? (
                <GalleryCanvas blocks={blocks} theme={theme} />
              ) : page.templateId === 'birth_day' ? (
                <BirthDayCanvas
                  birthDetails={pageData?.birthDetails}
                  babyName={pageData?.babyName}
                  birthdate={pageData?.birthdate}
                  coverPhotoUrl={pageData?.coverPhotoUrl}
                  theme={theme}
                />
              ) : page.templateId === 'people' ? (
                <PeopleCanvas blocks={blocks} familyMembers={pageData?.familyMembers} theme={theme} />
              ) : page.templateId === 'family_tree' ? (
                <FamilyTreeCanvas
                  familyMembers={pageData?.familyMembers}
                  babyName={pageData?.babyName}
                  coverPhotoUrl={pageData?.coverPhotoUrl}
                  theme={theme}
                />
              ) : page.templateId === 'chapter_divider' ? (
                <ChapterDividerCanvas blocks={blocks} theme={theme} />
              ) : page.templateId === 'prompts' ? (
                <PromptsCanvas blocks={blocks} theme={theme} />
              ) : page.templateId === 'bump' ? (
                <BumpCanvas blocks={blocks} theme={theme} />
              ) : page.templateId === 'milestones' ? (
                <MilestonesCanvas blocks={blocks} theme={theme} achievedMilestones={pageData?.achievedMilestones} />
              ) : (
                renderBlocks(blocks, theme, { suppressDropCap: DROP_CAP_FREE_TEMPLATES.has(page.templateId) })
              )}
            </div>
          )}
        </div>
        {pages.length > 1 && (
          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {currentPage + 1} / {pages.length}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
              disabled={currentPage === pages.length - 1}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // v1: single-page (existing behavior)
  const blocks = layout?.blocks || [];
  const v1Bg = theme?.bg || '#fdf9f2';
  return (
    <div
      ref={containerRef}
      className="relative w-full mx-auto overflow-hidden"
      style={{ aspectRatio: '3 / 4' }}
    >
      {containerSize > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: CANVAS_W, height: CANVAS_H,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          backgroundColor: v1Bg,
        }}>
          {renderBlocks(blocks, theme)}
        </div>
      )}
    </div>
  );
}
