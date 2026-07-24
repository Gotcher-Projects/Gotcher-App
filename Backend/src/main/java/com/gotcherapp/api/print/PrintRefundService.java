package com.gotcherapp.api.print;

import com.stripe.model.Charge;
import com.stripe.model.Refund;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Print s14a-2 — records a refund that a human issued from the Stripe dashboard, and shouts when one fails.
 *
 * <p><b>The direction is deliberately inverted</b> (decision D2): the app never calls {@code Refund.create}.
 * Michael refunds by hand and this service *learns* about it from the signed webhook. Nothing here can move
 * money, so there is no auto-refund loop to get wrong — and the research is blunt about why that matters: a
 * refund can genuinely <b>fail</b> (expired/lost card, insufficient balance), and Stripe's processing fee is
 * never returned (~$1.32 on a refunded $35 order, real money out of our pocket).
 *
 * <p><b>Scoped to print orders only.</b> A refund whose PaymentIntent matches no {@code print_orders} row is a
 * digital purchase (credits / a share unlock) and is ignored in silence — those follow the entirely different
 * "move the share unlock" policy in {@code payments/p0.5-open-questions.md} §2.
 */
@Service
public class PrintRefundService {

    private static final Logger log = LoggerFactory.getLogger(PrintRefundService.class);

    private final JdbcTemplate jdbc;
    private final PrintCustomerEmail customerEmail;
    private final PrintOperatorAlert alerts;

    public PrintRefundService(JdbcTemplate jdbc, PrintCustomerEmail customerEmail, PrintOperatorAlert alerts) {
        this.jdbc = jdbc;
        this.customerEmail = customerEmail;
        this.alerts = alerts;
    }

    /**
     * Record a {@code charge.refunded} against its print order and tell the customer their money is coming.
     *
     * <p>Idempotent on the Stripe event id: the UPDATE only fires when the row isn't already stamped with THIS
     * event, so a redelivery changes nothing and therefore re-sends no email. A genuinely new refund event (a
     * second partial refund, say) still lands, which is why the stored amount is Stripe's <b>cumulative</b>
     * {@code amount_refunded} rather than the size of one refund.
     */
    public void recordRefund(String eventId, Charge charge) {
        String paymentIntent = charge.getPaymentIntent();
        if (paymentIntent == null || paymentIntent.isBlank()) {
            log.debug("charge.refunded {} carries no payment_intent — not a print order.", eventId);
            return;
        }
        Long orderId = findPrintOrder(paymentIntent);
        if (orderId == null) {
            log.debug("Refund on {} matches no print order — digital purchase, ignoring.", paymentIntent);
            return;
        }

        Long refundedCents = charge.getAmountRefunded();
        String refundId = latestRefundId(charge);

        // COALESCE, not a plain assignment: `charge.refunds` is almost never expanded on a webhook payload, so
        // refundId is usually null here — and `refund.created` fires FIRST and has already stored the real id.
        // Assigning null would wipe it. (Verified 2026-07-21: every charge.refunded we've received had it null.)
        int applied = jdbc.update(
            "UPDATE print_orders SET refund_id = COALESCE(?, refund_id), refunded_at = NOW(), " +
            "refunded_amount_cents = ?, refund_event_id = ?, updated_at = NOW() " +
            "WHERE id = ? AND (refund_event_id IS NULL OR refund_event_id <> ?)",
            refundId, refundedCents == null ? null : refundedCents.intValue(), eventId, orderId, eventId);
        if (applied == 0) {
            log.info("Refund event {} already recorded on print order {} (redelivery) — no second email.",
                eventId, orderId);
            return;
        }
        log.info("Recorded a refund of {} cents on print order {} (refund {}, event {}).",
            refundedCents, orderId, refundId, eventId);
        customerEmail.refundIssued(orderId);
    }

