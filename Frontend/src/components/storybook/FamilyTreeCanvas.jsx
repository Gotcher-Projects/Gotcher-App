import React from 'react';
import { CircleInitial } from '@/lib/bookCanvas';

// "Your Family Tree" page — a layout-system page type like PeopleCanvas, drawn at the 600×800
// virtual canvas (position:absolute/inset:0). DATA-DRIVEN (live read): it ignores blocks and
// renders the family_members threaded in via the familyMembers prop, plus the baby (babyName +
// coverPhotoUrl) as the bottom node. Members are placed by roleCategory:
//   grandparent → top tier (up to 4 slots)   parent → middle tier (up to 2)   sibling → beside baby
//   other → not shown in the tree (they appear on the People page instead)
//
// RENDER APPROACH (sv2-s5): SVG draws ONLY the connector lines; the avatar nodes are HTML divs
// overlaid on top. This is deliberate — html2canvas does not reliably capture SVG <image>, so a
// pure-SVG tree would not export to PDF. HTML <img> avatars + an SVG line layer both capture cleanly.
// No <foreignObject> anywhere (also uncaptured by html2canvas).

const GOLD = '#C2A36B';
const LINE = '#cbb89a';

// Tier geometry in full-page (600×800) pixel space. Connectors route through the vertical gaps
// between avatars so they never cross the centered name/role labels.
const G = { y: 210, r: 42, slots: [95, 215, 385, 505], barY: 262 };   // grandparents
const P = { y: 400, r: 52, mumX: 155, dadX: 445, barY: 462 };          // parents
const C = { y: 620, babyR: 60, sibR: 46, centerX: 300, barY: 520 };    // children (baby + siblings)
const SIB_SPACING = 150;

const NODE_GRADIENTS = [
  'linear-gradient(135deg,#f5c6d0,#d9b8a0)',
  'linear-gradient(135deg,#e6d3a8,#d8b58a)',
  'linear-gradient(135deg,#cfc0e0,#b8a0d0)',
  'linear-gradient(135deg,#b9c9d2,#cdd6cf)',
];
const BABY_GRADIENT = 'linear-gradient(135deg,#C9B6F5,#A0C4F0)';

// One avatar node: circular photo (or initial), name, role — centered on (x, y).
function Node({ x, y, r, gradient, name, role, photoUrl, ink }) {
  const labelW = r * 2 + 80;
  return (
    <>
      {/* White ring as an OUTER rounded div with padding (not a CSS `border`) — html2canvas squares
          the corners of border + border-radius, so the ring is the white background showing through
          the padding, and the photo is clipped by an inner rounded div + a rounded <img>. */}
      <div style={{
        position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2,
        borderRadius: '50%', background: '#fff', padding: 3, boxSizing: 'border-box',
        boxShadow: '0 5px 14px rgba(0,0,0,0.14)',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {photoUrl
            ? <img src={photoUrl} alt={name || ''} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '50%' }} />
            : <CircleInitial letter={name} />}
        </div>
      </div>
      <div style={{ position: 'absolute', left: x - labelW / 2, top: y + r + 8, width: labelW, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: r > 50 ? 20 : 16, color: ink, lineHeight: 1.15 }}>
          {name || ''}
        </div>
        {role && (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, marginTop: 3 }}>
            {role}
          </div>
        )}
      </div>
    </>
  );
}

