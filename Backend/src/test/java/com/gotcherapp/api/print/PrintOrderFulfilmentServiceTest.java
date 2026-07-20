package com.gotcherapp.api.print;

import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

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

    @Mock JdbcTemplate jdbc;
    @Mock LuluPrintService luluPrintService;

    private PrintOrderFulfilmentService service() {
        return new PrintOrderFulfilmentService(jdbc, luluPrintService);
    }

    /** A print-order session (address left null — readAddress tolerates it; not what these tests exercise). */
    private Session printSession() {
        Session s = mock(Session.class);
        when(s.getMetadata()).thenReturn(Map.of("type", "print_order", "printOrderId", String.valueOf(ORDER_ID)));
        return s;
    }

    /** Stub the 10-arg pending→paid claim UPDATE to report it affected {@code rows} (1 = first, 0 = redelivery). */
    private void claimAffects(int rows) {
        when(jdbc.update(startsWith("UPDATE print_orders SET status = 'paid'"),
            any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(rows);
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
}
