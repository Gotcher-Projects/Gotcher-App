import React, { useState } from "react";
import { X } from "lucide-react";
import { TEMPLATES } from "@/lib/storybookTemplates";

function MomentHeroThumb({ template }) {
  const isLandscape = template.id === 'moment-hero-landscape';
  return (
    <div style={{ width: 58, height: 77, background: '#FDF6ED', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'visible', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3.5, background: '#FBCFE8', borderRadius: 100 }} />
      <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 34, height: 4.5, background: '#3C2010', borderRadius: 1, opacity: 0.45 }} />
      {isLandscape ? (
        <div style={{ position: 'absolute', top: 19, left: '50%', transform: 'translateX(-50%) rotate(-1.2deg)', width: 42, height: 30, background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.22)' }}>
          <div style={{ position: 'absolute', top: 2, left: 2, right: 2, height: 21, background: 'linear-gradient(135deg, #B0BEC5, #A5C4B0)' }} />
        </div>
      ) : (
        <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%) rotate(1.5deg)', width: 30, height: 37, background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.22)' }}>
          <div style={{ position: 'absolute', top: 2, left: 2, right: 2, height: 27, background: 'linear-gradient(135deg, #B0BEC5, #A5C4B0)' }} />
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 5, left: 4, right: 4, height: 13, background: '#FFF8E8', border: '1px solid #E5CB8A', borderRadius: 2 }} />
      <div style={{ position: 'absolute', bottom: 6, right: 5, fontSize: 5, color: '#FBCFE8', lineHeight: 1 }}>♥</div>
    </div>
  );
}

function LetterThumb() {
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {/* section label */}
      <div style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: 22, height: 2, background: '#C2A36B', borderRadius: 100 }} />
      {/* title */}
      <div style={{ position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%)', width: 32, height: 3.5, background: '#3A2E22', borderRadius: 1, opacity: 0.55 }} />
      {/* heart divider */}
      <div style={{ position: 'absolute', top: 21, left: '50%', transform: 'translateX(-50%)', fontSize: 5, color: '#C2A36B', lineHeight: 1 }}>♥</div>
      {/* body lines */}
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ position: 'absolute', top: 28 + i * 6, left: 8, width: i === 4 ? 26 : 42, height: 2, background: '#3A2E22', opacity: 0.22, borderRadius: 1 }} />
      ))}
      {/* signature */}
      <div style={{ position: 'absolute', bottom: 7, right: 7, width: 22, height: 4, background: '#9A7B4F', opacity: 0.5, borderRadius: 1, transform: 'skewX(-12deg)' }} />
    </div>
  );
}

function GalleryThumb() {
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {/* section label */}
      <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2, background: '#C2A36B', borderRadius: 100 }} />
      {/* title */}
      <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 30, height: 3, background: '#3A2E22', borderRadius: 1, opacity: 0.5 }} />
      {/* heart divider */}
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', fontSize: 4.5, color: '#C2A36B', lineHeight: 1 }}>♥</div>
      {/* 2×2 photo grid */}
      {[[8, 25], [31, 25], [8, 50], [31, 50]].map(([l, t], i) => (
        <div key={i} style={{ position: 'absolute', left: l, top: t, width: 19, height: 19, background: 'linear-gradient(135deg, #B0BEC5, #A5C4B0)', borderRadius: 2 }} />
      ))}
    </div>
  );
}

function BirthDayThumb() {
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {/* section label */}
      <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, background: '#C2A36B', borderRadius: 100 }} />
      {/* title */}
      <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 32, height: 3.5, background: '#3A2E22', borderRadius: 1, opacity: 0.5 }} />
      {/* polaroid photo */}
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', width: 30, height: 30, background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', padding: 2 }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #B0BEC5, #A5C4B0)' }} />
      </div>
      {/* stats strip */}
      {[8, 21, 34, 47].map((l, i) => (
        <div key={i} style={{ position: 'absolute', top: 53, left: l, width: 9, height: 5, background: '#3A2E22', opacity: 0.3, borderRadius: 1 }} />
      ))}
      {/* note lines */}
      {[0, 1].map(i => (
        <div key={i} style={{ position: 'absolute', top: 63 + i * 4, left: 11, width: 36, height: 1.5, background: '#3A2E22', opacity: 0.18, borderRadius: 1 }} />
      ))}
    </div>
  );
}

