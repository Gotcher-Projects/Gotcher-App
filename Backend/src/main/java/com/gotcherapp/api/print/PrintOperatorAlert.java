package com.gotcherapp.api.print;

import com.gotcherapp.api.auth.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Print s14a-1 — tells a human that a PAID print order needs attention. The whole point of s14a-1 is that no
 * paid order fails silently; this is the "tells someone" half.
 *
 * <p><b>Why its own bean:</b> both {@link PrintOrderFulfilmentService} (an order parks at 'paid') and
 * {@link PrintOrderStatusService} (Lulu rejected a submitted job) alert, and the status service already calls
 * fulfilment to resume parked orders — putting the alert on either of them would be a constructor-injection
 * cycle.
 *
 * <p><b>Never throws.</b> A failed alert must not roll back or abort the status write that triggered it: the
 * truth on the row is what the sweep and s14c read, and it is strictly more important than the email. Note that
 * {@link EmailService} silently no-ops when SMTP isn't configured, which is why pr10 has an explicit step to
 * prove outbound mail actually sends in prod — otherwise every alert here would be swallowed without an error.
 *
 * <p>The body carries the amount and the PaymentIntent so the manual Stripe-dashboard refund (s14a-2, decision
 * D2 — no unattended auto-refund) is a copy-paste rather than an investigation.
 */
@Service
public class PrintOperatorAlert {

    private static final Logger log = LoggerFactory.getLogger(PrintOperatorAlert.class);

    private final JdbcTemplate jdbc;
    private final EmailService email;
    private final String operatorEmail;

    public PrintOperatorAlert(JdbcTemplate jdbc, EmailService email,
                              @Value("${app.print.operator-email:print@cradlehq.app}") String operatorEmail) {
        this.jdbc = jdbc;
        this.email = email;
        this.operatorEmail = operatorEmail;
    }

    /**
     * Email the operator about one order. {@code headline} is the short "what happened" (it becomes the subject
     * after the order id); {@code detail} is the reason text, e.g. the Lulu line-item message.
     */
    public void orderNeedsAttention(long orderId, String headline, String detail) {
        try {
            String subject = "[CradleHQ print] Order #" + orderId + " — " + headline;
            email.send(operatorEmail, subject, body(orderId, headline, detail));
            log.info("Operator alerted about print order {} ({}).", orderId, headline);
        } catch (Exception e) {
            // Deliberately swallowed — see the class doc. The row already carries the truth.
            log.error("Could not alert the operator about print order {} ({}): {}",
                orderId, headline, e.getMessage(), e);
        }
    }

    private String body(long orderId, String headline, String detail) {
        StringBuilder b = new StringBuilder();
        b.append("Print order #").append(orderId).append(" needs a human.\n\n");
        b.append("What happened: ").append(headline).append('\n');
        if (detail != null && !detail.isBlank()) {
            b.append("Reason: ").append(detail).append('\n');
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT status, parked_reason, quantity, amount_cents, currency, lulu_job_id, lulu_status, " +
            "       stripe_payment_intent, stripe_session_id, ship_name, submit_attempts, created_at " +
            "FROM print_orders WHERE id = ?", orderId);
        if (rows.isEmpty()) {
            b.append("\n(No print_orders row found for this id — that is itself worth a look.)\n");
            return b.toString();
        }
        Map<String, Object> r = rows.get(0);
        b.append('\n');
        line(b, "Order status", r.get("status"));
        line(b, "Parked reason", r.get("parked_reason"));
        line(b, "Lulu job", r.get("lulu_job_id"));
        line(b, "Lulu status", r.get("lulu_status"));
        line(b, "Quantity", r.get("quantity"));
        line(b, "Amount", money(r.get("amount_cents"), (String) r.get("currency")));
        line(b, "Ship to", r.get("ship_name"));
        line(b, "Submit attempts", r.get("submit_attempts"));
        line(b, "Placed", r.get("created_at"));
        b.append('\n');
        line(b, "Stripe PaymentIntent", r.get("stripe_payment_intent"));
        line(b, "Stripe session", r.get("stripe_session_id"));
        b.append("\nRefunds are issued by hand from the Stripe dashboard (search the PaymentIntent above).\n");
        return b.toString();
    }

    private static void line(StringBuilder b, String label, Object value) {
        if (value != null && !String.valueOf(value).isBlank()) {
            b.append("  ").append(label).append(": ").append(value).append('\n');
        }
    }

    private static String money(Object cents, String currency) {
        if (cents == null) return null;
        return String.format("%.2f %s", ((Number) cents).intValue() / 100.0,
            currency == null ? "USD" : currency);
    }
}
