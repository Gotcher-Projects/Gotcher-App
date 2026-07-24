package com.gotcherapp.api.print;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Print pr7 (commit a) — the checkout GUARD paths, the ones that must refuse BEFORE any charge or render. The
 * happy path ends in a static {@code Session.create} against Stripe's network (verified by hand with a 4242 test
 * card + local webhook, like Payments P3), so these tests pin the pre-Stripe gates instead: the kill switch, the
 * quantity bounds, and the orderability gate all short-circuit before a PDF is rendered or a customer touched.
 */
@ExtendWith(MockitoExtension.class)
class PrintOrderServiceTest {

    private static final Long USER_ID = 42L;
    private static final Long BOOK_ID = 7L;

    @Mock PrintInteriorService printInteriorService;
    @Mock PrintRenderService renderService;
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbc;

    /** Real pricing (pure, no deps); the collaborators that reach the network/DB are mocked. */
    private PrintOrderService service(boolean printEnabled) {
        return new PrintOrderService(jdbc, printInteriorService, new PrintPricingService(),
            renderService, "sk_test", "http://localhost:3000", printEnabled);
    }

    private PrintInteriorService.Orderability tooFew(int pages) {
        return new PrintInteriorService.Orderability(pages, 32, 50, false, 32 - pages, 0, "freeform",
            PrintInteriorService.Reason.ADD_MORE);
    }

    @Test
    void killSwitchOff_refusesBeforeAnything() {
        assertThrows(LuluClient.PrintDisabledException.class,
            () -> service(false).createCheckout(USER_ID, BOOK_ID, 1));

        // Nothing is gated/priced/rendered when print is off — the refusal is the very first thing.
        verifyNoInteractions(printInteriorService, renderService);
    }

    @Test
    void quantityBelowOne_rejected() {
        assertThrows(IllegalArgumentException.class,
            () -> service(true).createCheckout(USER_ID, BOOK_ID, 0));
        verifyNoInteractions(printInteriorService, renderService);
    }

    @Test
    void quantityAboveMax_rejected() {
        assertThrows(IllegalArgumentException.class,
            () -> service(true).createCheckout(USER_ID, BOOK_ID, PrintOrderService.MAX_QUANTITY + 1));
        verifyNoInteractions(printInteriorService, renderService);
    }

    @Test
    void notOrderable_refusesBeforeRender() {
        when(printInteriorService.orderability(USER_ID, BOOK_ID)).thenReturn(tooFew(20));

        assertThrows(PrintOrderService.NotOrderableException.class,
            () -> service(true).createCheckout(USER_ID, BOOK_ID, 1));

        // The gate is checked, but we never render a PDF for an un-orderable book.
        verifyNoInteractions(renderService);
    }

    @Test
    void notOwned_propagatesAs404() {
        // orderability() does the IDOR check and throws when the book isn't owned — checkout must let it through.
        when(printInteriorService.orderability(USER_ID, BOOK_ID))
            .thenThrow(new PrintRenderService.BookNotAccessibleException("Book not found"));

        assertThrows(PrintRenderService.BookNotAccessibleException.class,
            () -> service(true).createCheckout(USER_ID, BOOK_ID, 1));
        verifyNoInteractions(renderService);
    }

    // ── pr9 — confirmation lookup (findOrderBySession) ────────────────────────
    // The owner scope in the WHERE clause is the whole IDOR boundary here: the session id travels in a URL, so
    // "wrong user" and "wrong book" must look identical to "no such order" — null, never a name or a city.

    private static final String SESSION_ID = "cs_test_123";

    /** The row shape the lookup query returns; `values` overrides individual columns. */
    private java.util.Map<String, Object> orderRow() {
        java.util.Map<String, Object> row = new java.util.HashMap<>();
        row.put("id", 5L);
        row.put("status", "submitted");
        row.put("quantity", 2);
        row.put("page_count", 32);
        row.put("amount_cents", 7000);
        row.put("currency", "USD");
        row.put("ship_name", "Test Buyer");
        row.put("ship_city", "Austin");
        row.put("ship_state_code", "TX");
        row.put("created_at", java.sql.Timestamp.from(java.time.Instant.parse("2026-07-21T10:00:00Z")));
        row.put("book_title", "Your First Year");
        return row;
    }

