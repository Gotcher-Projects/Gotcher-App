package com.gotcherapp.api.print;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Print pr6 — the locked retail price table (Michael 2026-07-19): 32–34 → $35, 35–39 → $40, 40–44 → $42,
 * 45–49 → $45, 50 → $50, rounding DOWN to the breakpoint. Guided bases land on it (First Year 32pp = $35,
 * Bump 35pp = $40). Multi-copy = qty × unit.
 */
class PrintPricingServiceTest {

    private final PrintPricingService svc = new PrintPricingService();

    @Test
    void stepTableRoundsDownToBreakpoint() {
        assertEquals(3500, svc.unitPriceCents(32)); // First Year floor
        assertEquals(3500, svc.unitPriceCents(33));
        assertEquals(3500, svc.unitPriceCents(34));
        assertEquals(4000, svc.unitPriceCents(35)); // Bump to One
        assertEquals(4000, svc.unitPriceCents(37));
        assertEquals(4000, svc.unitPriceCents(39));
        assertEquals(4200, svc.unitPriceCents(40));
        assertEquals(4200, svc.unitPriceCents(44));
        assertEquals(4500, svc.unitPriceCents(45));
        assertEquals(4500, svc.unitPriceCents(49));
        assertEquals(5000, svc.unitPriceCents(50)); // freeform ceiling
    }

    @Test
    void multiCopyIsQuantityTimesUnit() {
        PrintPricingService.Price p = svc.price(32, 3);
        assertEquals(3500, p.unitPriceCents());
        assertEquals(3, p.quantity());
        assertEquals(10500, p.totalCents());
        assertEquals("USD", p.currency());
    }

    @Test
    void quantityFlooredAtOne() {
        assertEquals(1, svc.price(40, 0).quantity());
        assertEquals(4200, svc.price(40, 0).totalCents());
    }
}