function PeopleThumb() {
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {/* section label */}
      <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 22, height: 2, background: '#C2A36B', borderRadius: 100 }} />
      {/* two profile columns */}
      {[8, 31].map((l, i) => (
        <React.Fragment key={i}>
          <div style={{ position: 'absolute', left: l, top: 16, width: 19, height: 19, borderRadius: '50%', background: 'linear-gradient(135deg, #C9B6F5, #A0C4F0)' }} />
          <div style={{ position: 'absolute', left: l + 2, top: 38, width: 15, height: 2.5, background: '#3A2E22', opacity: 0.45, borderRadius: 1 }} />
          {[0, 1, 2].map(j => (
            <div key={j} style={{ position: 'absolute', left: l, top: 44 + j * 4, width: 19, height: 1.5, background: '#3A2E22', opacity: 0.18, borderRadius: 1 }} />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function FamilyTreeThumb() {
  const line = (x1, y1, x2, y2, k) => <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbb89a" strokeWidth="0.8" />;
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, background: '#C2A36B', borderRadius: 100 }} />
      <svg width="58" height="77" style={{ position: 'absolute', inset: 0 }}>
        {line(14, 24, 26, 24, 'a')}{line(20, 24, 20, 38, 'b')}
        {line(34, 24, 46, 24, 'c')}{line(40, 24, 40, 38, 'd')}
        {line(20, 44, 40, 44, 'e')}{line(30, 44, 30, 56, 'f')}
      </svg>
      {[[14, 18], [26, 18], [34, 18], [46, 18]].map(([l, t], i) => (
        <div key={`g${i}`} style={{ position: 'absolute', left: l - 4, top: t - 4, width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#e6d3a8,#d8b58a)' }} />
      ))}
      {[[20, 38], [40, 38]].map(([l, t], i) => (
        <div key={`p${i}`} style={{ position: 'absolute', left: l - 5, top: t - 5, width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(135deg,#f5c6d0,#d9b8a0)' }} />
      ))}
      <div style={{ position: 'absolute', left: 30 - 6, top: 56 - 6, width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg,#C9B6F5,#A0C4F0)' }} />
    </div>
  );
}

function ChapterDividerThumb() {
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', width: 16, height: 2, background: '#C2A36B', opacity: 0.6, borderRadius: 100 }} />
      <div style={{ position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'rgba(217,123,138,0.18)' }} />
      <div style={{ position: 'absolute', top: 46, left: '50%', transform: 'translateX(-50%)', width: 34, height: 4, background: '#3A2E22', opacity: 0.5, borderRadius: 1 }} />
      <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', width: 22, height: 2.5, background: '#9A7B4F', opacity: 0.5, borderRadius: 1 }} />
      {[[8, 10], [48, 16], [10, 64], [46, 60]].map(([l, t], i) => (
        <div key={i} style={{ position: 'absolute', left: l, top: t, fontSize: 6, color: '#C2A36B', opacity: 0.5, lineHeight: 1 }}>✿</div>
      ))}
    </div>
  );
}

function PromptsThumb() {
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2, background: '#C2A36B', borderRadius: 100 }} />
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 30, height: 3, background: '#3A2E22', opacity: 0.5, borderRadius: 1 }} />
      {[0, 1, 2, 3].map(i => (
        <React.Fragment key={i}>
          <div style={{ position: 'absolute', top: 24 + i * 12, left: 8, width: 16, height: 2, background: '#C2A36B', opacity: 0.55, borderRadius: 1 }} />
          <div style={{ position: 'absolute', top: 29 + i * 12, left: 8, width: 36, height: 1.5, background: '#3A2E22', opacity: 0.2, borderRadius: 1 }} />
        </React.Fragment>
      ))}
    </div>
  );
}

function BumpThumb() {
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 22, height: 2, background: '#C2A36B', borderRadius: 100 }} />
      <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 28, height: 3, background: '#3A2E22', opacity: 0.5, borderRadius: 1 }} />
      {[8, 31].map((l, i) => (
        <div key={i} style={{ position: 'absolute', left: l, top: 19, width: 19, height: 32, background: 'linear-gradient(135deg,#b9c9d2,#cdd6cf)', borderRadius: 2 }}>
          <div style={{ position: 'absolute', left: 1.5, bottom: 1.5, width: 14, height: 4, background: 'rgba(255,255,255,0.92)', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 100 }} />
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: 6, left: 8, right: 8, height: 9, background: '#FFF8E8', border: '1px solid #E5CB8A', borderRadius: 2 }} />
    </div>
  );
}

function MilestonesThumb() {
  return (
    <div style={{ width: 58, height: 77, background: '#FBF7EF', border: '1px solid #DDD0B8', borderRadius: 3, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {/* section label + title (left aligned) */}
      <div style={{ position: 'absolute', top: 7, left: 7, width: 16, height: 2, background: '#C2A36B', borderRadius: 100 }} />
      <div style={{ position: 'absolute', top: 12, left: 7, width: 28, height: 3, background: '#3A2E22', opacity: 0.5, borderRadius: 1 }} />
      {/* milestone list — left column, ticked rows */}
      {[0, 1, 2, 3].map(i => (
        <React.Fragment key={i}>
          <div style={{ position: 'absolute', top: 23 + i * 9, left: 7, width: 4, height: 4, borderRadius: '50%', background: 'rgba(123,168,107,0.5)' }} />
          <div style={{ position: 'absolute', top: 24 + i * 9, left: 13, width: 18, height: 2, background: '#3A2E22', opacity: 0.3, borderRadius: 1 }} />
        </React.Fragment>
      ))}
      {/* two tilted polaroids, right corners */}
      <div style={{ position: 'absolute', top: 19, right: 4, width: 18, height: 20, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.22)', transform: 'rotate(5deg)', padding: 1.5 }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#f5c6d0,#d9b8a0)' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 7, right: 7, width: 19, height: 21, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.22)', transform: 'rotate(-6deg)', padding: 1.5 }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#cfe0c0,#a8c89a)' }} />
      </div>
    </div>
  );
}