    @Test
    void findOrderBySession_mapsTheRow() {
        when(jdbc.queryForList(anyString(), eq(SESSION_ID), eq(USER_ID), eq(BOOK_ID)))
            .thenReturn(java.util.List.of(orderRow()));

        PrintOrderService.OrderSummary s = service(true).findOrderBySession(USER_ID, BOOK_ID, SESSION_ID);

        assertNotNull(s);
        assertEquals(5L, s.orderId());
        assertEquals("submitted", s.status());
        assertEquals(2, s.quantity());
        assertEquals(7000, s.amountCents());
        assertEquals("Austin", s.shipCity());
        assertEquals("Your First Year", s.bookTitle());
        assertEquals("2026-07-21T10:00:00Z", s.createdAt());
    }

    @Test
    void findOrderBySession_anotherUsersSession_isNotFound() {
        // Scoped by user_id + book_id, so someone else's session id simply matches no row.
        when(jdbc.queryForList(anyString(), eq(SESSION_ID), eq(USER_ID), eq(BOOK_ID)))
            .thenReturn(java.util.List.of());

        assertNull(service(true).findOrderBySession(USER_ID, BOOK_ID, SESSION_ID));
    }

    @Test
    void findOrderBySession_missingSessionId_isNotFound_withoutQuerying() {
        assertNull(service(true).findOrderBySession(USER_ID, BOOK_ID, null));
        assertNull(service(true).findOrderBySession(USER_ID, BOOK_ID, "  "));
        verifyNoInteractions(jdbc);
    }

    // ── s14c — the order list ───────────────────────────────────────────────────────────────────────────

    /**
     * The IDOR boundary and the abandoned-checkout filter are BOTH in the SQL, so this pins the SQL: a row is
     * created 'pending' when Checkout opens, and a user who bailed at the payment page must never see an
     * "order" they didn't pay for.
     */
    @Test
    void listOrders_isUserScoped_andHidesUnpaidCheckouts() {
        when(jdbc.queryForList(anyString(), eq(USER_ID))).thenReturn(java.util.List.of(orderRow()));

        var orders = service(true).listOrders(USER_ID);

        assertEquals(1, orders.size());
        assertEquals(5L, orders.get(0).orderId());

        org.mockito.ArgumentCaptor<String> sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), eq(USER_ID));
        assertTrue(sql.getValue().contains("po.user_id = ?"), sql.getValue());
        assertTrue(sql.getValue().contains("po.status <> 'pending'"), "abandoned checkouts must not be listed");
        assertTrue(sql.getValue().contains("ORDER BY po.id DESC"), "newest first");
    }

    /** Operator-only fields must never reach the customer — the surest way is to not select them at all. */
    @Test
    void listOrders_selectsNoOperatorOnlyFields() {
        when(jdbc.queryForList(anyString(), eq(USER_ID))).thenReturn(java.util.List.of(orderRow()));

        service(true).listOrders(USER_ID);

        org.mockito.ArgumentCaptor<String> sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), eq(USER_ID));
        assertFalse(sql.getValue().contains("failure_reason"), "raw Lulu text is operator-only");
        assertFalse(sql.getValue().contains("lulu_status"), "Lulu's vocabulary is not customer language");
        assertFalse(sql.getValue().contains("stripe_"), "no Stripe ids in a customer payload");
        assertFalse(sql.getValue().contains("ship_street"), "no street address");
        assertFalse(sql.getValue().contains("pdf_url"), "no PDF token urls");
    }

    /** tracking_urls is stored newline-separated; the UI offers exactly one link. */
    @Test
    void listOrders_exposesTheFirstTrackingUrlOnly() {
        var row = orderRow();
        row.put("status", "shipped");
        row.put("tracking_urls", "https://ups.com/first\nhttps://ups.com/second");
        row.put("carrier_name", "UPS");
        when(jdbc.queryForList(anyString(), eq(USER_ID))).thenReturn(java.util.List.of(row));

        var order = service(true).listOrders(USER_ID).get(0);

        assertEquals("https://ups.com/first", order.trackingUrl());
        assertEquals("UPS", order.carrierName());
    }

    /**
     * s14a-2 clears refunded_at when a refund later FAILS (card refunds are asynchronous), so an order whose
     * refund bounced must stop reading as refunded to the customer.
     */
    @Test
    void listOrders_refundedFlagFollowsRefundedAt() {
        var row = orderRow();
        row.put("refunded", Boolean.FALSE);
        when(jdbc.queryForList(anyString(), eq(USER_ID))).thenReturn(java.util.List.of(row));
        assertFalse(service(true).listOrders(USER_ID).get(0).refunded());

        var refunded = orderRow();
        refunded.put("refunded", Boolean.TRUE);
        when(jdbc.queryForList(anyString(), eq(USER_ID))).thenReturn(java.util.List.of(refunded));
        assertTrue(service(true).listOrders(USER_ID).get(0).refunded());
    }
}
