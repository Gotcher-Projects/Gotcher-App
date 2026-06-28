import React from 'react';
import { formatDate } from '@/lib/formatting';

// "The Day We Met You" birth-day page — a layout-system page type like LetterCanvas/GalleryCanvas:
// drawn at the 600×800 virtual canvas (position:absolute/inset:0). UNLIKE those, it is fully
// DATA-DRIVEN (live read): it ignores blocks entirely and renders from the birthDetails prop +
// babyName/birthdate/coverPhotoUrl threaded through the render pipeline (sv2-s2). The data is
// entered in the Edit-Profile modal's "Birth details" tab, so there is no in-page editing.
//
// Units are imperial (lbs / inches) to match the rest of the app.

const GOLD = '#C2A36B';

function fmtTime(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function Stat({ label, value, ink, sub }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: sub }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3, color: ink, fontFamily: "'Playfair Display', Georgia, serif" }}>
        {value || '—'}
      </div>
    </div>
  );
}

export default function BirthDayCanvas({ birthDetails, babyName, birthdate, coverPhotoUrl, theme }) {
  const bd = birthDetails || {};
  const bg  = theme?.bg ?? '#FBF7EF';
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';
  const sub = theme?.isDark ? (theme.textColor ?? '#cdd2ee') : '#A07860';

  const photo = bd.birthPhotoUrl || coverPhotoUrl || null;
  const dateStr = birthdate ? formatDate(birthdate) : null;
  const subtitleParts = [dateStr, bd.hospital].filter(Boolean);

  const weight = bd.weightLbs != null ? `${bd.weightLbs} lb` : null;
  const length = bd.heightIn != null ? `${bd.heightIn}"` : null;
  const head   = bd.headIn != null ? `${bd.headIn}"` : null;
  const time   = fmtTime(bd.birthTime);

  const story = (bd.birthStory || '').trim();

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '46px 44px 40px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: "'Lato', sans-serif",
    }}>
      {/* Section label (chrome) */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: GOLD, textAlign: 'center' }}>
        The moment our world changed forever
      </div>

      {/* Title */}
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: ink, marginTop: 10, textAlign: 'center', lineHeight: 1.1 }}>
        The day we met you
      </div>

      {/* Subtitle: date · hospital */}
      {subtitleParts.length > 0 && (
        <div style={{ fontSize: 13, fontStyle: 'italic', color: sub, marginTop: 6, textAlign: 'center' }}>
          {subtitleParts.join('  ·  ')}
        </div>
      )}

      {/* Hero photo (polaroid framing) */}
      <div style={{
        marginTop: 18,
        width: 248, height: 248,
        background: '#fff',
        padding: 10,
        boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
        flexShrink: 0,
      }}>
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#E7E2D8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photo
            ? <img src={photo} alt={babyName || 'Baby'} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ fontSize: 11, color: '#A89F8E' }}>Add a birth photo</span>}
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', marginTop: 22, gap: 4 }}>
        <Stat label="Weight" value={weight} ink={ink} sub={sub} />
        <Stat label="Length" value={length} ink={ink} sub={sub} />
        <Stat label="Head" value={head} ink={ink} sub={sub} />
        <Stat label="Time" value={time} ink={ink} sub={sub} />
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '20px 0 16px', width: '100%' }}>
        <div style={{ height: 1, flex: 1, background: GOLD, opacity: 0.3 }} />
        <span style={{ fontSize: 12, color: GOLD, lineHeight: 1 }}>♥</span>
        <div style={{ height: 1, flex: 1, background: GOLD, opacity: 0.3 }} />
      </div>

      {/* Note card — parent's birth story */}
      <div style={{ flex: 1, minHeight: 0, width: '100%', overflow: 'hidden', textAlign: 'center' }}>
        {story
          ? <p style={{ fontStyle: 'italic', fontSize: 14.5, lineHeight: 1.7, color: ink, margin: 0, fontFamily: "'Merriweather', Georgia, serif" }}>{story}</p>
          : <p style={{ fontStyle: 'italic', fontSize: 13, color: sub, opacity: 0.6, margin: 0 }}>
              Add the story of the day you arrived in your profile.
            </p>}
      </div>
    </div>
  );
}
