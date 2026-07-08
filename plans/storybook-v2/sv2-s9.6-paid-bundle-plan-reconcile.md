# SV2-S9.6 — Paid-Bundle Plan Reconcile (tidy before we build)

**Status: Not started — created 2026-07-02.**
**Why this exists:** the paid-bundle plans (Payments, Print, Share, logging hygiene) were written at
different times across three folders and have drifted from the current storybook-v2 model (books table,
guided arc, all the v2 page types, the AI-separation model in §8). On 2026-07-02 they were **moved into
`plans/storybook-v2/`** (below). This session is a **planning/tidy pass** — no product code — to reconcile
them against reality **before** the build sessions start, so the paid bundle ships once and **sits on prod
untouched** (the stated goal).
**Run order:** right after `sv2-s9.5` (core book verified) and **before** any paid-bundle build session.
**No app code this session** — plan edits + reference fixes only.

---

## What moved (2026-07-02) — new home + names

| Old location | New location |
|---|---|
| `plans/payments/` (whole folder: `stripe-full-plan.md` canonical + `s0/s1/s2` + `session-prompts.md`) | `plans/storybook-v2/payments/` |
| `plans/storybook/sDeferred-print.md` | `plans/storybook-v2/sv2-s12-print.md` |
| `plans/storybook/sDeferred-share-link.md` | `plans/storybook-v2/sv2-s13-share-link.md` |
| `plans/storybook/sDeferred-remove-claude-logging.md` | `plans/storybook-v2/sv2-hygiene-remove-claude-logging.md` |

`plans/social-sharing/` (share **cards** = styled PNGs for social media) is a **separate feature** — NOT the
book share-link — and was intentionally left where it is. Don't conflate the two.

**Operational references already fixed at move time** (handoffs README + developer-credentials +
stripe-account, `lulu-print-handoff.md`, `session-prompts.md`, `sv2-s10-ai-assist.md`, the moved payments
files' self-refs). What remains is below.

---

## Reconciliation tasks

### 1. `planning.md` — path refs + session map (left for this session on purpose)
- Update every `plans/payments/` → `plans/storybook-v2/payments/` and `plans/storybook/sDeferred-*` →
  the new sv2 names (lines ~146, 265, 292–294, 429, 482, 492, 516, 521, 531–537, 628 as of the move).
- §3 session map: **add** the Payments workstream, `sv2-s13` (share), the hygiene task, **this** reconcile
  session, and `sv2-s9` (mark **Complete** — done 2026-07-02). Make the map match files on disk.
- §7 triage table: repoint the three `sDeferred-*` rows to their new names; Share is now **in scope**
  (user decision 2026-07-02), not "optional/deferred" — update that verdict.

### 2. Historical refs outside storybook-v2 — decide leave-vs-update
These still point at the old paths; they're **historical/completed** docs, so default is **leave as
archival** unless we want clean links: `plans/storybook/s0-planning.md`, `plans/storybook/session-prompts.md`,
`plans/storybook/storybook-context.md`, `plans/storybook-and-pregnancy-review-fixes/s1-frontend-dead-code.md`,
and root `branch-review.html`. Decision to record here: update or leave.

### 3. `payments/stripe-full-plan.md` — stale facts (predates books/guided arc)
- **Migration number:** plan says "next = V32" / `V32__add_stripe_to_users.sql`. **Actual next is V44**
  (latest on disk is V43). Fix throughout (lines ~5, 41, 49–57, 281, 320).
- **Verify the V23 column claims** against the DB: it asserts `users.tier`, `ai_credits_remaining`, AND
  `credits_reset_at` all exist from V23. Confirm `credits_reset_at` actually exists (the webhook-driven
  reset in Session 3 depends on it) — grep the migrations; if absent, add it to the V44 migration.
- **Credit model cross-check with `sv2-s10`:** payments says **10 credits/mo, reset on `invoice.paid`**;
  s10 spends **1 credit/field**. Consistent — just confirm s10's "monthly allotment" open question (its
  Q3) is answered by the payments number so they don't diverge. Record the single source of truth.
- **`pro` tier:** payments defers Pro to "when print is ready"; print (sv2-s12) gates on `plus`/`pro`.
  Decide: does print launch **Plus-only** (simpler) or do we introduce Pro with print? Align both docs.
- The plan's frontend refs (`PaidGate.jsx`, `CradleHq.jsx`, `App.jsx` routing) predate current
  components — spot-check they still exist / are the right integration points before S2.

### 4. `sv2-s12-print.md` — scope + dependency drift
- **Depends-on** line still reads "scrapbook builder rewrite (S7–S10), shareable link, Payments S1" — the
  first is done/obsolete; restate as: **v2 page types stable + Payments (Stripe merchant-of-record) +
  Lulu handoff answers**.
- **Trim size:** the doc contradicts itself (6×9 in places, 8×10 in others). Leave as an explicit **open
  question resolved by the Lulu handoff (Q8)** — don't hardcode.