export default function FamilyTreeCanvas({ familyMembers = [], babyName, coverPhotoUrl, theme }) {
  const bg  = theme?.bg ?? '#FBF7EF';
  const ink = theme?.isDark ? (theme.textColor ?? '#e8eaf6') : '#2C1810';
  const sub = theme?.isDark ? (theme.textColor ?? '#cdd2ee') : '#A07860';

  const roster = familyMembers || [];
  const grandparents = roster.filter(m => m.roleCategory === 'grandparent').slice(0, 4);
  const parents      = roster.filter(m => m.roleCategory === 'parent').slice(0, 2);
  const siblings     = roster.filter(m => m.roleCategory === 'sibling').slice(0, 3);

  const hasAny = grandparents.length + parents.length > 0;

  // Children row: baby first, then any siblings, centered as a group on C.centerX.
  const baby = { name: babyName || 'You', photoUrl: coverPhotoUrl || null, isBaby: true };
  const children = [baby, ...siblings];
  const startX = C.centerX - (children.length - 1) * SIB_SPACING / 2;
  const childX = children.map((_, i) => startX + i * SIB_SPACING);

  // ── Connector lines (drawn behind the nodes) ──────────────────────────
  const lines = [];
  const seg = (x1, y1, x2, y2) => lines.push({ x1, y1, x2, y2 });
  const gBottom = G.y + G.r;
  const pTop = P.y - P.r, pBottom = P.y + P.r;

  // grandparents (a side's pair) → their parent
  function linkGrandparents(centers, parentX, parentPresent) {
    if (!parentPresent || centers.length === 0) return;
    const xs = [...centers, parentX];
    seg(Math.min(...xs), G.barY, Math.max(...xs), G.barY);     // marriage bar
    centers.forEach(cx => seg(cx, gBottom, cx, G.barY));        // stub up from each grandparent
    seg(parentX, G.barY, parentX, pTop);                        // drop to the parent
  }
  const gXs = grandparents.map((_, i) => G.slots[i]);
  linkGrandparents(gXs.filter((_, i) => i < 2), P.mumX, parents.length >= 1);
  linkGrandparents(gXs.filter((_, i) => i >= 2), P.dadX, parents.length >= 2);

  // parents → children
  const parentXs = [];
  if (parents.length >= 1) parentXs.push(P.mumX);
  if (parents.length >= 2) parentXs.push(P.dadX);
  if (parentXs.length > 0) {
    const xs = [...parentXs, C.centerX];
    seg(Math.min(...xs), P.barY, Math.max(...xs), P.barY);      // parents bar
    parentXs.forEach(px => seg(px, pBottom, px, P.barY));       // stub down from each parent
    seg(C.centerX, P.barY, C.centerX, C.barY);                 // drop toward the children
  }
  if (children.length > 1) {
    seg(Math.min(...childX), C.barY, Math.max(...childX), C.barY);            // children bar
    children.forEach((c, i) => seg(childX[i], C.barY, childX[i], C.y - (c.isBaby ? C.babyR : C.sibR)));
  } else if (parentXs.length > 0) {
    seg(C.centerX, C.barY, C.centerX, C.y - C.babyR);          // single child: extend straight down
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: bg,
      overflow: 'hidden',
      fontFamily: "'Lato', sans-serif",
    }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: GOLD }}>
          Where You Come From
        </div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, fontWeight: 700, color: ink, marginTop: 10 }}>
          Your Family Tree
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }}>
          <div style={{ height: 1, width: 48, background: GOLD, opacity: 0.35 }} />
          <span style={{ fontSize: 12, color: GOLD, lineHeight: 1 }}>♥</span>
          <div style={{ height: 1, width: 48, background: GOLD, opacity: 0.35 }} />
        </div>
      </div>

      {hasAny ? (
        <>
          {/* Connector lines */}
          <svg width={600} height={800} style={{ position: 'absolute', inset: 0 }}>
            {lines.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={LINE} strokeWidth={1.6} strokeLinecap="round" />
            ))}
          </svg>

          {/* Grandparent nodes */}
          {grandparents.map((m, i) => (
            <Node key={m.id} x={G.slots[i]} y={G.y} r={G.r} gradient={NODE_GRADIENTS[i % NODE_GRADIENTS.length]}
                  name={m.name} role={m.role} photoUrl={m.photoUrl} ink={ink} />
          ))}

          {/* Parent nodes */}
          {parents.map((m, i) => (
            <Node key={m.id} x={i === 0 ? P.mumX : P.dadX} y={P.y} r={P.r} gradient={NODE_GRADIENTS[i % NODE_GRADIENTS.length]}
                  name={m.name} role={m.role} photoUrl={m.photoUrl} ink={ink} />
          ))}

          {/* Children: baby + siblings */}
          {children.map((c, i) => (
            <Node key={c.isBaby ? 'baby' : c.id} x={childX[i]} y={C.y} r={c.isBaby ? C.babyR : C.sibR}
                  gradient={c.isBaby ? BABY_GRADIENT : NODE_GRADIENTS[(i + 2) % NODE_GRADIENTS.length]}
                  name={c.name} role={c.isBaby ? '— you —' : c.role} photoUrl={c.photoUrl} ink={ink} />
          ))}
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}>
          <p style={{ fontStyle: 'italic', fontSize: 14, color: sub, opacity: 0.6, textAlign: 'center' }}>
            Add parents and grandparents in "Your People" to grow your family tree.
          </p>
        </div>
      )}
    </div>
  );
}