    /**
     * Store the Stripe refund id from a {@code refund.created} event. This is the ONLY event that reliably
     * carries it: {@code charge.refunded} hands us a Charge whose {@code refunds} list is not expanded, so the
     * id was silently never recorded until this branch existed (found in the s14 verification run — every
     * refund landed with `refund_id` null, on both a failed and a successful refund).
     *
     * <p>Id only — no status change, no email, no {@code refunded_at}. That is what makes the ordering between
     * this and {@code charge.refunded} irrelevant: whichever arrives second doesn't undo the first.
     */
    public void recordRefundId(Refund refund) {
        String paymentIntent = refund.getPaymentIntent();
        String refundId = refund.getId();
        if (paymentIntent == null || paymentIntent.isBlank() || refundId == null) {
            return;
        }
        Long orderId = findPrintOrder(paymentIntent);
        if (orderId == null) {
            log.debug("refund.created on {} matches no print order — ignoring.", paymentIntent);
            return;
        }
        int n = jdbc.update(
            "UPDATE print_orders SET refund_id = ?, updated_at = NOW() " +
            "WHERE id = ? AND (refund_id IS NULL OR refund_id <> ?)",
            refundId, orderId, refundId);
        if (n > 0) {
            log.info("Recorded Stripe refund id {} on print order {}.", refundId, orderId);
        }
    }

    /**
     * A refund that did NOT reach the customer. Stripe will not retry it for us, and we have already promised
     * the money back in the "we couldn't print your book" email — so this must reach a human.
     *
     * <p><b>This runs AFTER we already recorded a success.</b> Card refunds are asynchronous: Stripe reports the
     * refund as {@code succeeded}, fires {@code charge.refunded}, and only later transitions it to
     * {@code failed} (reproducible in test mode with card {@code 4000000000005126}). So by the time we get here
     * the row usually claims the money is back and the customer has already been emailed to say so. Both of
     * those are now lies, and this method undoes them:
     *
     * <ul>
     *   <li>{@code refunded_at} / {@code refunded_amount_cents} are <b>cleared</b> — the one question this table
     *       gets asked is "does the customer have their money back?", and the answer is no. {@code refund_id}
     *       and the new failure columns keep the audit trail of the attempt.</li>
     *   <li>{@code refund_notified_at} is <b>reset</b>, so when a retry finally lands the customer actually
     *       hears about it instead of the good news arriving in silence.</li>
     * </ul>
     */
    public void refundFailed(Refund refund) {
        String paymentIntent = refund.getPaymentIntent();
        if (paymentIntent == null || paymentIntent.isBlank()) {
            return;
        }
        Long orderId = findPrintOrder(paymentIntent);
        if (orderId == null) {
            log.debug("refund.failed on {} matches no print order — ignoring.", paymentIntent);
            return;
        }
        String reason = refund.getFailureReason() == null ? "(no reason given)" : refund.getFailureReason();

        // The refund id is persisted here too (COALESCE so a null can't wipe what refund.created stored) —
        // a failed refund is precisely when support needs to look it up in Stripe.
        jdbc.update(
            "UPDATE print_orders SET refunded_at = NULL, refunded_amount_cents = NULL, " +
            "refund_notified_at = NULL, refund_failed_at = NOW(), refund_failure_reason = ?, " +
            "refund_id = COALESCE(?, refund_id), updated_at = NOW() WHERE id = ?",
            reason, refund.getId(), orderId);

        log.error("Refund {} FAILED for print order {}: {} — the order is owed money again.",
            refund.getId(), orderId, reason);
        alerts.orderNeedsAttention(orderId,
            "a refund FAILED — the customer is still owed money",
            "Stripe reported \"" + reason + "\" for refund " + refund.getId() + ". The customer has ALREADY been "
                + "told the refund was on its way, so this needs another attempt (a different method may be "
                + "required). The order has been marked unrefunded again, and a successful retry will re-notify "
                + "them automatically.");
    }

    /** Our order for this PaymentIntent, or null when the charge belongs to a digital purchase. */
    private Long findPrintOrder(String paymentIntent) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM print_orders WHERE stripe_payment_intent = ?", paymentIntent);
        return rows.isEmpty() ? null : ((Number) rows.get(0).get("id")).longValue();
    }

    /**
     * The most recent refund id off the charge. Best-effort: the {@code refunds} list isn't always expanded on
     * a webhook payload, and a missing id is not worth failing the recording over — the amount and the
     * PaymentIntent are what actually matter, and both are on the charge itself.
     */
    private static String latestRefundId(Charge charge) {
        try {
            if (charge.getRefunds() == null || charge.getRefunds().getData() == null
                || charge.getRefunds().getData().isEmpty()) {
                return null;
            }
            List<Refund> refunds = charge.getRefunds().getData();
            return refunds.get(0).getId();   // Stripe returns refunds newest-first
        } catch (Exception e) {
            log.debug("Could not read a refund id off charge {}: {}", charge.getId(), e.getMessage());
            return null;
        }
    }
}
