import React from 'react';
import { CircleInitial } from '@/lib/bookCanvas';

// "Your People" page — a layout-system page type like LetterCanvas/GalleryCanvas, drawn at the
// 600×800 virtual canvas. DATA-DRIVEN (live read): renders the family_members threaded in via the
// familyMembers prop, picking which to show + the layout variant from the page's config block
// (sv2-s3). The roster + per-page selection are edited in the FamilyRosterPopup (builder).
//
// Block config: a single block { type:'people-config', selectedMemberIds:[...], variant:'two-up'|'spotlight' }.
// The config block may also carry optional `sectionLabel` + `title` copy overrides (pr5.5), so a second
// `people` page (e.g. "About Us" seeded with the parents) reuses this exact renderer with different copy —
// no new component. Absent those fields, the header falls back to the original "Your People" defaults.

const GOLD = '#C2A36B';

const DEFAULT_SECTION_LABEL = 'Your People';
const DEFAULT_TITLE = 'The people who love you';

function Person({ m, ink, big }) {
  const size = big ? 220 : 156;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: 1, minWidth: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: 'linear-gradient(135deg,#C9B6F5,#A0C4F0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
      }}>
        {m.photoUrl
          ? <img src={m.photoUrl} alt={m.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }} />
          : <CircleInitial letter={m.name} />}
      </div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: big ? 32 : 24, color: ink, marginTop: big ? 22 : 18 }}>
        {m.name}
      </div>
      {m.role && (
        <div style={{ fontSize: big ? 14 : 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginTop: 6 }}>
          {m.role}
        </div>
      )}
      {m.bio && (
        <p style={{ fontStyle: 'italic', fontSize: big ? 17 : 14.5, lineHeight: 1.7, color: ink, marginTop: big ? 18 : 14, fontFamily: "'Merriweather', Georgia, serif", maxWidth: big ? 420 : 250 }}>
          {m.bio}
        </p>
      )}
    </div>
  );
}

export default function PeopleCanvas({ blocks = [], familyMembers = [], theme }) {
  const bg  = theme?.bg ?? '#FBF7EF';
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';
  const sub = theme?.isDark ? (theme.textColor ?? '#cdd2ee') : '#A07860';

  const config = blocks.find(b => b.type === 'people-config') || blocks[0] || {};
  const variant = config.variant === 'spotlight' ? 'spotlight' : 'two-up';
  const selectedIds = Array.isArray(config.selectedMemberIds) ? config.selectedMemberIds : [];
  const sectionLabel = config.sectionLabel || DEFAULT_SECTION_LABEL;
  const title = config.title || DEFAULT_TITLE;

  const roster = familyMembers || [];
  const take = variant === 'spotlight' ? 1 : 2;
  // Resolve selected ids → members (preserving selection order); fall back to the roster start.
  let members = selectedIds
    .map(id => roster.find(m => m.id === id))
    .filter(Boolean);
  if (members.length === 0) {
    // No explicit selection yet: prefer members of the config's defaultCategory (pr5.5 "About Us" → parents),
    // then fall back to the roster start so the page is never empty when family exists.
    const preferred = config.defaultCategory
      ? roster.filter(m => m.roleCategory === config.defaultCategory)
      : [];
    members = (preferred.length ? preferred : roster).slice(0, take);
  }

  const shown = variant === 'spotlight' ? members.slice(0, 1) : members.slice(0, 2);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      padding: '48px 44px 44px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: "'Lato', sans-serif",
    }}>
      {/* Section label */}
      <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: GOLD, flexShrink: 0 }}>
        {sectionLabel}
      </div>

      {/* Title */}
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, fontWeight: 700, color: ink, marginTop: 10, textAlign: 'center', flexShrink: 0 }}>
        {title}
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '16px 0 26px', flexShrink: 0 }}>
        <div style={{ height: 1, width: 48, background: GOLD, opacity: 0.35 }} />
        <span style={{ fontSize: 12, color: GOLD, lineHeight: 1 }}>♥</span>
        <div style={{ height: 1, width: 48, background: GOLD, opacity: 0.35 }} />
      </div>

      {/* People — vertically centred in the remaining space so the page doesn't top-crowd */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        {shown.length > 0
          ? shown.map(m => <Person key={m.id} m={m} ink={ink} big={variant === 'spotlight'} />)
          : <p style={{ fontStyle: 'italic', fontSize: 13, color: sub, opacity: 0.6 }}>
              Add people to feature on this page.
            </p>}
      </div>
    </div>
  );
}
