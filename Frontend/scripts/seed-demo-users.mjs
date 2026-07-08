// sv2-s9.1 — seed two NEW demo accounts for storybook/pregnancy verification.
// Leaves the live demo@gotcherapp.com (Sarah/Lily) UNTOUCHED. Idempotent: if an account already
// exists, its whole block is skipped (register 4xx → skip).
//
//   demo-pregnancy@demoapp.com   Maya   pregnancy   → bump diary + guided "Before You Arrived" book
//   demo-bumptobaby@demoapp.com  Chloe/Noah  baby (was pregnant) → full lifecycle + guided "Bump to
//                                 One" + a small freeform book (moment-hero portrait+landscape)
//
// Run from Frontend/ (needs the `@/` alias → vite-node): `npm run seed:demo`  (API must be up on :3001)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arcFor, expandArcToChapterSeeds } from '@/lib/guidedBookArc';
import { TEMPLATES } from '@/lib/storybookTemplates';
import { emptyBlocksForTemplate, makePageId } from '@/lib/storybookLayout';
import { toTiptapDoc } from '@/lib/tiptap';

const API = process.env.API || 'http://localhost:3001';
const PASSWORD = 'DemoPass1';
const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../seed-assets');

// ── date helpers (kept relative to "now" so the demo stays fresh) ─────────────
const NOW = new Date();
const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const iso = d => d.toISOString().slice(0, 10);

// ── low-level HTTP ───────────────────────────────────────────────────────────
async function req(method, pathname, token, body) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status} ${await res.text().catch(() => '')}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// Register → token, or null if the account already exists (4xx) so we skip re-seeding it.
async function register(email, displayName) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, display_name: displayName }),
  });
  if (res.ok) return (await res.json()).accessToken;
  if (res.status >= 400 && res.status < 500) { console.log(`  • ${email} already exists — skipping.`); return null; }
  throw new Error(`register ${email} → ${res.status} ${await res.text().catch(() => '')}`);
}

