package com.gotcherapp.api.billing;

import com.gotcherapp.api.billing.dto.CheckoutRequest;
import com.stripe.Stripe;
import com.stripe.model.Customer;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;

/**
 * Payments P2 — creates a Stripe-hosted Checkout Session for one of the four one-time SKUs.
 * This class NEVER grants anything: it only produces a checkout URL. Credits and book unlocks are
 * applied exclusively by the webhook (P3), because the browser returning to the success page proves
 * nothing — only Stripe's signed webhook does.
 */
@Service
public class BillingService {

    private final JdbcTemplate jdbc;
    private final String secretKey;
    private final String frontendUrl;
    private final Map<Sku, String> priceIds;

    public BillingService(
        JdbcTemplate jdbc,
        @Value("${stripe.secret.key}") String secretKey,
        @Value("${stripe.price.credits50}") String priceCredits50,
        @Value("${stripe.price.credits125}") String priceCredits125,
        @Value("${stripe.price.bundleShare150}") String priceBundleShare150,
        @Value("${stripe.price.shareOnly}") String priceShareOnly,
        @Value("${app.frontend-url}") String frontendUrl
    ) {
        this.jdbc = jdbc;
        this.secretKey = secretKey;
        this.frontendUrl = frontendUrl;
        this.priceIds = new EnumMap<>(Sku.class);
        priceIds.put(Sku.CREDITS_50, priceCredits50);
        priceIds.put(Sku.CREDITS_125, priceCredits125);
        priceIds.put(Sku.BUNDLE_SHARE_150, priceBundleShare150);
        priceIds.put(Sku.SHARE_ONLY, priceShareOnly);
    }

    @PostConstruct
    void init() {
        // Global for the process; one Stripe account. Blank when billing isn't configured locally —
        // calls then fail with a Stripe auth error (→ 500), which is the correct "not set up" behavior.
        Stripe.apiKey = secretKey;
    }

    /**
     * Validate the request, prove the caller owns the book (for share SKUs), ensure a Stripe customer,
     * and open a Checkout Session. Returns the hosted URL to redirect the browser to.
     *
     * @throws IllegalArgumentException   unknown sku, or a bookId that is required-but-missing / present-but-not-allowed (→ 400)
     * @throws BookNotAccessibleException the bookId does not belong to the caller (→ 404; we don't reveal existence)
     */
    public String createCheckout(Long userId, CheckoutRequest req) throws Exception {
        Sku sku = Sku.fromWire(req.sku());
        Long bookId = req.bookId();

        // bookId presence rules: required for share SKUs, forbidden for credit packs.
        if (sku.requiresBookId() && bookId == null) {
            throw new IllegalArgumentException("bookId is required for sku " + sku.wireName());
        }
        if (!sku.requiresBookId() && bookId != null) {
            throw new IllegalArgumentException("bookId is not allowed for sku " + sku.wireName());
        }

        // IDOR boundary: books has no user_id — ownership is books.baby_profile_id -> baby_profiles.user_id.
        // Skipping this lets a user pay to unlock a stranger's book. Mirrors StorybookService's boundary.
        if (bookId != null && !userOwnsBook(userId, bookId)) {
            throw new BookNotAccessibleException("Book not found");
        }

        String customerId = ensureCustomer(userId);
        String priceId = priceIds.get(sku);

        SessionCreateParams.Builder params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setCustomer(customerId)
            .setClientReferenceId(String.valueOf(userId))   // how P3's webhook resolves the buyer
            .addLineItem(SessionCreateParams.LineItem.builder()
                .setPrice(priceId)
                .setQuantity(1L)
                .build())
            .putMetadata("sku", sku.wireName())
            // Return as query params on the app root, handled in App.jsx boot like email_verified/reset_token
            // (Payments P5/P7 — lightweight routing, no dedicated route). The success page CONFIRMS, never grants.
            .setSuccessUrl(frontendUrl + "/?upgrade=success&session_id={CHECKOUT_SESSION_ID}")
            .setCancelUrl(frontendUrl + "/?upgrade=cancelled");
        if (bookId != null) {
            params.putMetadata("bookId", String.valueOf(bookId));   // P3 sets books.share_unlocked_at for this id
        }

        // Derived idempotency key: a double-clicked Buy button (two calls within the window) collapses to
        // one Checkout Session. A legitimate re-buy of the same pack after the window gets a fresh session.
        RequestOptions options = RequestOptions.builder()
            .setIdempotencyKey(idempotencyKey(userId, sku, bookId))
            .build();

        Session session = Session.create(params.build(), options);
        return session.getUrl();
    }

    private boolean userOwnsBook(Long userId, Long bookId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM books b JOIN baby_profiles bp ON b.baby_profile_id = bp.id " +
            "WHERE b.id = ? AND bp.user_id = ?",
            Integer.class, bookId, userId);
        return count != null && count > 0;
    }

    /** Return the user's Stripe customer id, creating and storing one on first purchase. */
    private String ensureCustomer(Long userId) throws Exception {
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT stripe_customer_id, email FROM users WHERE id = ?", userId);
        String customerId = (String) row.get("stripe_customer_id");
        if (customerId != null && !customerId.isBlank()) {
            return customerId;
        }
        Customer customer = Customer.create(CustomerCreateParams.builder()
            .setEmail((String) row.get("email"))
            .putMetadata("userId", String.valueOf(userId))
            .build());
        jdbc.update("UPDATE users SET stripe_customer_id = ? WHERE id = ?", customer.getId(), userId);
        return customer.getId();
    }

    private static String idempotencyKey(Long userId, Sku sku, Long bookId) {
        long window = Instant.now().getEpochSecond() / 60;   // ~60s dedupe window
        return "checkout_" + userId + "_" + sku.wireName() + "_" + (bookId == null ? "none" : bookId) + "_" + window;
    }

    /** The requested bookId is not owned by the caller. Mapped to 404 so we don't confirm it exists. */
    public static class BookNotAccessibleException extends RuntimeException {
        public BookNotAccessibleException(String message) {
            super(message);
        }
    }
}
