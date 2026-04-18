# Session 4 — Feature Planning Review
**Status:** Pending
**Branch:** n/a — planning session, no code
**Depends on:** S3 complete (or can happen in parallel — no shared files)

## Purpose
Review and spec the next wave of features before building. Start from the confirmed feature
(First Times tracker) and work through the full idea list. Exit with at least one feature
fully spec'd and a priority order for the rest.

---

## Confirmed Feature: First Times Tracker

### What it is
A personal log of one-off baby firsts — first smile, first solid food, first word, first step,
first laugh, first trip, etc. Different from developmental milestones (those are a CDC checklist).
These are the parent's own moments.

### Requirements already decided
- Each "first" has: a name (free text), a date, an optional photo, and an optional note
- **Photo is first-class** — not an afterthought. The card should look great with a photo.
- **Easy sharing to grandparents** — via email, text, WhatsApp, etc. Should be one tap on mobile.

### Sharing approach to decide
Two realistic options — discuss and pick one before building:

**Option A: Web Share API (`navigator.share`)**
- On mobile Chrome/Safari: opens the native share sheet (SMS, email, WhatsApp, AirDrop, etc.)
- On desktop: falls back to a download or copy-link button
- What gets shared: a Canvas-generated image card (baby's name, milestone text, date, photo)
  + a short caption string
- Pros: works with every app the user has installed, no server needed
- Cons: no control over how it looks inside each app; image generation adds complexity

**Option B: Mailto + SMS deep link**
- "Share via Email" button opens `mailto:?subject=...&body=...` with pre-filled text
- "Share via Text" button opens `sms:?body=...` on mobile
- What gets shared: a text message with the baby's name, milestone, date, and a hosted image URL
  (requires Cloudinary — the image needs a real URL to be inlined in SMS/email)
- Pros: simple, no Canvas needed, predictable appearance
- Cons: requires Cloudinary to be set up for image hosting; SMS on desktop does nothing

**Recommendation to discuss:** Option A for the share mechanism (widest reach),
Canvas-generated card for the image (no Cloudinary dependency). Cloudinary can be added later
for full-resolution sharing.

### Open design questions
- [ ] Should "firsts" be free-form (user types whatever) or a preset list with add-your-own?
  A preset list (like milestones) is easier to browse; free-form is more personal.
  Hybrid option: preset suggestions that user can check off OR add custom ones.
- [ ] Where does it live — new tab, or folded into the Milestones tab?
- [ ] Is the shared card a branded Baby Steps card, or neutral?
- [ ] Does the photo upload go to Cloudinary (requires setup) or stay as a blob URL?
  Blob URLs can't be shared outside the browser — matters for Option B.

### Likely implementation shape (full-stack)
- **Backend:** New `first_times` table + controller (same pattern as growth/appointments).
  Fields: `id`, `baby_profile_id`, `label`, `occurred_date`, `image_url`, `notes`, `created_at`.
  New migration V16. New package `com.gotcherapp.api.firsttimes`.
- **Frontend:** New `FirstTimesTab` in BabySteps.jsx. State + mount fetch same as appointments.
  Sharing logic lives in a new `Frontend/src/lib/share.js` module.

---

## Other Feature Ideas — To Prioritize This Session

Listed in rough impact order. For each: decide build / defer / cut.

### 1. Quick-log from Dashboard
**What:** One-tap "Start Feed", "Log Diaper", "Log Sleep" buttons on the Dashboard card.
Currently users navigate to the tab for every log — 8+ times a day.
**Effort:** Frontend only. Small buttons that call existing API functions.
**Decision needed:** Which 3-4 actions to surface? Just feeding + diaper? All trackers?

### 2. CDC Growth Percentiles
**What:** Overlay 5th/50th/95th percentile curves on the existing growth chart.
"Is my baby on track?" is the #1 question parents ask pediatricians.
**Effort:** Frontend only. CDC publishes LMS tables (public domain). Add static data file +
chart overlay lines in GrowthTab. No backend changes.
**Decision needed:** Weight percentiles only, or height + head too? Boys/girls separate curves?

### 3. Sleep & Feeding Summary Cards on Dashboard
**What:** "Last fed 2h 15m ago • avg gap today: 2.5h" and "Slept 14.2h in last 24h • longest stretch: 4h."
Computed from existing log data — no new endpoints needed.
**Effort:** Frontend only. Add two small stat cards to DashboardTab using `sleep` and `feeding` state
already loaded in BabySteps.jsx.
**Decision needed:** How far back to look (last 24h? since midnight?)

### 4. Shareable Milestone Card
**What:** A styled image (Canvas-generated) parents can screenshot and post/send.
E.g. "Lily • 4 months old • just achieved 'Rolls from front to back' 🎉"
Could reuse the same Canvas/share.js module as First Times.
**Effort:** Frontend only. Small Canvas renderer + share button on each achieved milestone.
**Decision needed:** Trigger location (button on milestone row?), branding on card.

### 5. Weekly Digest Email
**What:** Automated weekly email: "This week: Lily slept an avg of 14.2h, had 28 feeds,
and achieved 2 milestones." Keeps users engaged between sessions.
**Effort:** Backend + email setup. Requires Resend (SMTP) to be configured. Could use a
scheduled job (Spring `@Scheduled`) or an external cron.
**Decision needed:** Opt-in or opt-out? What data to include? Requires Resend to be live first.

### 6. Health Log
**What:** Temperature readings, medication doses, sick visit notes. Parents track this on paper.
Natural companion to the Doctor Appointments feature (S3).
**Effort:** Full-stack. New table + controller + frontend tab. Medium scope.
**Decision needed:** Just temperature + notes, or full medication tracking too?

### 7. Pediatrician Report PDF
**What:** One-page export of growth, vaccines, and health notes for a doctor visit.
Reuses `pdf.js` paywall seam — natural upsell opportunity.
**Effort:** Frontend only (new function in pdf.js). Medium scope.
**Decision needed:** Exactly what goes on the page? What format?

### 8. Journal Photo Crop / Focal Point
**What:** When uploading a journal photo, let the user pick a crop region or set a focal point
so the card hero image always shows the right part of the photo. Currently `object-contain`
letterboxes portrait images and `object-cover` crops faces unpredictably.
**Effort:** Frontend only. Options:
- Simple: store `object-position` (top/center/bottom) as a per-entry preference — user picks at upload time
- Full: an inline drag-to-crop UI (react-image-crop or similar) that stores a cropped image URL
**Decision needed:** Simple focal-point toggle (low effort) vs. full crop UI (medium effort)?
Does stored image URL need to change (full crop) or just CSS hint (focal point)?

### 9. Grandparent Share Link (read-only)
**What:** A token-based URL that gives read-only access to a baby's profile.
No login required. Grandparents can see milestones, journal, firsts.
**Effort:** Full-stack. New `share_tokens` table, new auth path that bypasses JWT,
read-only versions of existing endpoints scoped by token.
**Decision needed:** What data is visible? Expiry? Revocable? This is the highest-effort
item on this list.

---

## Session Agenda (suggested)

1. Review First Times design questions — pick sharing approach, preset vs. free-form
2. Stack-rank the 8 features above — assign to next plan or defer
3. Decide if any are S5–S8 in this same plan file, or a new plan
4. If First Times is fully spec'd by end of session: write the implementation session file

---

## Session 4 Outcomes

**Status:** Complete

### First Times — all decisions resolved
| Question | Decision |
|---|---|
| Sharing | Web Share API + Cloudinary URL. Falls back to clipboard copy on desktop. |
| Preset vs free-form | Hybrid — ~10 presets + free-form custom label |
| Tab location | Standalone "Firsts" tab in S5; merged into Memories tab in S6 |
| Photo storage | Cloudinary, same pattern as journal |

### Tab structure — revised to 5 tabs
| Tab | Contents |
|---|---|
| Dashboard | Summary + quick-log + milestone card (current age range, inline checkboxes) |
| Memories | Journal + First Times |
| Track | Feeding + Sleep + Poop |
| Health | Growth + Vaccines + Appointments |
| Discover | Marketplace + Playdates + Activities |

Milestones removed as a top-nav tab. CDC checklist surfaces as a proactive card on Dashboard
(current age range + inline checkboxes + "See all" sheet).

### Feature priority for this quick-wins plan (S5–S9)
| Session | Feature |
|---|---|
| S5 | First Times tracker |
| S6 | Tab restructure — 12 tabs → 5 tabs |
| S7 | Dashboard: quick-log buttons + milestone card + sleep/feeding summary cards |
| S8 | CDC Growth Percentiles overlay on growth chart |
| S9 | Journal photo focal point (simple object-position toggle) |

### Post-deployment backlog (no session files until deployment ships)
- Shareable Milestone Card
- Health Log
- Pediatrician Report PDF
- Weekly Digest Email
- Grandparent Share Link
