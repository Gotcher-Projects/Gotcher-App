# Draft email — sales tax / VAT action for the LLC owner

**Purpose:** a ready-to-send email handing the tax question to the owner before go-live.
**Companion:** `tax-note-for-owner.md` (the full detail), `stripe-account-handoff.md`, `../payments/stripe-primer.md` §6.
**Send by:** before Stripe flips to live (digital, Payments p12) and before print flips to live (Lulu, print pr10).
Drafted 2026-07-20.

> Placeholders `[Owner]` / `[Your name]` — Michael is effectively both developer and LLC owner; fill in as fits,
> or forward just the "Questions to take to an accountant" block on its own.

---

**Subject: Action needed before we go live — sales tax / VAT setup**

Hi [Owner],

We're getting close to accepting real payments on CradleHQ, and there's one thing that needs to be in your hands before we flip the switch: **sales tax.** Nothing about it blocks development — everything we've built runs against test/sandbox systems (fake money, no obligations) — but the tax obligation begins the moment we take the **first real payment**, so it needs to be sorted before then.

I'm not qualified to make any of these calls, and neither is any AI tool — this is a "take a few specific questions to an accountant" task. I've written those questions out below so it's ready to hand off.

**A bit of context on what we're about to sell:**
- **Digital purchases** — one-time AI-credit packs and a share-unlock ($5–$15 each). No subscription.
- **A printed book** — pay-per-order (~$35), ships US-only. This is a *physical good* and is taxed differently from the digital items.

The LLC is the merchant of record — customers pay us, Stripe deposits to the LLC's account.

**What we've already done to limit exposure:** we've added a Stripe rule that blocks any non-US card. That keeps sales domestic and defers the international VAT question. It's reversible in the dashboard in minutes. It does **not**, however, settle US state obligations, and it doesn't resolve the physical-book question.

**Timing:** These need answers before the *first live charge* — specifically before we switch Stripe to live (digital purchases) and before we switch the print service to live (physical books). Accountants can take a while, so it's worth starting now. It does **not** need to be solved before we ship the app itself.

---

**Questions to take to an accountant:**

*Digital goods (credit packs, share unlock):*
1. Does the LLC have a sales-tax registration obligation in any US state today?
2. Do we intend to sell to the EU/UK at all? (VAT there can apply from the first sale, no minimum threshold — right now we're blocking non-US cards to avoid it.)
3. Should we enable Stripe Tax (it calculates & collects for ~0.5% per transaction), and if so, where would we need to register first? (Note: Stripe collecting tax is *not* the same as registering or remitting — those stay with the LLC.)

*Physical printed book (separate rules):*
4. Does the LLC have a *physical-goods* sales-tax registration obligation in any US state at our scale? (Physical goods are taxed based on where they ship to.)
5. Should we enable Stripe Tax for the print checkout specifically?
6. Not strictly tax, but same bucket — what's our refund posture on printed books? We charge the customer full retail (~$35) but our printer only reimburses us ~print cost (~$9) if a book is defective or lost, so we'd absorb the difference on a refund.

---

Happy to walk through any of this or provide more detail on how the payment/print setup works. Just let me know.

Thanks,
[Your name]
