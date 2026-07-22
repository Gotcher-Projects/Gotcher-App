package com.gotcherapp.api.print;

import com.gotcherapp.api.auth.EmailService;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Print s14a-2 — the customer-facing emails. "Exactly once" is the requirement, not a nicety: telling a parent
 * twice that their baby's memory book failed to print is worse than the failure. The guard is a conditional
 * UPDATE on a {@code *_notified_at} column, and the send only happens if that claim changed a row.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PrintCustomerEmailTest {

    private static final long ORDER_ID = 6L;

    @Mock JdbcTemplate jdbc;
    @Mock EmailService email;

    private PrintCustomerEmail service() {
        return new PrintCustomerEmail(jdbc, email);
    }

    private void orderRow() {
        when(jdbc.queryForList(startsWith("SELECT u.email"), eq(ORDER_ID))).thenReturn(List.of(Map.of(
            "to_email", "parent@example.com", "display_name", "Ada",
            "amount_cents", 7000, "currency", "usd", "refunded_amount_cents", 7000)));
    }

    private void guardClaims(int rows) {
        when(jdbc.update(startsWith("UPDATE print_orders SET"), eq(ORDER_ID))).thenReturn(rows);
    }

    private String bodyOfSentEmail() {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(email).send(eq("parent@example.com"), anyString(), body.capture());
        return body.getValue();
    }

    @Test
    void orderFailed_emailsTheCustomerOnce() {
        orderRow();
        guardClaims(1);

        service().orderFailed(ORDER_ID);

        String body = bodyOfSentEmail();
        assertTrue(body.contains("Ada"), "greets by name when we have one");
        assertTrue(body.contains("$70.00"), "states the amount being refunded");
        assertTrue(body.contains("refund"), body);
    }

    /** The whole point of the guard: a redelivered webhook must not re-send. */
    @Test
    void orderFailed_secondTime_sendsNothing() {
        orderRow();
        guardClaims(0);   // failure_notified_at was already set

        service().orderFailed(ORDER_ID);

        verifyNoInteractions(email);
    }

    @Test
    void refundIssued_statesTheRefundedAmount() {
        orderRow();
        guardClaims(1);

        service().refundIssued(ORDER_ID);

        String body = bodyOfSentEmail();
        assertTrue(body.contains("$70.00"), body);
        assertTrue(body.contains("5–10 business days"), "sets an expectation we can actually meet");
    }

    /**
     * {@code failure_reason} holds raw operator text ("Upload Error: We detected an error in your PDF…").
     * A parent must never see it, and we must never promise a delivery date on a book that failed.
     */
    @Test
    void failureEmail_leaksNoOperatorText_andPromisesNoDate() {
        orderRow();
        guardClaims(1);

        service().orderFailed(ORDER_ID);

        String body = bodyOfSentEmail().toLowerCase();
        assertFalse(body.contains("lulu"), "the printer is our vendor, not the customer's problem");
        assertFalse(body.contains("upload error"), body);
        assertFalse(body.contains("rejected"), body);
        assertFalse(body.contains("2–3 weeks"), "no delivery promise on an order that failed");
    }

    /** A missing address is a logged problem, not an exception that rolls back the status write. */
    @Test
    void missingRecipient_isSwallowed_andClaimsNothing() {
        when(jdbc.queryForList(startsWith("SELECT u.email"), eq(ORDER_ID))).thenReturn(List.of());

        assertDoesNotThrow(() -> service().orderFailed(ORDER_ID));

        verifyNoInteractions(email);
        verify(jdbc, never()).update(startsWith("UPDATE print_orders SET"), eq(ORDER_ID));
    }

    /** A dead mailer must never propagate — the row's truth outranks the email. */
    @Test
    void aThrowingMailer_isSwallowed() {
        orderRow();
        guardClaims(1);
        doThrow(new RuntimeException("SMTP auth failed")).when(email).send(anyString(), anyString(), anyString());

        assertDoesNotThrow(() -> service().orderFailed(ORDER_ID));
    }
}
