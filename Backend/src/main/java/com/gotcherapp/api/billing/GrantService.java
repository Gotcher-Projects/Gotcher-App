package com.gotcherapp.api.billing;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Payments P3 — applies a completed purchase exactly once. This is the single most important
 * correctness surface in the product: a bug here either grants credits nobody paid for, or takes
 * money and grants nothing.
 *
 * Idempotency: the event_id primary key + "grant ONLY if the insert added a row" makes a Stripe
 * redelivery (retries, dashboard "Resend", network hiccups) a no-op instead of a second grant.
 *
 * This lives in its OWN bean, called from BillingWebhookService, on purpose: @Transactional only works
 * when the call goes through Spring's proxy, and a self-invocation within one class would silently skip
 * the transaction. The Stripe API call that reads the credit count stays in the webhook service, so no
 * network round-trip is held inside this DB transaction.
 */
@Service
public class GrantService {

    private final JdbcTemplate jdbc;

    public GrantService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * @return true if this call applied the grant; false if the event was already applied (a redelivery).
     */
    @Transactional
    public boolean apply(String eventId, long userId, String sku, int credits, Long bookId) {
        int inserted = jdbc.update(
            "INSERT INTO stripe_events_applied (event_id, user_id, sku, credits, unlocked_book_id) " +
            "VALUES (?, ?, ?, ?, ?) ON CONFLICT (event_id) DO NOTHING",
            eventId, userId, sku, credits, bookId);

        if (inserted != 1) {
            return false;   // already recorded — a redelivery. No second grant.
        }

        // Credits and the book unlock are independent: credit packs grant only credits; share_only grants
        // only the unlock (credits=0); the bundle grants both. Both writes commit with the ledger row.
        if (credits > 0) {
            jdbc.update(
                "UPDATE users SET ai_credits_remaining = ai_credits_remaining + ? WHERE id = ?",
                credits, userId);
        }
        if (bookId != null) {
            jdbc.update(
                "UPDATE books SET share_unlocked_at = NOW() WHERE id = ? AND share_unlocked_at IS NULL",
                bookId);
        }
        return true;
    }
}
