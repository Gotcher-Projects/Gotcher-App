# s12 — Polish: A11y / Consistency / Vestigial (Optional)

**Status: Not started**
**Branch:** pregnancy-updates
**Depends on:** none (do anytime; lowest priority)
**Source:** `branch-review.html` → Pass 5 (P3) + Pass 1 (vestigial)

---

## Goal
Low-priority cleanups that improve quality without changing core behaviour. Pick up opportunistically;
fine to defer or cherry-pick individual items.

## Scope
### Accessibility
- **Custom overlays as real dialogs** — the crop modals (`imageUtils.jsx`), `PhotoTray`, and the
  builder's `TemplateSheet` close on backdrop click but lack `role="dialog"`/`aria-modal`, focus
  trapping, and Esc-to-close. Minimum: add Esc handling + `role`/`aria-modal`; ideally route through
  the shared Radix `Dialog`.
- **DnD aria / keyboard** — see note below. Add `aria-label` to icon-only buttons that only have
  `title`.

### Consistency
- Unify import style: `@/lib/imageUtils` (no `.jsx`) everywhere; alias `@/` over relative `../../`
  in pregnancy components. Add a lint rule to keep it.

### Performance
- `storybookPdf` capture uses fixed ~500ms per-page sleeps; lean on the explicit readiness waits
  (`document.fonts.ready` + image `onload`) and trim the magic timeouts; consider overlapping the
  cover capture.

### Vestigial data (deferred from s1/s2)
- `CradleHq` `onUserUpdate` prop — wire up (tier refresh) or remove.
- `ChapterResponse.generatedAt` / `generated_at` — stamp on generate, or drop column + field.
- `WizardRequest.supplementaryNotes` — add the UI that fills it, or remove.

## DnD aria — what it means
The ScrapbookBuilder drag-and-drop (dnd-kit) is configured with Pointer + Touch sensors only — no
`KeyboardSensor` — so dragging is mouse/touch only and exposes little to assistive tech. The builder
*does* offer **click-to-place** as a full keyboard/SR-reachable alternative, which is the right
fallback, so this is "make it a conscious, documented choice," not "must rebuild." Optional
improvements: add a `KeyboardSensor`, and/or `aria-label`s + `aria-roledescription="draggable"` on
the draggable pieces and drop slots so screen readers announce them.

## Files
- `imageUtils.jsx`, `PhotoTray.jsx`, `ScrapbookBuilder.jsx`, `storybookPdf.js`, pregnancy components,
  `CradleHq.jsx`, `ChapterResponse.java` / `StorybookService.java`, `WizardRequest.java`

## Verification
- Per item: manual a11y check (keyboard + Esc on modals), `npm run test` / `./gradlew test` green for
  any code touched.
