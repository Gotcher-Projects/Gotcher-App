package com.gotcherapp.api.print;

import org.springframework.stereotype.Service;

/**
 * Print pr6 — retail pricing for a printed book. LOCKED with Michael 2026-07-19: a flat, ALL-IN (includes MAIL
 * shipping, which is the single hardcoded shipping level) price keyed on the filled interior page count — NOT
 * Lulu's live quote. A step function that rounds DOWN to the breakpoint:
 *
 * <pre>
 *   32–34 pages → $35   ·   35–39 → $40   ·   40–44 → $42   ·   45–49 → $45   ·   50 → $50
 * </pre>
 *
 * The guided bases fall out of this exactly — First Year (32pp) → $35, Bump to One (35pp) → $40 — so there is no
 * per-type special-casing: every book type prices off page count. Freeform "scrapbooks" are bounded 32–50 by the
 * gate ({@link PrintInteriorService}); guided arcs never exceed ~37. Multi-copy = quantity × unit price (Lulu
 * shares one shipping charge across copies, so this is comfortably margin-positive). This is the single source of
 * truth for the amount pr7's variable-amount Stripe checkout charges.
 */
@Service
public class PrintPricingService {

    /** A computed retail price. Money in cents (Stripe's unit); currency always USD (US-only, per the payments track). */
    public record Price(int unitPriceCents, int quantity, int totalCents, String currency) {}

    /** Retail unit price (cents) for a book of {@code pageCount} filled interior pages. */
    public int unitPriceCents(int pageCount) {
        if (pageCount <= 34) return 3500;  // 32–34  → $35  (guided First Year lands here)
        if (pageCount <= 39) return 4000;  // 35–39  → $40  (guided Bump to One lands here)
        if (pageCount <= 44) return 4200;  // 40–44  → $42
        if (pageCount <= 49) return 4500;  // 45–49  → $45
        return 5000;                       // 50     → $50  (freeform ceiling; guided arcs never exceed this)
    }

    /** Full price for {@code quantity} copies of a {@code pageCount}-page book. */
    public Price price(int pageCount, int quantity) {
        int qty = Math.max(1, quantity);
        int unit = unitPriceCents(pageCount);
        return new Price(unit, qty, unit * qty, "USD");
    }
}
