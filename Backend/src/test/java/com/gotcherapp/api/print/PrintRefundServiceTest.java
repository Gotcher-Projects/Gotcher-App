package com.gotcherapp.api.print;

import com.stripe.model.Charge;
import com.stripe.model.Refund;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Print s14a-2 — recording a dashboard refund.
 *
 * <p>The properties under test are all "don't do it twice, and don't touch what isn't ours": a Stripe
 * redelivery must not re-email a customer about their money, and a refund for a credit pack must never write
 * to a print order. Both are enforced by SQL rather than by Java state, so these pin the conditions.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PrintRefundServiceTest {

    private static final long ORDER_ID = 6L;
    private static final String EVENT_ID = "evt_refund_1";
    private static final String PAYMENT_INTENT = "pi_test_123";

    @Mock JdbcTemplate jdbc;
    @Mock PrintCustomerEmail customerEmail;
    @Mock PrintOperatorAlert alerts;

    private PrintRefundService service() {
        return new PrintRefundService(jdbc, customerEmail, alerts);
    }

    private void orderExists() {
        when(jdbc.queryForList(startsWith("SELECT id FROM print_orders"), eq(PAYMENT_INTENT)))
            .thenReturn(List.of(Map.of("id", ORDER_ID)));
    }

    private void noOrder() {
        when(jdbc.queryForList(startsWith("SELECT id FROM print_orders"), eq(PAYMENT_INTENT)))
            .thenReturn(List.of());
    }

    private Charge refundedCharge(long amountRefunded) {
        Charge c = mock(Charge.class);
        when(c.getPaymentIntent()).thenReturn(PAYMENT_INTENT);
        when(c.getAmountRefunded()).thenReturn(amountRefunded);
        when(c.getRefunds()).thenReturn(null);   // not expanded on a webhook payload — must not blow up
        return c;
    }

    private void recordingApplies(int rows) {
        when(jdbc.update(startsWith("UPDATE print_orders SET refund_id = COALESCE"),
            any(), any(), any(), any(), any())).thenReturn(rows);
    }

    private Refund refund(String id) {
        Refund r = mock(Refund.class);
        when(r.getPaymentIntent()).thenReturn(PAYMENT_INTENT);
        when(r.getId()).thenReturn(id);
        return r;
    }

    @Test
    void refund_isRecordedAndTheCustomerIsTold() {
        orderExists();
        recordingApplies(1);

        service().recordRefund(EVENT_ID, refundedCharge(7000L));

        verify(jdbc).update(startsWith("UPDATE print_orders SET refund_id = COALESCE"),
            isNull(), eq(7000), eq(EVENT_ID), eq(ORDER_ID), eq(EVENT_ID));
        verify(customerEmail).refundIssued(ORDER_ID);
    }

    /**
     * `refund.created` is the ONLY event that reliably carries the refund id — `charge.refunded` hands us a
     * Charge whose `refunds` list isn't expanded, so before this branch existed the id was never stored at all
     * (found live in the s14 verification run, on both a failed and a successful refund).
     */
    @Test
    void refundCreated_storesTheRefundId_andNothingElse() {
        orderExists();

        service().recordRefundId(refund("re_123"));

        verify(jdbc).update(startsWith("UPDATE print_orders SET refund_id = ?"),
            eq("re_123"), eq(ORDER_ID), eq("re_123"));
        // No status change, no refunded_at, no email — which is why ordering vs charge.refunded doesn't matter.
        verifyNoInteractions(customerEmail);
        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET refund_id = COALESCE"),
            any(), any(), any(), any(), any());
    }

    /**
     * `refund.created` fires FIRST, so by the time charge.refunded lands the id is already stored — and the
     * charge's own id is null. A plain assignment would wipe it; COALESCE is what stops that.
     */
    @Test
    void chargeRefunded_cannotWipeAnIdAlreadyStoredByRefundCreated() {
        orderExists();
        recordingApplies(1);

        service().recordRefund(EVENT_ID, refundedCharge(7000L));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(sql.capture(), isNull(), eq(7000), eq(EVENT_ID), eq(ORDER_ID), eq(EVENT_ID));
        assertTrue(sql.getValue().contains("refund_id = COALESCE(?, refund_id)"), sql.getValue());
    }

    @Test
    void refundCreated_forADigitalPurchase_isIgnored() {
        noOrder();

        service().recordRefundId(refund("re_123"));

        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET refund_id = ?"), any(), any(), any());
    }

    /** The redelivery guard — the same event id can't change a row twice, so no second "your refund" email. */
    @Test
    void redeliveredRefundEvent_doesNotEmailAgain() {
        orderExists();
        recordingApplies(0);   // refund_event_id already holds this event

        service().recordRefund(EVENT_ID, refundedCharge(7000L));

        verifyNoInteractions(customerEmail);
    }

    /** A credits/share refund follows a completely different policy and must never touch a print order. */
    @Test
    void refundForADigitalPurchase_isIgnored() {
        noOrder();

        service().recordRefund(EVENT_ID, refundedCharge(1500L));

        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET refund_id"),
            any(), any(), any(), any(), any());
        verifyNoInteractions(customerEmail);
    }

    @Test
    void chargeWithNoPaymentIntent_isIgnored() {
        Charge c = mock(Charge.class);
        when(c.getPaymentIntent()).thenReturn(null);

        service().recordRefund(EVENT_ID, c);

        verifyNoInteractions(customerEmail);
        verify(jdbc, never()).queryForList(anyString(), any(Object[].class));
    }

    /**
     * The ordering that makes this subtle: card refunds are ASYNCHRONOUS, so Stripe reports success, fires
     * charge.refunded, and only later flips to failed (test card 4000000000005126). By then we have already
     * stamped the row as refunded and emailed the customer to say so — both now false.
     *
     * <p>So a failed refund must UNDO the recording, not merely alert: clear `refunded_at` and the amount (the
     * customer does not have their money), and reset `refund_notified_at` so a successful retry re-notifies
     * instead of landing in silence.
     */
    @Test
    void failedRefund_undoesTheRecording_andAlertsTheOperator() {
        orderExists();
        Refund r = mock(Refund.class);
        when(r.getPaymentIntent()).thenReturn(PAYMENT_INTENT);
        when(r.getId()).thenReturn("re_123");
        when(r.getFailureReason()).thenReturn("expired_or_canceled_card");

        service().refundFailed(r);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(sql.capture(), eq("expired_or_canceled_card"), eq("re_123"), eq(ORDER_ID));
        assertTrue(sql.getValue().contains("refunded_at = NULL"), sql.getValue());
        assertTrue(sql.getValue().contains("refunded_amount_cents = NULL"), sql.getValue());
        assertTrue(sql.getValue().contains("refund_notified_at = NULL"),
            "a retry that succeeds must be able to re-notify the customer");
        assertTrue(sql.getValue().contains("refund_id = COALESCE(?, refund_id)"),
            "a failed refund is exactly when support needs the refund id");

        verify(alerts).orderNeedsAttention(eq(ORDER_ID), anyString(), contains("expired_or_canceled_card"));
        // Do NOT email the customer here: they were already told the money was coming, and telling them it
        // failed is a judgement call for a human who can also say what happens next.
        verifyNoInteractions(customerEmail);
    }

    /** After a failure is undone, the retry's charge.refunded lands normally and re-notifies the customer. */
    @Test
    void refundRetryAfterAFailure_recordsAndNotifiesAgain() {
        orderExists();
        recordingApplies(1);   // a NEW event id, so the redelivery guard doesn't block it

        service().recordRefund("evt_refund_2", refundedCharge(7000L));

        verify(customerEmail).refundIssued(ORDER_ID);
    }

    @Test
    void failedRefundForADigitalPurchase_doesNotAlert() {
        noOrder();
        Refund r = mock(Refund.class);
        when(r.getPaymentIntent()).thenReturn(PAYMENT_INTENT);

        service().refundFailed(r);

        verifyNoInteractions(alerts);
    }
}
