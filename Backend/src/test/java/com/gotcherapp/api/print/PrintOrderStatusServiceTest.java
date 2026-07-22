package com.gotcherapp.api.print;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Print s14a-1 — applying Lulu's truth to a paid order, and the sweep that backstops the webhook.
 *
 * <p>The transitions are all CONDITIONAL updates and the operator alert fires only when one actually changed a
 * row. That is what makes a webhook redelivery (or the sweep re-reading a job the webhook already handled)
 * harmless: without it, every retry would email "refund needed" again for an order already dealt with.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PrintOrderStatusServiceTest {

    private static final long ORDER_ID = 6L;
    private static final long JOB_ID = 316095L;

    @Mock JdbcTemplate jdbc;
    @Mock LuluClient lulu;
    @Mock PrintOrderFulfilmentService fulfilment;
    @Mock PrintOperatorAlert alerts;
    @Mock PrintCustomerEmail customerEmail;

    private final LuluJobStatusMapper mapper = new LuluJobStatusMapper();
    private final ObjectMapper json = new ObjectMapper();

    private PrintOrderStatusService service(boolean printEnabled) {
        return new PrintOrderStatusService(jdbc, lulu, mapper, fulfilment, alerts, customerEmail, printEnabled);
    }

    private LuluJobStatusMapper.JobUpdate update(String body) throws Exception {
        return mapper.parse(json.readTree(body));
    }

    private void orderExistsForJob() {
        when(jdbc.queryForList(startsWith("SELECT id, status FROM print_orders"), eq(JOB_ID)))
            .thenReturn(List.of(Map.of("id", ORDER_ID, "status", "submitted")));
    }

    private static String rejected() {
        return "{\"id\":" + JOB_ID + ",\"status\":{\"name\":\"REJECTED\"},\"line_items\":[{\"status\":" +
            "{\"name\":\"REJECTED\",\"messages\":{\"printable_normalization\":{\"interior\":[\"bad pdf\"]}}}}]}";
    }

    private static String shipped() {
        return "{\"id\":" + JOB_ID + ",\"status\":{\"name\":\"SHIPPED\"},\"line_items\":[{\"status\":" +
            "{\"name\":\"SHIPPED\"},\"tracking_id\":\"1Z999\",\"carrier_name\":\"UPS\"," +
            "\"tracking_urls\":[\"https://ups.com/1Z999\"]}]}";
    }

    @Test
    void rejection_marksTheOrderFailed_andAlertsTheOperator() throws Exception {
        orderExistsForJob();
        when(jdbc.update(startsWith("UPDATE print_orders SET status = 'failed'"), any(), any(), any()))
            .thenReturn(1);

        service(true).applyJobUpdate(update(rejected()));

        verify(jdbc).update(startsWith("UPDATE print_orders SET status = 'failed'"),
            contains("bad pdf"), eq("REJECTED"), eq(ORDER_ID));
        verify(alerts).orderNeedsAttention(eq(ORDER_ID), anyString(), contains("bad pdf"));
    }

    /**
     * s14a-2 — the customer hears about it too, but only AFTER the operator does: the email promises a refund
     * that a human then has to issue by hand (D2), so the signal to that human goes first.
     */
    @Test
    void rejection_alsoEmailsTheCustomer_afterTheOperator() throws Exception {
        orderExistsForJob();
        when(jdbc.update(startsWith("UPDATE print_orders SET status = 'failed'"), any(), any(), any()))
            .thenReturn(1);

        service(true).applyJobUpdate(update(rejected()));

        InOrder order = inOrder(alerts, customerEmail);
        order.verify(alerts).orderNeedsAttention(eq(ORDER_ID), anyString(), anyString());
        order.verify(customerEmail).orderFailed(ORDER_ID);
    }

    /** The redelivery guard: the conditional update matches nothing the second time, so nobody is emailed twice. */
    @Test
    void replayedRejection_doesNotAlertOrEmailASecondTime() throws Exception {
        orderExistsForJob();
        when(jdbc.update(startsWith("UPDATE print_orders SET status = 'failed'"), any(), any(), any()))
            .thenReturn(0);   // already 'failed' — the WHERE clause excluded it

        service(true).applyJobUpdate(update(rejected()));

        verifyNoInteractions(alerts);
        verifyNoInteractions(customerEmail);
    }

    @Test
    void shipped_recordsTrackingAndOnlyMovesForward() throws Exception {
        orderExistsForJob();

        service(true).applyJobUpdate(update(shipped()));

        // The WHERE clause is the "only forward" guard: 'paid'/'submitted' only, never from 'failed'.
        verify(jdbc).update(contains("status IN ('paid', 'submitted')"),
            eq("1Z999"), eq("https://ups.com/1Z999"), eq("UPS"), eq("SHIPPED"), eq(ORDER_ID));
    }

    /** An in-flight status is informational only — record where Lulu is, move nothing of ours. */
    @Test
    void inFlightStatus_onlyRecordsLuluStatus() throws Exception {
        orderExistsForJob();

        service(true).applyJobUpdate(update(
            "{\"id\":" + JOB_ID + ",\"status\":{\"name\":\"IN_PRODUCTION\"}}"));

        verify(jdbc).update(startsWith("UPDATE print_orders SET lulu_status"), eq("IN_PRODUCTION"), eq(ORDER_ID));
        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET status = 'failed'"), any(), any(), any());
    }

    /** pr5's verification script and Lulu's own test payloads produce jobs with no order — must not throw. */
    @Test
    void jobWithNoMatchingOrder_isIgnored() throws Exception {
        when(jdbc.queryForList(startsWith("SELECT id, status FROM print_orders"), eq(JOB_ID)))
            .thenReturn(List.of());

        service(true).applyJobUpdate(update(rejected()));

        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET status"), any(), any(), any());
        verifyNoInteractions(alerts);
    }

    // ── the sweep ───────────────────────────────────────────────────────────────────────────────────────

    private void sweepFinds(Long luluJobId, String parkedReason, int attempts) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", ORDER_ID);
        row.put("lulu_job_id", luluJobId);
        row.put("parked_reason", parkedReason);
        row.put("submit_attempts", attempts);
        when(jdbc.queryForList(startsWith("SELECT id, lulu_job_id"))).thenReturn(List.of(row));
    }

    /** The safety net for a webhook Lulu deactivated (5 failed deliveries) or that never arrived. */
    @Test
    void sweep_reReadsSubmittedJobsFromLulu() throws Exception {
        sweepFinds(JOB_ID, null, 1);
        orderExistsForJob();
        when(lulu.getPrintJobRaw(JOB_ID)).thenReturn(json.readTree(rejected()));
        when(jdbc.update(startsWith("UPDATE print_orders SET status = 'failed'"), any(), any(), any()))
            .thenReturn(1);

        service(true).reconcile();

        verify(alerts).orderNeedsAttention(eq(ORDER_ID), anyString(), contains("bad pdf"));
        verify(jdbc).update(startsWith("UPDATE print_orders SET last_checked_at"), eq(ORDER_ID));
    }

    /** D3, the whole point: "flip PRINT_ENABLED back on after the vacation and in-flight orders resume". */
    @Test
    void sweep_resumesAKillSwitchParkOncePrintIsEnabled() {
        sweepFinds(null, PrintOrderFulfilmentService.PARKED_PRINT_DISABLED, 1);

        service(true).reconcile();

        verify(fulfilment).resubmitParked(ORDER_ID);
    }

    /** Still off: the order waits intact. Burning attempts while parked would exhaust the cap for nothing. */
    @Test
    void sweep_leavesAParkedOrderAloneWhilePrintIsStillDisabled() {
        sweepFinds(null, PrintOrderFulfilmentService.PARKED_PRINT_DISABLED, 1);

        service(false).reconcile();

        verifyNoInteractions(fulfilment);
        verify(jdbc).update(startsWith("UPDATE print_orders SET last_checked_at"), eq(ORDER_ID));
    }

    /** A submit_failed park already woke a human when it parked — retrying it blindly would just re-fail. */
    @Test
    void sweep_doesNotAutoResumeANonResumablePark() {
        sweepFinds(null, PrintOrderFulfilmentService.PARKED_SUBMIT_FAILED, 1);

        service(true).reconcile();

        verifyNoInteractions(fulfilment);
    }

    @Test
    void sweep_stopsResumingAtTheAttemptCap() {
        sweepFinds(null, PrintOrderFulfilmentService.PARKED_PRINT_DISABLED, 5);

        service(true).reconcile();

        verifyNoInteractions(fulfilment);
    }

    /** One unreachable order must not abort the pass — and it still gets its cursor stamped. */
    @Test
    void sweep_survivesAFailedLuluRead() {
        sweepFinds(JOB_ID, null, 1);
        when(lulu.getPrintJobRaw(JOB_ID)).thenThrow(new LuluClient.LuluApiException("Lulu 503", null));

        service(true).reconcile();   // must not throw

        verify(jdbc).update(startsWith("UPDATE print_orders SET last_checked_at"), eq(ORDER_ID));
    }
}