- **Page-type list is stale:** it lists Letter/BirthDay/People/MomentHero/Gallery/ChapterDivider/Bump.
  The real dispatch in `storybookPdf.js` also has **FamilyTree, Prompts, Milestones** (+ Cover). The
  server-side OpenPDF renderer must reproduce **all** of them — sync the list to the code.
- Confirm OpenPDF-vs-jsPDF is settled (it is) and that "reproduce every page type server-side at 300 DPI"
  is called out as **the** big lift / main risk.

### 5. `sv2-s13-share-link.md` — fresh build, not a resume
- The old sharing backend was **removed** (V25 `book_share_tokens` migration kept, code gone). Confirm
  current DB/table state and decide: reuse `book_share_tokens` or new table.
- Plan describes serving legacy chapter **`body`**; the book is now `layout_data` v2 pages. The public
  renderer must go through **`LayoutRenderer` + all the `*Canvas` types** (same set as the PDF), themed —
  update the "PublicBookPage" section accordingly.
- **Routing assumption:** it assumes React Router with a `/book/:token` route. Verify how `App.jsx`
  actually routes today (the deferred plan says "check first") and confirm the Caddy SPA catch-all on prod.
- Books are now **multi-book** (books table, s7a) — decide: share a whole book by `book_id`, and which
  book. The old plan predates multi-book.

### 6. `sv2-hygiene-remove-claude-logging.md`
- Verify the `[CLAUDE-DEBUG]` logging still exists: `grep -rn "CLAUDE-DEBUG" Backend/src`.
- **Sequencing note:** `sv2-s11` (AI retrofit) deletes `generatePages()` + the batch `ClaudeClient` path,
  which may remove some/all of this logging already. Do this **after s11** (or fold the grep-check into
  s11's cleanup) so we don't chase logs that s11 deletes anyway.

### 7. Numbering + run-order finalization (decide + record)
- Keep Payments as the **`payments/` subfolder** (multi-session mini-track) vs flatten into
  `sv2-s9.7/.8/.9`? Recommend: **keep the subfolder** (least churn; its internal `stripe-full-plan.md` is
  the canonical entry).
- Confirm print = `sv2-s12`, share = `sv2-s13` final.
- Update `session-prompts.md` with blocks for: Payments (S1/S2/S3), print (refreshed), share, hygiene, and
  this reconcile.

### 8. Decide the paid-bundle hardening pass
The "stays on prod untouched" goal argues for a dedicated **verification + hardening** session over the
whole paid bundle (webhook idempotency/retries, declined/failed payments, cancel→downgrade, credit
refund on failed Claude call, Lulu order rejection below min-page-count, low-balance alert on the
Anthropic card). Decide: a **new `sv2-s14-paid-bundle-hardening`** session, or extend `sv2-s9.5`'s scope.
Recommend: separate session — the money/vendor paths deserve their own focused pass.

---

## Paid-bundle run order + session count (the answer to "how many sessions")

Recommended order once credentials return (all buildable against **test/sandbox** first; live keys only
swap in at deploy):

| Order | Session(s) | Count | Needs (live) |
|---|---|---|---|
| 1 | **sv2-s9.6** this reconcile pass | 1 | — |
| 2 | **Payments** — S1 backend · S2 frontend · S3 credit mgmt (`payments/`) | 3 | Stripe test→live |
| 3 | **sv2-s10** AI per-field assist | 1 | Anthropic key (live test) |
| 4 | **sv2-s11** AI retrofit (delete old batch gen) | 1 | — |
| 5 | **sv2-s12** print — L0 plan · L1 backend (OpenPDF + Lulu) · L2 frontend | 3 | Lulu sandbox→prod + Payments |
| 6 | **sv2-s13** share-link (fresh build) | 1–2 | — (paid-gate needs Payments) |
| 7 | **sv2-hygiene** remove `[CLAUDE-DEBUG]` logging | ~0.5 | — |
| 8 | **sv2-s14** paid-bundle hardening + verification (§8) | 1 | all |

**Total: ~11–12 sessions** (1 reconcile + 3 payments + 2 AI + 3 print + 1–2 share + 0.5 hygiene + 1
hardening). Payments is the **trunk** — AI assist, print, and share all gate on it (share/print for the
paywall, print also for Stripe merchant-of-record per Lulu Q4).

**Buildable before credentials arrive:** everything except the two "swap live keys + final verify" steps and
Lulu's L0 (which needs the handoff answers). So the vendor round-trip is not a hard stop on progress.

---

## Verification (this session done when)
1. Every intra-repo link in the moved/paid-bundle docs resolves (no `plans/payments/` or `sDeferred-*`
   danglers in the active set). `grep -rn 'plans/payments/\|sDeferred-' plans/storybook-v2` returns only
   intentional historical mentions.
2. No stale migration numbers in the payments plan (V44, not V32); column claims verified against
   `Backend/db/migration/`.
3. Each paid-bundle plan's **Depends-on** reflects the current model (books/guided arc/v2 page types).
4. `planning.md` §3 session map + `session-prompts.md` match the files on disk and include the full
   paid-bundle order above.
5. Print page-type list == `storybookPdf.js` dispatch set. Share renders via `LayoutRenderer`.
