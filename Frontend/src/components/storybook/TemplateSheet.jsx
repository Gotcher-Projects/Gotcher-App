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

// Generic preview built from a template's normalized block boxes — works for any
// template without per-id markup.
function TemplateThumb({ template }) {
  if (template.renderer === 'moment_hero') return <MomentHeroThumb template={template} />;

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
  { id: 'photo',    label: 'Photo Only',         match: t => t.memoryCount === 0 },
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
