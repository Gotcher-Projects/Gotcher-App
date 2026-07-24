package com.gotcherapp.api.print;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Print s14a-1 — the truth about a paid order's fate. Everything Lulu tells us about a print job lands here,
 * from either of two feeds, and both go through the one {@link LuluJobStatusMapper}:
 *
 * <ol>
 *   <li><b>The signed webhook</b> ({@link LuluWebhookService}) — the fast path. Lulu pushes
 *       {@code PRINT_JOB_STATUS_CHANGED} within seconds and hands us SHIPPED + tracking for free.</li>
 *   <li><b>{@link #reconcile()}, the sweep</b> — the safety net (decision D1). Lulu <b>auto-deactivates a
 *       webhook after 5 consecutive failed deliveries</b>, so a deploy window or a bad restart can silently
 *       switch off our only failure detector. When the failure mode is "the customer paid and got nothing",
 *       one detector isn't enough: the sweep re-reads any order still in flight, so a missed or deactivated
 *       webhook is self-healing.</li>
 * </ol>
 *
 * <p><b>What it does NOT do: move money.</b> Decision D2 — no unattended auto-refund; Michael refunds from the
 * Stripe dashboard and {@link PrintRefundService} (s14a-2) records it. This service knows the truth and tells
 * people about it — the operator always, and since s14a-2 the customer too on a failure.
 */
@Service
public class PrintOrderStatusService {

    private static final Logger log = LoggerFactory.getLogger(PrintOrderStatusService.class);

    // Cadence: slow on purpose. The webhook is the fast path; this only exists to catch what it missed.
    private static final long SWEEP_INTERVAL_MS = 30 * 60_000L;
    private static final long SWEEP_INITIAL_DELAY_MS = 2 * 60_000L;   // let the app finish booting first
    private static final String SWEEP_STALE_AFTER = "25 minutes";     // < the interval, so nothing is ever skipped
    private static final String SWEEP_HORIZON = "30 days";            // beyond this, a stuck order is a manual matter
    private static final int SWEEP_BATCH = 100;

    /** How many times we'll ever try to submit one order before it stops being retried automatically. */
    private static final int MAX_SUBMIT_ATTEMPTS = 5;

    private final JdbcTemplate jdbc;
    private final LuluClient lulu;
    private final LuluJobStatusMapper mapper;
    private final PrintOrderFulfilmentService fulfilment;
    private final PrintOperatorAlert alerts;
    private final PrintCustomerEmail customerEmail;
    private final boolean printEnabled;

    public PrintOrderStatusService(JdbcTemplate jdbc, LuluClient lulu, LuluJobStatusMapper mapper,
                                   PrintOrderFulfilmentService fulfilment, PrintOperatorAlert alerts,
                                   PrintCustomerEmail customerEmail,
                                   @Value("${app.print.enabled:false}") boolean printEnabled) {
        this.jdbc = jdbc;
        this.lulu = lulu;
        this.mapper = mapper;
        this.fulfilment = fulfilment;
        this.alerts = alerts;
        this.customerEmail = customerEmail;
        this.printEnabled = printEnabled;
    }

    /**
     * Apply one Lulu job payload to its order. Idempotent by construction: every status move is a CONDITIONAL
     * update, and the operator is alerted only when the update actually changed a row — so a webhook redelivery
     * (or the sweep re-reading a job the webhook already handled) neither double-alerts nor rewinds a status.
     *
     * <p>An unknown job id is NOT an error: pr5's verification script and Lulu's own {@code /webhooks/{id}/test/}
     * both produce jobs with no order behind them. Logging and returning normally keeps those deliveries at 200,
     * which matters — five failures in a row and Lulu turns the webhook off.
     */
    public void applyJobUpdate(LuluJobStatusMapper.JobUpdate u) {
        if (!u.isActionable()) {
            log.debug("Lulu payload carried no print-job id — nothing to apply.");
            return;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, status FROM print_orders WHERE lulu_job_id = ?", u.jobId());
        if (rows.isEmpty()) {
            log.info("Lulu job {} (status {}) matches no print order — ignoring (test payload or a script job).",
                u.jobId(), u.luluStatus());
            return;
        }
        long orderId = ((Number) rows.get(0).get("id")).longValue();

        if (LuluJobStatusMapper.STATUS_FAILED.equals(u.orderStatus())) {
            // Terminal. Guarded against 'shipped' too: a late/replayed rejection must never un-ship an order.
            int n = jdbc.update(
                "UPDATE print_orders SET status = 'failed', failure_reason = ?, lulu_status = ?, " +
                "lulu_status_at = NOW(), updated_at = NOW() " +
                "WHERE id = ? AND status NOT IN ('failed', 'shipped')",
                u.failureReason(), u.luluStatus(), orderId);
            if (n > 0) {
                log.error("Print order {} FAILED at Lulu (job {}, {}): {}",
                    orderId, u.jobId(), u.luluStatus(), u.failureReason());
                alerts.orderNeedsAttention(orderId, "Lulu rejected a PAID order — refund needed",
                    u.failureReason());
                // s14a-2: and tell the customer. Operator FIRST and deliberately so — this email promises a
                // refund that a human then has to issue by hand (D2), so the signal to that human must already
                // be out the door before we make the promise.
                customerEmail.orderFailed(orderId);
            }
            return;
        }

        if (LuluJobStatusMapper.STATUS_SHIPPED.equals(u.orderStatus())) {
            // Only ever forward: 'paid'/'submitted' → 'shipped'. Never from 'failed', never a second time.
            int n = jdbc.update(
                "UPDATE print_orders SET status = 'shipped', tracking_id = ?, tracking_urls = ?, " +
                "carrier_name = ?, shipped_at = NOW(), lulu_status = ?, lulu_status_at = NOW(), " +
                "updated_at = NOW() WHERE id = ? AND status IN ('paid', 'submitted')",
                u.trackingId(), u.trackingUrls(), u.carrierName(), u.luluStatus(), orderId);
            if (n > 0) {
                log.info("Print order {} SHIPPED (job {}, carrier {}, tracking {}).",
                    orderId, u.jobId(), u.carrierName(), u.trackingId());
            }
            return;
        }

        // Everything in between (UNPAID, PAYMENT_IN_PROGRESS, PRODUCTION_DELAYED, PRODUCTION_READY,
        // IN_PRODUCTION, DELIVERED): record where Lulu is, leave OUR status alone. Informational only — the
        // sweep re-reads from Lulu, so a stale redelivery landing here is corrected on the next pass.
        jdbc.update("UPDATE print_orders SET lulu_status = ?, lulu_status_at = NOW(), updated_at = NOW() " +
            "WHERE id = ?", u.luluStatus(), orderId);
        log.debug("Print order {} — Lulu job {} is now {}.", orderId, u.jobId(), u.luluStatus());
    }

    /**
     * The safety net (D1). Every ~30 minutes, look at every order that is still in flight:
     *
     * <ul>
     *   <li><b>Has a Lulu job</b> → re-read it and run it through the same mapper. This is what catches a
     *       rejection whose webhook never arrived (or arrived while the webhook was deactivated).</li>
     *   <li><b>No Lulu job</b> (parked at 'paid') → resume it if it's the resumable kind and print is back on.
     *       This is the "turn {@code PRINT_ENABLED} back on after the vacation" path (D3): a parked order is not
     *       a failed order, and must never be refunded for being parked.</li>
     * </ul>
     *
     * <p>One bad order must not stop the pass, so failures are caught per order, and {@code last_checked_at} is
     * stamped either way — a persistently weird order gets re-checked on the normal cadence instead of being
     * hammered every pass.
     */
    @Scheduled(fixedRate = SWEEP_INTERVAL_MS, initialDelay = SWEEP_INITIAL_DELAY_MS)
    public void reconcile() {
        List<Map<String, Object>> due = jdbc.queryForList(
            "SELECT id, lulu_job_id, parked_reason, submit_attempts FROM print_orders " +
            "WHERE status IN ('paid', 'submitted') " +
            "  AND created_at > NOW() - INTERVAL '" + SWEEP_HORIZON + "' " +
            "  AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '" + SWEEP_STALE_AFTER + "') " +
            "ORDER BY id LIMIT " + SWEEP_BATCH);
        if (due.isEmpty()) {
            return;
        }
        log.info("Print reconciliation sweep: {} order(s) in flight.", due.size());

        for (Map<String, Object> row : due) {
            long orderId = ((Number) row.get("id")).longValue();
            try {
                checkOne(orderId, (Number) row.get("lulu_job_id"), (String) row.get("parked_reason"),
                    ((Number) row.get("submit_attempts")).intValue());
            } catch (Exception e) {
                log.error("Print reconciliation failed for order {}: {}", orderId, e.getMessage(), e);
            } finally {
                jdbc.update("UPDATE print_orders SET last_checked_at = NOW() WHERE id = ?", orderId);
            }
        }
    }

    private void checkOne(long orderId, Number luluJobId, String parkedReason, int submitAttempts) {
        if (luluJobId != null) {
            applyJobUpdate(mapper.parse(lulu.getPrintJobRaw(luluJobId.longValue())));
            return;
        }
        // Parked at 'paid' with no job. Only the kill-switch park is safely resumable: a submit_failed or
        // pdf_expired order already alerted a human when it parked, and retrying it blindly would just re-fail.
        if (!PrintOrderFulfilmentService.PARKED_PRINT_DISABLED.equals(parkedReason)) {
            log.debug("Print order {} is parked ({}) and not auto-resumable — leaving it for the operator.",
                orderId, parkedReason);
            return;
        }
        if (!printEnabled) {
            // Deliberately off. Burn no attempts — the order waits, intact, for the flag to come back on.
            log.debug("Print order {} is parked by the kill switch; print is still disabled.", orderId);
            return;
        }
        if (submitAttempts >= MAX_SUBMIT_ATTEMPTS) {
            log.warn("Print order {} has hit the submit-attempt cap ({}) — no further auto-resume.",
                orderId, MAX_SUBMIT_ATTEMPTS);
            return;
        }
        log.info("Print order {} was parked by the kill switch and print is enabled again — resuming.", orderId);
        fulfilment.resubmitParked(orderId);
    }
}
