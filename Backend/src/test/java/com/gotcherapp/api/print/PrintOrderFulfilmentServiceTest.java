package com.gotcherapp.api.print;

import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Print pr7 (commit b) — the webhook fulfilment's idempotency + failure posture. The atomic pending→paid claim is
 * the single guard against submitting a second Lulu job (= a second physical book) on a Stripe redelivery, so
 * these pin: the first delivery claims + submits + flips to submitted; a redelivery (claim affects 0 rows) is a
 * no-op; and a refused/failed Lulu submit leaves the paid order at 'paid' for s14a rather than dropping it.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PrintOrderFulfilmentServiceTest {

    private static final long ORDER_ID = 5L;
    private static final String EVENT_ID = "evt_print";
    private static final String PAYMENT_INTENT = "pi_test_123";

    @Mock JdbcTemplate jdbc;
    @Mock LuluPrintService luluPrintService;
    @Mock PrintOperatorAlert alerts;

    private PrintOrderFulfilmentService service() {
        return new PrintOrderFulfilmentService(jdbc, luluPrintService, alerts);
    }

    /** A print-order session (address left null — readAddress tolerates it; not what these tests exercise). */
    private Session printSession() {
        Session s = mock(Session.class);
        when(s.getMetadata()).thenReturn(Map.of("type", "print_order", "printOrderId", String.valueOf(ORDER_ID)));
        when(s.getPaymentIntent()).thenReturn(PAYMENT_INTENT);
        return s;
    }

    /** Stub the 11-arg pending→paid claim UPDATE to report it affected {@code rows} (1 = first, 0 = redelivery). */
    private void claimAffects(int rows) {
        when(jdbc.update(startsWith("UPDATE print_orders SET status = 'paid'"),
            any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(rows);
    }

    private void orderRow(int quantity, String interiorUrl, String coverUrl) {
        when(jdbc.queryForMap(startsWith("SELECT quantity"), eq(ORDER_ID))).thenReturn(Map.of(
            "quantity", quantity, "interior_pdf_url", interiorUrl, "cover_pdf_url", coverUrl));
    }

    @Test
    void firstDelivery_claims_submits_flipsToSubmitted() {
        claimAffects(1);
        orderRow(2, "i-url", "c-url");
        when(luluPrintService.submitOrder(eq("print-order-5"), eq("i-url"), eq("c-url"), eq(2), any()))
            .thenReturn(new LuluClient.PrintJob(999L, "CREATED", "print-order-5", List.of()));

        service().fulfil(EVENT_ID, printSession());

        verify(luluPrintService).submitOrder(eq("print-order-5"), eq("i-url"), eq("c-url"), eq(2), any());
        verify(jdbc).update(startsWith("UPDATE print_orders SET status = 'submitted'"), eq(999L), eq(ORDER_ID));
    }

    @Test
    void redelivery_claimAffectsZero_noSubmit() {
        claimAffects(0);   // already paid/submitted — a Stripe redelivery.

        service().fulfil(EVENT_ID, printSession());

        // The claim is the only statement that runs — never a second Lulu job, never even a row read.
        verifyNoInteractions(luluPrintService);
        verify(jdbc, never()).queryForMap(anyString(), any());
        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET status = 'submitted'"), any(), any());
    }

    @Test
    void killSwitchOff_leavesOrderPaid_noRethrow() {
        claimAffects(1);
        orderRow(1, "i-url", "c-url");
        when(luluPrintService.submitOrder(anyString(), anyString(), anyString(), anyInt(), any()))
            .thenThrow(new LuluClient.PrintDisabledException("print disabled"));

        service().fulfil(EVENT_ID, printSession());   // must NOT throw — the paid order is parked for s14a.

        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET status = 'submitted'"), any(), any());
    }

    @Test
    void luluError_leavesOrderPaid_noRethrow() {
        claimAffects(1);
        orderRow(1, "i-url", "c-url");
        when(luluPrintService.submitOrder(anyString(), anyString(), anyString(), anyInt(), any()))
            .thenThrow(new LuluClient.LuluApiException("Lulu 400", null));

        service().fulfil(EVENT_ID, printSession());   // handled failure, not a crash.

        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET status = 'submitted'"), any(), any());
    }

    // ── s14a-1 ──────────────────────────────────────────────────────────────────────────────────────────

    /**
     * The PaymentIntent must land in the SAME atomic claim that records payment. Without it no refund can be
     * issued at all (Refund.create needs a PaymentIntent or charge id) — and a separate write could be lost
     * exactly when the order is the one that failed.
     */
    @Test
    void claim_capturesTheStripePaymentIntent() {
        claimAffects(1);
        orderRow(1, "i-url", "c-url");
        when(luluPrintService.submitOrder(anyString(), anyString(), anyString(), anyInt(), any()))
            .thenReturn(new LuluClient.PrintJob(1L, "CREATED", "print-order-5", List.of()));

        service().fulfil(EVENT_ID, printSession());

        verify(jdbc).update(startsWith("UPDATE print_orders SET status = 'paid'"),
            eq(EVENT_ID), eq(PAYMENT_INTENT), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
            isNull(), isNull(), eq(ORDER_ID));
    }

    /** D3: a kill-switch park is resumable and the book is fine — record it, but do NOT wake anyone up. */
    @Test
    void killSwitchOff_parksAsResumable_withoutAlerting() {
        claimAffects(1);
        orderRow(1, "i-url", "c-url");
        when(luluPrintService.submitOrder(anyString(), anyString(), anyString(), anyInt(), any()))
            .thenThrow(new LuluClient.PrintDisabledException("print disabled"));

        service().fulfil(EVENT_ID, printSession());

        verify(jdbc).update(startsWith("UPDATE print_orders SET parked_reason"),
            eq(PrintOrderFulfilmentService.PARKED_PRINT_DISABLED), anyString(), eq(ORDER_ID));
        verifyNoInteractions(alerts);
    }

    /** D3's other half: a Lulu error is NOT resumable on its own — money is in and a human has to look. */
    @Test
    void luluError_parksAsSubmitFailed_andAlertsTheOperator() {
        claimAffects(1);
        orderRow(1, "i-url", "c-url");
        when(luluPrintService.submitOrder(anyString(), anyString(), anyString(), anyInt(), any()))
            .thenThrow(new LuluClient.LuluApiException("Lulu 400", null));

        service().fulfil(EVENT_ID, printSession());

        verify(jdbc).update(startsWith("UPDATE print_orders SET parked_reason"),
            eq(PrintOrderFulfilmentService.PARKED_SUBMIT_FAILED), anyString(), eq(ORDER_ID));
        verify(alerts).orderNeedsAttention(eq(ORDER_ID), anyString(), anyString());
    }

    /** The "flip PRINT_ENABLED back on and in-flight orders resume" path — address read back off the row. */
    @Test
    void resume_submitsWithTheAddressStoredOnTheRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("quantity", 3);
        row.put("interior_pdf_url", "i-url");
        row.put("cover_pdf_url", "c-url");
        row.put("pdf_expired", Boolean.FALSE);
        row.put("ship_name", "Ada Lovelace");
        row.put("ship_city", "Austin");
        row.put("ship_state_code", "TX");
        when(jdbc.queryForList(startsWith("SELECT quantity"), eq(ORDER_ID))).thenReturn(List.of(row));
        when(luluPrintService.submitOrder(anyString(), anyString(), anyString(), anyInt(), any()))
            .thenReturn(new LuluClient.PrintJob(777L, "CREATED", "print-order-5", List.of()));

        service().resubmitParked(ORDER_ID);

        ArgumentCaptor<LuluPrintService.Address> addr = ArgumentCaptor.forClass(LuluPrintService.Address.class);
        verify(luluPrintService).submitOrder(eq("print-order-5"), eq("i-url"), eq("c-url"), eq(3), addr.capture());
        assertEquals("Ada Lovelace", addr.getValue().name());
        assertEquals("Austin", addr.getValue().city());
        verify(jdbc).update(startsWith("UPDATE print_orders SET status = 'submitted'"), eq(777L), eq(ORDER_ID));
    }

    /**
     * Expired PDFs are a dead end, not a retry: pr3's 24h TTL means an order parked across a long kill-switch
     * window has source_urls that now 404, so submitting would buy a guaranteed Lulu rejection.
     */
    @Test
    void resume_withExpiredPdfs_parksAndAlerts_withoutSubmitting() {
        when(jdbc.queryForList(startsWith("SELECT quantity"), eq(ORDER_ID))).thenReturn(List.of(Map.of(
            "quantity", 1, "interior_pdf_url", "i-url", "cover_pdf_url", "c-url", "pdf_expired", Boolean.TRUE)));

        service().resubmitParked(ORDER_ID);

        verifyNoInteractions(luluPrintService);
        verify(jdbc).update(startsWith("UPDATE print_orders SET parked_reason"),
            eq(PrintOrderFulfilmentService.PARKED_PDF_EXPIRED), anyString(), eq(ORDER_ID));
        verify(alerts).orderNeedsAttention(eq(ORDER_ID), anyString(), anyString());
    }

    /** Already submitted / already failed / claimed by a concurrent pass — matches nothing, submits nothing. */
    @Test
    void resume_ineligibleOrder_isANoOp() {
        when(jdbc.queryForList(startsWith("SELECT quantity"), eq(ORDER_ID))).thenReturn(List.of());

        service().resubmitParked(ORDER_ID);

        verifyNoInteractions(luluPrintService);
        verifyNoInteractions(alerts);
    }
}
