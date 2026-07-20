package com.gotcherapp.api.print;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Print pr5.5 — the gate logic (D2). Pure {@link PrintInteriorService#evaluate} cases: the 32 floor for every
 * type, the freeform 32–50 window, and the guided/freeform "reason" split (guided can't add pages, only fill).
 */
class PrintInteriorServiceTest {

    private final PrintInteriorService svc = new PrintInteriorService(null, null);

    @Test
    void guidedBelowFloor_isFillMore() {
        PrintInteriorService.Orderability o = svc.evaluate("guided", 30);
        assertFalse(o.orderable());
        assertEquals(2, o.shortBy());
        assertEquals(0, o.overBy());
        assertEquals(PrintInteriorService.Reason.FILL_MORE, o.reason());
        assertEquals(32, o.min());
        assertEquals(PrintInteriorService.MAX_PAGES_GUIDED, o.max());
    }

    @Test
    void freeformBelowFloor_isAddMore() {
        PrintInteriorService.Orderability o = svc.evaluate("freeform", 20);
        assertFalse(o.orderable());
        assertEquals(12, o.shortBy());
        assertEquals(PrintInteriorService.Reason.ADD_MORE, o.reason());
        assertEquals(PrintInteriorService.MAX_PAGES_FREEFORM, o.max());
    }

    @Test
    void exactlyAtFloor_isOrderable() {
        PrintInteriorService.Orderability o = svc.evaluate("guided", 32);
        assertTrue(o.orderable());
        assertEquals(0, o.shortBy());
        assertEquals(PrintInteriorService.Reason.OK, o.reason());
    }

    @Test
    void freeformOverCeiling_isOverMax() {
        PrintInteriorService.Orderability o = svc.evaluate("freeform", 51);
        assertFalse(o.orderable());
        assertEquals(1, o.overBy());
        assertEquals(PrintInteriorService.Reason.OVER_MAX, o.reason());
    }

    @Test
    void freeformAtCeiling_isOrderable() {
        assertTrue(svc.evaluate("freeform", 50).orderable());
    }
}
