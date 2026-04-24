# Tech Debt: AI Memory Book Generation

**Status:** Deferred — feature was removed from scope before implementation

## What was planned
Auto-generate a shareable "memory book" from journal entries using an external AI API (originally Claude). Would have produced a formatted PDF or page with narrative text wrapping around photos.

## Why it was deferred
- Adds external API cost and dependency for a feature that wasn't core to MVP
- Privacy implications of sending child photos/data to a third-party AI service
- The journal PDF export (already shipped) covers the primary user need

## Privacy policy status
The current `privacy.html` includes a general AI features clause. If AI book generation is ever re-added, revisit that section to be specific about what data is sent and to whom.

## If re-adding later
- Replace with a plain journal-to-summary compiler (no external API) — this was the agreed direction
- Or evaluate a self-hosted summarization option
- Do NOT add back the external API path without a privacy policy update and user consent flow
