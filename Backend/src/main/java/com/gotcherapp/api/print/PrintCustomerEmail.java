package com.gotcherapp.api.print;

import com.gotcherapp.api.auth.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Print s14a-2 — the two emails the CUSTOMER gets when a printed book goes wrong. Sibling of
 * {@link PrintOperatorAlert}, and deliberately a different bean: that one is internal and can say anything;
 * this one is a promise made to somebody who paid us.
 *
 * <p><b>Exactly once, enforced in SQL.</b> Each send is claimed by a conditional UPDATE on a
 * {@code *_notified_at} column, and the mail only goes out if the claim actually changed a row. A webhook
 * redelivery therefore cannot re-send. Telling a parent twice that their baby's memory book failed to print
 * would be worse than the failure itself.
 *
 * <p><b>Tone rules</b> (these are money emails, not marketing): plain language, no delivery date we can't hit,
 * no raw Lulu text — {@code failure_reason} holds operator text like "Upload Error: We detected an error in
 * your PDF…", which is meaningless and alarming to a customer. And this is a genuine cash refund, NOT the
 * digital "move the share unlock" policy from {@code payments/p0.5-open-questions.md} §2.
 *
 * <p><b>Never throws</b> — same reasoning as {@link PrintOperatorAlert}: the truth on the row matters more than
 * the email, and a dead mailer must not roll back a status write. ⚠ The flip side is that a failed send still
 * burns the one-shot guard; that is the deliberate trade (never double-send &gt; always send), and it is why
 * pr10 has a step to prove outbound mail actually works in prod.
 */
@Service
public class PrintCustomerEmail {

    private static final Logger log = LoggerFactory.getLogger(PrintCustomerEmail.class);

    private final JdbcTemplate jdbc;
    private final EmailService email;

    public PrintCustomerEmail(JdbcTemplate jdbc, EmailService email) {
        this.jdbc = jdbc;
        this.email = email;
    }

    /**
     * "We couldn't print your book." Fires from a-1's {@code failed} transition. Says a refund is coming —
     * which is a promise a human then has to keep, so the operator alert must be working before this ships.
     */
    public void orderFailed(long orderId) {
        send(orderId, "failure_notified_at", (recipient, order) -> {
            String subject = "About your CradleHQ book order #" + orderId;
            String body = greeting(recipient)
                + "Something went wrong while your memory book was being prepared for printing, and we weren't\n"
                + "able to complete it. We're sorry — we know this isn't the book you were waiting for.\n\n"
                + "You will not be charged for a book you don't receive. We're refunding your order of "
                + money(order) + " in full,\n"
                + "and it should be back on your card within 5–10 business days.\n\n"
                + "Your book itself is safe and unchanged in the app — nothing was lost.\n\n"
                + "If you'd like us to try again, or you just want to talk to a person, reply to this email\n"
                + "and mention order #" + orderId + ".\n\n"
                + "— CradleHQ\n";
            return new Message(subject, body);
        });
    }

    /** "Your refund is on its way." Fires when a dashboard refund is recorded against the order. */
    public void refundIssued(long orderId) {
        send(orderId, "refund_notified_at", (recipient, order) -> {
            String subject = "Your CradleHQ refund for order #" + orderId;
            String body = greeting(recipient)
                + "Your refund of " + refundMoney(order) + " for order #" + orderId + " has been issued.\n\n"
                + "Refunds usually take 5–10 business days to appear, depending on your bank.\n\n"
                + "If it hasn't arrived after that, reply to this email and we'll chase it up.\n\n"
                + "— CradleHQ\n";
            return new Message(subject, body);
        });
    }

    // ── plumbing ───────────────────────────────────────────────────────────────────────────────────────

    private record Message(String subject, String body) {}

    private interface Composer {
        Message compose(String displayName, Map<String, Object> order);
    }

    /**
     * Claim the one-shot guard, then send. The claim is the whole idempotency story: {@code guardColumn IS NULL}
     * means "not yet told", and only the caller that flips it composes an email.
     */
    private void send(long orderId, String guardColumn, Composer composer) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT u.email AS to_email, u.display_name, po.amount_cents, po.currency, " +
                "       po.refunded_amount_cents " +
                "FROM print_orders po JOIN users u ON u.id = po.user_id WHERE po.id = ?", orderId);
            if (rows.isEmpty()) {
                log.error("No print order {} (or no user on it) — cannot send the customer email.", orderId);
                return;
            }
            Map<String, Object> order = rows.get(0);
            String to = (String) order.get("to_email");
            if (to == null || to.isBlank()) {
                log.error("Print order {} has no customer email address — nothing sent.", orderId);
                return;
            }

            // Column name is interpolated, never user input: both call sites pass a literal constant above.
            int claimed = jdbc.update(
                "UPDATE print_orders SET " + guardColumn + " = NOW(), updated_at = NOW() " +
                "WHERE id = ? AND " + guardColumn + " IS NULL", orderId);
            if (claimed == 0) {
                log.info("Customer was already emailed about print order {} ({}) — not sending again.",
                    orderId, guardColumn);
                return;
            }

            Message m = composer.compose((String) order.get("display_name"), order);
            email.send(to, m.subject(), m.body());
            log.info("Customer emailed about print order {} ({}).", orderId, guardColumn);
        } catch (Exception e) {
            // Swallowed on purpose — see the class doc. The row already carries the truth.
            log.error("Could not send the customer email for print order {} ({}): {}",
                orderId, guardColumn, e.getMessage(), e);
        }
    }

    private static String greeting(String displayName) {
        return (displayName == null || displayName.isBlank()) ? "Hi,\n\n" : "Hi " + displayName + ",\n\n";
    }

    private static String money(Map<String, Object> order) {
        return money(order.get("amount_cents"), (String) order.get("currency"));
    }

    /** The refunded total when we know it, falling back to the order total (the email says "in full" anyway). */
    private static String refundMoney(Map<String, Object> order) {
        Object refunded = order.get("refunded_amount_cents");
        return money(refunded != null ? refunded : order.get("amount_cents"), (String) order.get("currency"));
    }

    private static String money(Object cents, String currency) {
        if (cents == null) return "your order total";
        return String.format("$%.2f %s", ((Number) cents).intValue() / 100.0,
            currency == null ? "USD" : currency.toUpperCase());
    }
}