// Upload a bundled asset once per account (cached), returning its Cloudinary URL.
function uploader(token) {
  const cache = new Map();
  return async (file, context) => {
    if (cache.has(file)) return cache.get(file);
    const buf = await readFile(path.join(ASSETS, file));
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'image/jpeg' }), file);
    const res = await fetch(`${API}/upload?context=${context}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    if (!res.ok) throw new Error(`upload ${file} → ${res.status} ${await res.text().catch(() => '')}`);
    const url = (await res.json()).url;
    cache.set(file, url);
    return url;
  };
}

// Build a freeform moment-hero page. Uses the app's OWN `emptyBlocksForTemplate` so the block shape is
// byte-identical to an editor-created page (the interactive editor is picky — the read-only PDF path is
// not), then fills text as a Tiptap doc (what the editor stores, NOT a plain string) + sets the photo url.
function momentHeroPage(templateId, { badge = '', title = '', date = '', note = '', url }) {
  const tpl = TEMPLATES.find(t => t.id === templateId);
  if (!tpl) throw new Error(`template ${templateId} not found`);
  const fill = { badge, title, date, note };
  const blocks = emptyBlocksForTemplate(tpl).map(b => {
    const nb = { ...b };
    if (b.type === 'text') nb.content = toTiptapDoc(fill[b.id] ?? '');
    if (b.id === 'photo') nb.url = url;
    return nb;
  });
  return { id: makePageId(), sourceKeys: [], templateId, backgroundColor: null, blocks };
}

// Publish every chapter of a book so it renders in the published view + PDF export (which filter to
// status='published'). Seeded chapters are 'unlocked' by default, which is why "Download PDF" was empty.
async function publishChapters(token, bookId) {
  const chs = (await req('GET', `/storybook?bookId=${bookId}`, token)) || [];
  for (const c of chs) await req('PATCH', `/storybook/${c.id}`, token, { status: 'published' });
}

// Generic order-based page filler: text blocks get `texts` in order, photo blocks get `photos` (urls) in
// order. Same clean shape as momentHeroPage (app's emptyBlocksForTemplate + Tiptap text). Works for every
// template — role-based (letter/gallery/prompts/bump/moment-hero) and positional (spotlight/growth/etc.).
function fillPage(templateId, texts = [], photos = []) {
  const tpl = TEMPLATES.find(t => t.id === templateId);
  if (!tpl) throw new Error(`template ${templateId} not found`);
  let ti = 0, pi = 0;
  const blocks = emptyBlocksForTemplate(tpl).map(b => {
    const nb = { ...b };
    if (b.type === 'text') nb.content = toTiptapDoc(texts[ti++] ?? '');
    if (b.type === 'photo') nb.url = photos[pi++] ?? null;
    return nb;
  });
  return { id: makePageId(), sourceKeys: [], templateId, backgroundColor: null, blocks };
}

// Content for the guided-book fill/pick pages, keyed by arc anchorKey. `texts` fill the page's text blocks
// in order; `photos` are seed-asset filenames for its photo blocks in order. (auto/prefill pages render from
// live data; dividers are pre-filled from the arc — neither is listed here.)
const LETTER_BEFORE = "My darling Noah — as I write this you're a flutter of kicks and hiccups, and we already love you more than we knew was possible. We've painted your room the softest green, folded impossibly tiny socks, and imagined your face a thousand ways. Whoever you turn out to be, know this: you were wanted, you were waited for, and you were loved long before your first breath.";
const LETTER_ONE = "Noah, my love — a whole year. You arrived and rearranged our entire world, and we'd do it all again in a heartbeat. This year you learned to smile, to laugh, to sit, to reach for us. You taught us a tiredness we never knew and a love we never imagined. Happy first birthday, little one — here's to all the years still to come.";

const GUIDED_FILL = {
  // ▸ Before You Arrived (pregnancy)
  'letter-before': { texts: ['A Letter Before You Arrived', LETTER_BEFORE, '— With all our love, Mummy & Daddy'], photos: [] },
  'found-out':     { texts: ['We found out on an ordinary Tuesday that turned extraordinary — two little lines, and the whole world tilted.'], photos: ['bump-01-hands.jpg'] },
  'first-photo':   { texts: ['Your very first photo — twelve weeks, a grainy little profile, already unmistakably you.'], photos: ['bump-02-shoe-bw.jpg'] },
  'bump-early':    { texts: ['The Bump — Early Days', '16 weeks', '20 weeks', "The first little curve — we couldn't stop looking."], photos: ['bump-01-hands.jpg', 'bump-02-shoe-bw.jpg'] },
  'bump-bloom':    { texts: ['The Bump — Full Bloom', '28 weeks', '34 weeks', 'Nearly there — every kick a hello.'], photos: ['bump-02-shoe-bw.jpg', 'bump-01-hands.jpg'] },
  // ▸ The Beginning
  'welcome':     { texts: ['Welcome to the World', 'Your very first hours', 'Hello, you', 'So new', 'Tiny fingers', 'First cuddle'], photos: ['newborn-01-red.jpg', 'newborn-03-pink.jpg', 'newborn-02-green.jpg', 'baby-01-bath.jpg'] },
  'coming-home': { texts: ['The day we brought you home. You slept the whole drive and woke the moment we stopped — already keeping us on our toes.'], photos: ['newborn-03-pink.jpg'] },
  'tiny-new':    { texts: ['How small you were. Tiny hands, sleepy faces, those first newborn days that went by in a blur of love and no sleep.'], photos: ['newborn-02-green.jpg'] },
  // ▸ Your Firsts (moment-hero: badge/title/date/note/attrib)
  'first-1': { texts: ['A FIRST', 'First bath', 'Week 3', 'Not impressed at first, then settled right in.', ''], photos: ['baby-01-bath.jpg'] },
  'first-2': { texts: ['A FIRST', 'First smile', 'Week 4', 'The grin that started it all.', ''], photos: ['baby-07-allstar.jpg'] },
  'first-3': { texts: ['A FIRST', 'Tummy-time champ', 'Month 2', 'Held his head up for a whole ten seconds — we cheered like he scored.', ''], photos: ['baby-08-tummy.jpg'] },
  'first-4': { texts: ['A FIRST', 'Trip to the park', 'Month 5', 'Transfixed by the leaves moving in the breeze.', ''], photos: ['baby-04-trike-landscape.jpg'] },
  'little-moments': { texts: ['Little Moments', 'The small everyday firsts', 'Bath giggles', 'Milk-drunk', 'Toes!', 'Big yawns'], photos: ['baby-02-ducks.jpg', 'baby-05-bluechair.jpg', 'baby-06-teddy.jpg', 'baby-08-tummy.jpg'] },
  // ▸ Watch You Grow
  'months-0-3':  { texts: ['Months 0–3 — a sleepy newborn who turned into a smiler.', 'Little by little, you became you.'], photos: ['newborn-01-red.jpg', 'baby-01-bath.jpg', 'baby-07-allstar.jpg'] },
  'months-3-6':  { texts: ['Months 4–6', 'New sounds, new faces, and the discovery of your own hands.'], photos: ['baby-05-bluechair.jpg'] },
  'months-6-9':  { texts: ['Months 7–9', 'Sitting up and getting curious about absolutely everything.'], photos: ['baby-06-teddy.jpg', 'baby-02-ducks.jpg'] },
  'months-9-12': { texts: ['Months 10–12 — almost one, and always on the move.'], photos: ['baby-03-beach.jpg'] },
  // ▸ You at One
  'out-about':     { texts: ['Out & About', 'Your favourite adventures', 'Beach day', 'Park bench', 'First trike', 'Sunshine'], photos: ['baby-03-beach.jpg', 'baby-05-bluechair.jpg', 'baby-04-trike-landscape.jpg', 'baby-06-teddy.jpg'] },
  'all-about-you': { texts: ['Sweet potato & anything off our plates', 'Your crinkly fox & Sophie the giraffe', 'Anything with a beat — you bounce', 'Splashing in the bath', 'Peekaboo, every single time'], photos: [] },
  'hands-feet':    { texts: ['Your Hands & Feet', 'So small now — one day these will be big.'], photos: ['baby-08-tummy.jpg', 'baby-01-bath.jpg'] },
  'happy-birthday':{ texts: ['ONE!', 'Happy First Birthday', 'One year', 'The cake, the candle, that face. One whole year of you.', ''], photos: ['baby-07-allstar.jpg'] },
  'the-party':     { texts: ['The Party', 'Everyone who came to celebrate you', 'Cake smash', 'Family', 'Sunshine', 'Worn out'], photos: ['baby-07-allstar.jpg', 'family-group.jpg', 'baby-03-beach.jpg', 'baby-08-tummy.jpg'] },
  'one-year':      { texts: ['One Year of You', LETTER_ONE, '— Mummy & Daddy'], photos: [] },
  'story-continues': { texts: ['And this is only the beginning. Whatever comes next, we will be right here, cheering you on.'], photos: ['baby-04-trike-landscape.jpg'] },
};

const PREGNANCY_KEYS = new Set(['letter-before', 'found-out', 'first-photo', 'bump-early', 'bump-bloom']);

// Fill the guided book's fill/pick pages from GUIDED_FILL. onlyPregnancy=true → only the pre-birth pages
// (a pregnancy profile has no baby content yet).
async function fillGuidedBook(token, bookId, up, { onlyPregnancy = false } = {}) {
  const chs = (await req('GET', `/storybook?bookId=${bookId}`, token)) || [];
  const byKey = new Map(chs.map(c => [c.anchorKey, c]));
  for (const [key, spec] of Object.entries(GUIDED_FILL)) {
    if (onlyPregnancy && !PREGNANCY_KEYS.has(key)) continue;
    const ch = byKey.get(key);
    if (!ch) continue;
    const urls = [];
    for (const f of spec.photos) urls.push(await up(f, 'storybook'));
    const templateId = ch.layoutData?.pages?.[0]?.templateId;
    const page = fillPage(templateId, spec.texts, urls);
    await req('PATCH', `/storybook/${ch.id}`, token, { layoutData: { version: 2, pages: [page] }, status: 'published' });
  }
}

// ── Account 1 — Maya (pregnancy) ─────────────────────────────────────────────
async function seedPregnancy(token) {
  const up = uploader(token);
  const dueDate = iso(addDays(NOW, 126)); // ~18 weeks out

  console.log('  profile…');
  await req('PUT', '/baby-profile', token, {
    parentName: 'Maya Alvarez', babyName: '', phase: 'pregnancy', dueDate, phone: '555-0142',
  });

  console.log('  bump diary…');
  const bump1 = await up('bump-01-hands.jpg', 'bump_photos');
  const bump2 = await up('bump-02-shoe-bw.jpg', 'bump_photos');
  const bumps = [
    { week: 16, imageUrl: bump1, note: 'First proper bump! Felt the first flutter this week.', takenDate: iso(addDays(NOW, -42)), imageOrientation: 'portrait' },
    { week: 20, imageUrl: bump2, note: 'Halfway there. Picked out the tiniest pair of shoes.', takenDate: iso(addDays(NOW, -14)), imageOrientation: 'portrait' },
    { week: 22, imageUrl: bump1, note: 'Growing fast — lots of kicks at night now.', takenDate: iso(NOW), imageOrientation: 'portrait' },
  ];
  for (const b of bumps) await req('POST', '/bump-photos', token, b);

  console.log('  people…');
  const mum = await req('POST', '/family-members', token, { name: 'Maya', role: 'Mum-to-be', roleCategory: 'parent', photoUrl: await up('person-mum.jpg', 'family'), bio: 'Counting down the weeks.' });
  const dad = await req('POST', '/family-members', token, { name: 'Daniel', role: 'Dad-to-be', roleCategory: 'parent', photoUrl: await up('person-dad.jpg', 'family'), bio: 'Already reading bedtime stories to the bump.' });
  await req('POST', '/family-members', token, { name: 'Rosa', role: 'Abuela', roleCategory: 'grandparent', photoUrl: await up('person-grandma.jpg', 'family'), linkedMemberId: mum.id, bio: "Maya's mum — can't wait." });

  console.log('  guided book (Before You Arrived)…');
  const chapters = expandArcToChapterSeeds(arcFor({ phase: 'pregnancy', dueDate }));
  const gbook = await req('POST', '/books', token, { type: 'guided', title: 'Before You Arrived', chapters });
  await publishChapters(token, gbook.id);
  await fillGuidedBook(token, gbook.id, up, { onlyPregnancy: true });
}

// ── Account 2 — Chloe / Noah (full lifecycle) ────────────────────────────────
async function seedBumpToBaby(token) {
  const up = uploader(token);
  const birthdate = iso(addDays(NOW, -168)); // ~24 weeks old
  const dueDate = iso(addDays(NOW, -173));   // slightly before birth → arcFor() picks BUMP_TO_ONE

  console.log('  profile…');
  await req('PUT', '/baby-profile', token, {
    parentName: 'Chloe Bennett', babyName: 'Noah', birthdate, phase: 'baby', dueDate, sex: 'boy', phone: '555-0199',
  });

  console.log('  birth details…');
  await req('PUT', '/birth-details', token, {
    hospital: 'Riverside General', weightLbs: 7.6, heightIn: 20.5, headIn: 13.8, birthType: 'natural',
    birthStory: 'Noah arrived at dawn after a long night — pink, loud, and perfect. We held him and the whole world went quiet.',
    birthPhotoUrl: await up('newborn-01-red.jpg', 'birth_details'),
  });

  console.log('  bump diary (from the pregnancy)…');
  await req('POST', '/bump-photos', token, { week: 20, imageUrl: await up('bump-01-hands.jpg', 'bump_photos'), note: 'Halfway to meeting Noah.', takenDate: iso(addDays(NOW, -308)), imageOrientation: 'portrait' });
  await req('POST', '/bump-photos', token, { week: 32, imageUrl: await up('bump-02-shoe-bw.jpg', 'bump_photos'), note: 'Nearly there — bags packed.', takenDate: iso(addDays(NOW, -224)), imageOrientation: 'portrait' });

  console.log('  journals…');
  const journals = [
    { week: 1, title: 'Home at last', story: 'We brought Noah home today. The house feels completely different — quieter and louder at once. We just stared at him for an hour.', img: 'newborn-03-pink.jpg', o: 'portrait' },
    { week: 4, title: 'First real smile', story: 'Right after his morning feed he looked up and smiled — a real one. His dad definitely cried.', img: 'baby-07-allstar.jpg', o: 'portrait' },
    { week: 8, title: 'Bath time convert', story: 'He used to hate the bath. Today he splashed and giggled the whole time. Rubber ducks for the win.', img: 'baby-02-ducks.jpg', o: 'portrait' },
    { week: 12, title: 'Three months already', story: 'So much more of a person now — opinions about songs, about naps (against), about everything.', img: 'baby-05-bluechair.jpg', o: 'portrait' },
    { week: 20, title: 'Out and about', story: 'First proper day trip. Watched the world go by, completely transfixed.', img: 'baby-04-trike-landscape.jpg', o: 'landscape' },
  ];
  for (const j of journals) {
    await req('POST', '/journal', token, { week: j.week, title: j.title, story: j.story, imageUrl: await up(j.img, 'journal'), imageOrientation: j.o });
  }

  console.log('  first times…');
  const firsts = [
    { label: 'First bath', date: iso(addDays(NOW, -150)), notes: 'Not impressed at first, then settled right in.', img: 'baby-01-bath.jpg', o: 'portrait' },
    { label: 'First smile', date: iso(addDays(NOW, -140)), notes: 'The grin that started it all.', img: 'baby-07-allstar.jpg', o: 'portrait' },
    { label: 'Tummy time champion', date: iso(addDays(NOW, -70)), notes: 'Held his head up for a whole ten seconds. We cheered like he scored a goal.', img: 'baby-08-tummy.jpg', o: 'portrait' },
    { label: 'Trip to the park', date: iso(addDays(NOW, -30)), notes: 'Transfixed by the leaves moving in the breeze.', img: 'baby-04-trike-landscape.jpg', o: 'landscape' },
  ];
  for (const f of firsts) {
    await req('POST', '/first-times', token, { label: f.label, occurredDate: f.date, notes: f.notes, imageUrl: await up(f.img, 'first_times'), imageOrientation: f.o });
  }

  console.log('  growth + milestones…');
  const g = [
    ['0', 7.6, 20.5, 13.8, 'Newborn checkup'], ['28', 9.4, 21.6, 14.6, '4-week visit'],
    ['70', 11.6, 23.1, 15.3, '2-month'], ['140', 14.3, 25.0, 16.1, '4.5-month — on track!'],
  ];
  for (const [days, w, h, hd, note] of g) {
    await req('POST', '/growth', token, { recordedDate: iso(addDays(new Date(birthdate), Number(days))), weightLbs: w, heightIn: h, headIn: hd, notes: note });
  }
  for (const key of ['0-0', '0-1', '0-2', '4-0', '4-1', '4-2', '8-0', '8-1', '12-0', '12-1', '12-2', '16-0', '16-1', '20-0']) {
    await req('POST', `/milestones/${key}`, token);
  }

  console.log('  people (with grandparent links)…');
  const mum = await req('POST', '/family-members', token, { name: 'Chloe', role: 'Mummy', roleCategory: 'parent', photoUrl: await up('person-mum.jpg', 'family'), bio: 'Noah\'s mum.' });
  const dad = await req('POST', '/family-members', token, { name: 'Ben', role: 'Daddy', roleCategory: 'parent', photoUrl: await up('person-dad.jpg', 'family'), bio: 'Noah\'s dad.' });
  await req('POST', '/family-members', token, { name: 'Rose', role: 'Nana', roleCategory: 'grandparent', photoUrl: await up('person-grandma.jpg', 'family'), linkedMemberId: mum.id, bio: "Chloe's mum — over the moon." });
  await req('POST', '/family-members', token, { name: 'Bill', role: 'Pop', roleCategory: 'grandparent', photoUrl: await up('person-grandpa.jpg', 'family'), linkedMemberId: dad.id, bio: "Ben's dad." });
  // One grandparent left photoless on purpose → exercises the initials-in-a-circle render.
  await req('POST', '/family-members', token, { name: 'Margaret', role: 'Grandma', roleCategory: 'grandparent', linkedMemberId: dad.id, bio: "Ben's mum." });

  console.log('  guided book (Bump to One)…');
  const chapters = expandArcToChapterSeeds(arcFor({ phase: 'baby', dueDate }));
  const gbook = await req('POST', '/books', token, { type: 'guided', title: 'Bump to One', chapters });
  await publishChapters(token, gbook.id);
  await fillGuidedBook(token, gbook.id, up);

  console.log('  freeform book (moment-hero portrait + landscape)…');
  const freeform = await req('POST', '/books', token, { type: 'freeform', title: "Noah's Scrapbook" });
  const bookChapters = await req('GET', `/storybook?bookId=${freeform.id}`, token);
  const chapterId = bookChapters?.[0]?.id;
  if (chapterId) {
    const pages = [
      momentHeroPage('moment-hero-portrait', { badge: 'FIRST SMILE', title: 'That grin', date: 'Week 4', note: 'The smile that started it all.', url: await up('baby-07-allstar.jpg', 'storybook') }),
      momentHeroPage('moment-hero-landscape', { badge: 'OUT & ABOUT', title: 'A day at the park', date: 'Week 20', note: 'Watching the whole world go by.', url: await up('baby-04-trike-landscape.jpg', 'storybook') }),
    ];
    await req('PATCH', `/storybook/${chapterId}`, token, { layoutData: { version: 2, pages }, status: 'published' });
  } else {
    console.log('    ! could not find the freeform chapter to fill — check /storybook?bookId response');
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
const ACCOUNTS = [
  { email: 'demo-pregnancy@demoapp.com', name: 'Maya Alvarez', seed: seedPregnancy },
  { email: 'demo-bumptobaby@demoapp.com', name: 'Chloe Bennett', seed: seedBumpToBaby },
];

console.log(`Seeding demo users against ${API}\n`);
for (const acct of ACCOUNTS) {
  console.log(`▶ ${acct.email}`);
  try {
    const token = await register(acct.email, acct.name);
    if (!token) continue;
    await acct.seed(token);
    console.log(`  ✓ done (password ${PASSWORD})\n`);
  } catch (e) {
    console.error(`  ✗ ${acct.email} failed: ${e.message}\n`);
  }
}
console.log('Finished. (demo@gotcherapp.com was left untouched.)');