// Generic preview built from a template's normalized block boxes — works for any
// template without per-id markup.
function TemplateThumb({ template }) {
  if (template.renderer === 'moment_hero') return <MomentHeroThumb template={template} />;
  if (template.renderer === 'letter') return <LetterThumb />;
  if (template.renderer === 'gallery') return <GalleryThumb />;
  if (template.renderer === 'birth_day') return <BirthDayThumb />;
  if (template.renderer === 'people') return <PeopleThumb />;
  if (template.renderer === 'family_tree') return <FamilyTreeThumb />;
  if (template.renderer === 'chapter_divider') return <ChapterDividerThumb />;
  if (template.renderer === 'prompts') return <PromptsThumb />;
  if (template.renderer === 'bump') return <BumpThumb />;
  if (template.renderer === 'milestones') return <MilestonesThumb />;

  // l-wrap is a single block; the generic box renderer would show one flat
  // rectangle. Draw the float shape instead: photo top-right, text bars wrapping.
  if (template.blocks.length === 1 && template.blocks[0].type === 'l-wrap') {
    const b = template.blocks[0];
    const pad = 0.04;
    return (
      <div className="relative bg-[#fdf9f2] border border-[#ddd0b8] rounded overflow-hidden" style={{ width: 58, height: 77 }}>
        {/* Photo — top-right, 47% of the block */}
        <div
          className="absolute rounded-[1px] bg-color-highlight/45"
          style={{
            left: `${(b.x + b.width * 0.53) * 100}%`, top: `${b.y * 100}%`,
            width: `${b.width * 0.47 * 100}%`, height: `${b.height * 0.47 * 100}%`,
          }}
        />
        {/* Text bars beside the photo (left column) */}
        {[0, 1, 2].map(i => (
          <div key={`l${i}`} className="absolute rounded-[1px] bg-color-highlight/30"
            style={{
              left: `${(b.x + pad) * 100}%`, top: `${(b.y + pad + i * 0.06) * 100}%`,
              width: `${b.width * 0.40 * 100}%`, height: '2.5%',
            }}
          />
        ))}
        {/* Full-width text bars below the photo */}
        {[0, 1, 2, 3].map(i => (
          <div key={`f${i}`} className="absolute rounded-[1px] bg-color-highlight/30"
            style={{
              left: `${(b.x + pad) * 100}%`,
              top: `${(b.y + b.height * 0.47 + pad + i * 0.06) * 100}%`,
              width: `${(b.width - pad * 2) * 100}%`, height: '2.5%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative bg-[#fdf9f2] border border-[#ddd0b8] rounded overflow-hidden" style={{ width: 58, height: 77 }}>
      {template.blocks.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-[1px] ${
            b.overlay ? 'bg-black/60' :
            b.type === 'photo' ? 'bg-color-highlight/45' : 'bg-color-highlight/20'
          }`}
          style={{
            left: `${b.x * 100}%`, top: `${b.y * 100}%`,
            width: `${b.width * 100}%`, height: `${b.height * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

const FILTER_PILLS = [
  { id: 'all',      label: 'All',               match: () => true },
  { id: '1-memory', label: '1 Memory',           match: t => t.memoryCount === 1 },
  { id: 'multi',    label: 'Multiple Memories',  match: t => t.memoryCount >= 2 },
  { id: 'photo',    label: 'Photo Only',         match: t => t.memoryCount === 0 && t.maxPhotos > 0 },
];

export default function TemplateSheet({ currentTemplateId, onSelect, onClose }) {
  const [filter, setFilter] = useState('all');
  const activeFilter = FILTER_PILLS.find(p => p.id === filter);
  const visible = TEMPLATES.filter(activeFilter.match);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center md:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-background rounded-t-2xl md:rounded-2xl p-4 space-y-4 max-h-[72vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Choose a layout</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_PILLS.map(pill => (
            <button
              key={pill.id}
              onClick={() => setFilter(pill.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === pill.id
                  ? 'bg-color-highlight text-white'
                  : 'bg-color-warm/20 text-muted-foreground hover:bg-color-warm/40'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {visible.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                currentTemplateId === t.id
                  ? 'border-color-highlight bg-color-warm/10'
                  : 'border-transparent hover:border-color-highlight/30 hover:bg-color-warm/5'
              }`}
            >
              <TemplateThumb template={t} />
              <span className="text-[11px] font-medium text-center leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
