package com.gotcherapp.api.print;

import com.stripe.Stripe;
import com.stripe.model.Customer;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Print pr7 (commit a) — the print checkout. A SELF-CONTAINED, variable-amount Stripe Checkout Session for a
 * printed book: it runs the whole pre-checkout flow itself (gate → recompute price server-side → render + persist
 * the interior/cover PDFs → insert a {@code pending} print_orders row → open the Stripe session) and returns the
 * hosted URL. It NEVER submits anything to Lulu and never fulfils — the signed webhook (commit b) advances the
 * order to {@code paid → submitted}, exactly as the digital SKUs grant only in {@link com.gotcherapp.api.billing}.
 *
 * <p>The distinct shape vs the fixed-price digital SKUs (credit packs / share unlock) is the <b>variable amount</b>:
 * inline {@code price_data} with {@code unit_amount} = the pr6 per-copy price and {@code quantity} = copies, so
 * {@code unit × qty} is the pr6 total and the receipt reads "N × $X". The amount is recomputed here from the
 * book's own page count — a client-sent amount is never trusted (the variable-amount analogue of the billing
 * IDOR check).
 */
@Service
public class PrintOrderService {

    /** v1 guardrail on a variable-amount charge — a sane upper bound on copies per order (grandparents buy a few). */
    static final int MAX_QUANTITY = 10;

    private final JdbcTemplate jdbc;
    private final PrintInteriorService printInteriorService;
    private final PrintPricingService pricingService;
    private final PrintRenderService renderService;
    private final String secretKey;
    private final String frontendUrl;
    private final boolean printEnabled;

    public PrintOrderService(
            JdbcTemplate jdbc,
            PrintInteriorService printInteriorService,
            PrintPricingService pricingService,
            PrintRenderService renderService,
            @Value("${stripe.secret.key}") String secretKey,
            @Value("${app.frontend-url}") String frontendUrl,
            @Value("${app.print.enabled:false}") boolean printEnabled) {
        this.jdbc = jdbc;
        this.printInteriorService = printInteriorService;
        this.pricingService = pricingService;
        this.renderService = renderService;
        this.secretKey = secretKey;
        this.frontendUrl = frontendUrl;
        this.printEnabled = printEnabled;
    }

    @PostConstruct
    void init() {
        // Same global process-wide key as BillingService (one Stripe account); setting it again is a harmless
        // no-op that removes any dependence on bean init order. Blank when billing isn't configured locally.
        Stripe.apiKey = secretKey;
    }

    /**
     * Open a print Checkout Session for {@code quantity} copies of {@code bookId}. Runs the full pre-checkout
     * flow and returns the Stripe-hosted URL.
     *
     * @throws LuluClient.PrintDisabledException           print is off (kill switch) — refused before any charge (→ 409)
     * @throws IllegalArgumentException                    quantity out of range (→ 400)
     * @throws PrintRenderService.BookNotAccessibleException the book isn't owned by the caller (→ 404)
     * @throws NotOrderableException                       the book fails the print gate (too few / too many pages) (→ 409)
     */
    public String createCheckout(Long userId, Long bookId, int quantity) throws Exception {
        // 0. Kill switch — refuse FIRST when print is off, so no customer is ever charged for a dormant feature.
        if (!printEnabled) {
            throw new LuluClient.PrintDisabledException(
                "Print is disabled (app.print.enabled=false) — refusing to open a print checkout.");
        }
        if (quantity < 1 || quantity > MAX_QUANTITY) {
            throw new IllegalArgumentException("quantity must be between 1 and " + MAX_QUANTITY);
        }

        // 1. Gate + recompute the amount SERVER-SIDE (never trust a client amount). orderability() also does the
        //    IDOR check (throws → 404 if the book isn't owned) and gives the filled page count that prices it.
        PrintInteriorService.Orderability gate = printInteriorService.orderability(userId, bookId);
        if (!gate.orderable()) {
            throw new NotOrderableException(gate);
        }
        PrintPricingService.Price price = pricingService.price(gate.pageCount(), quantity);

        // 2. Render + persist the interior + cover PDFs now (pr0.5 "pre-checkout render") behind their signed
        //    token URLs. The webhook (commit b) never renders — it just hands these URLs to Lulu.
        PrintRenderService.RenderResult interior = renderService.renderInterior(userId, bookId);
        PrintRenderService.RenderResult cover = renderService.renderCover(userId, bookId);
        Instant pdfExpiresAt = interior.expiresAt().isBefore(cover.expiresAt())
            ? interior.expiresAt() : cover.expiresAt();

        // 3. Ensure a Stripe customer for the buyer (created lazily, stored on the user).
        String customerId = ensureCustomer(userId);

        // 4. Insert the pending order → its id is what the webhook routes on (metadata.printOrderId).
        long orderId = insertPendingOrder(userId, bookId, quantity, gate.pageCount(),
            price, interior.pdfUrl(), cover.pdfUrl(), pdfExpiresAt);

        // 5. Open the variable-amount Checkout Session. Stripe collects a US shipping address + a phone (Lulu
        //    requires a phone); the webhook reads both from session.shipping_details / customer_details.
        SessionCreateParams params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setCustomer(customerId)
            .setClientReferenceId(String.valueOf(userId))
            .addLineItem(SessionCreateParams.LineItem.builder()
                .setQuantity((long) price.quantity())
                .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                    .setCurrency("usd")
                    .setUnitAmount((long) price.unitPriceCents())   // per-copy; × quantity = pr6 total
                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                        .setName("CradleHQ Printed Memory Book")
                        .build())
                    .build())
                .build())
            .setShippingAddressCollection(SessionCreateParams.ShippingAddressCollection.builder()
                .addAllowedCountry(SessionCreateParams.ShippingAddressCollection.AllowedCountry.US)
                .build())
            .setPhoneNumberCollection(SessionCreateParams.PhoneNumberCollection.builder()
                .setEnabled(true)
                .build())
            .putMetadata("type", "print_order")                     // the webhook branch key (commit b)
            .putMetadata("printOrderId", String.valueOf(orderId))
            // pr9: book_id rides the return URL so the confirmation can look the order up on the OWNER-scoped
            // /books/{bookId}/print/order endpoint (/print/** is permitAll — see findOrderBySession).
            .setSuccessUrl(frontendUrl + "/?print=success&book_id=" + bookId + "&session_id={CHECKOUT_SESSION_ID}")
            .setCancelUrl(frontendUrl + "/?print=cancelled")
            .build();

        // One Session.create per orderId — key on it so a transport-level retry of THIS call can't double-create.
        RequestOptions options = RequestOptions.builder()
            .setIdempotencyKey("print_order_" + orderId)
            .build();

        Session session = Session.create(params, options);
        jdbc.update("UPDATE print_orders SET stripe_session_id = ?, updated_at = NOW() WHERE id = ?",
            session.getId(), orderId);
        return session.getUrl();
    }

    /**
     * Print pr9 — read one order back for the post-checkout confirmation, keyed by the Stripe session id the
     * success URL carries. Returns null when nothing matches (→ 404).
     *
     * <p><b>The {@code user_id} in the WHERE clause IS the IDOR boundary</b> (same stance as
     * {@link PrintInteriorService}'s requireOwnedBook): a session id is a bearer-ish string that appears in a URL,
     * so another user's session must miss, not leak a shipping address. {@code book_id} is matched too — it comes
     * from the same success URL, so a mismatch means a tampered/stale link and should also miss. This is exactly
     * why the endpoint lives under {@code /books/**} (authenticated) and not {@code /print/**} (permitAll).
     */
    public OrderSummary findOrderBySession(Long userId, Long bookId, String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return null;
        }
        var rows = jdbc.queryForList(
            ORDER_SELECT + "WHERE po.stripe_session_id = ? AND po.user_id = ? AND po.book_id = ?",
            sessionId, userId, bookId);
        return rows.isEmpty() ? null : mapOrder(rows.get(0));
    }

    /**
     * Print s14c — every order this user has placed, newest first. The {@code user_id} scope is the IDOR
     * boundary, exactly as above.
     *
     * <p><b>{@code pending} orders are excluded on purpose.</b> A row is created {@code pending} when the
     * Checkout Session opens, so an abandoned checkout leaves one behind forever. The customer never paid and
     * has no order — showing it would be alarming and wrong.
     */
    public List<OrderSummary> listOrders(Long userId) {
        return jdbc.queryForList(
                ORDER_SELECT + "WHERE po.user_id = ? AND po.status <> 'pending' ORDER BY po.id DESC", userId)
            .stream().map(PrintOrderService::mapOrder).toList();
    }

    // One projection for both reads, so the confirmation and the list can never disagree about an order.
    // Note what is NOT here: no street address, no PDF token urls, no Stripe/Lulu ids, and deliberately no
    // lulu_status or failure_reason — see the record's doc.
    private static final String ORDER_SELECT =
        "SELECT po.id, po.status, po.quantity, po.page_count, po.amount_cents, po.currency, " +
        "       po.ship_name, po.ship_city, po.ship_state_code, po.created_at, b.title AS book_title, " +
        "       po.tracking_urls, po.carrier_name, po.shipped_at, (po.refunded_at IS NOT NULL) AS refunded " +
        "FROM print_orders po LEFT JOIN books b ON b.id = po.book_id ";

    private static OrderSummary mapOrder(Map<String, Object> r) {
        return new OrderSummary(
            ((Number) r.get("id")).longValue(),
            (String) r.get("status"),
            ((Number) r.get("quantity")).intValue(),
            ((Number) r.get("page_count")).intValue(),
            ((Number) r.get("amount_cents")).intValue(),
            (String) r.get("currency"),
            (String) r.get("ship_name"),
            (String) r.get("ship_city"),
            (String) r.get("ship_state_code"),
            (String) r.get("book_title"),
            timestamp(r.get("created_at")),
            firstTrackingUrl((String) r.get("tracking_urls")),
            (String) r.get("carrier_name"),
            timestamp(r.get("shipped_at")),
            Boolean.TRUE.equals(r.get("refunded")));
    }

    private static String timestamp(Object value) {
        return value instanceof java.sql.Timestamp ts ? ts.toInstant().toString() : null;
    }

    /** {@code tracking_urls} is stored newline-separated; the UI only ever offers one "Track package" link. */
    private static String firstTrackingUrl(String trackingUrls) {
        if (trackingUrls == null || trackingUrls.isBlank()) {
            return null;
        }
        return trackingUrls.split("\\R", 2)[0].trim();
    }

    /**
     * What the customer is allowed to see about an order — used by both the pr9 confirmation and the s14c list.
     * Deliberately NARROW: the street address, PDF token URLs, Stripe/Lulu ids and the event id all stay
     * server-side; city/state is enough to prove "we're shipping to the right place".
     *
     * <p><b>Two fields s14c's plan listed are deliberately absent.</b> {@code luluStatus} is our vendor's
     * vocabulary ({@code IN_PRODUCTION}) and {@code failureReason} is raw operator text ("Upload Error: We
     * detected an error in your PDF…") — the plan says never to render either at a parent, and the surest way
     * to never render something is to never send it. Support reads both from the DB and from the alert email.
     *
     * <p>{@code refunded} is derived from {@code refunded_at}, which s14a-2 <b>clears</b> when a refund later
     * fails — so a failed refund correctly stops reading as refunded.
     */
    public record OrderSummary(
        long orderId, String status, int quantity, int pageCount, int amountCents, String currency,
        String shipName, String shipCity, String shipStateCode, String bookTitle, String createdAt,
        String trackingUrl, String carrierName, String shippedAt, boolean refunded) {}

    /** Return the user's Stripe customer id, creating + storing one on first purchase (mirrors BillingService). */
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

    /** Insert the {@code pending} order and return its generated id. */
    private long insertPendingOrder(Long userId, Long bookId, int quantity, int pageCount,
                                    PrintPricingService.Price price, String interiorUrl, String coverUrl,
                                    Instant pdfExpiresAt) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(con -> {
            // Ask Postgres for ONLY the id back — otherwise it returns every column and getKey() ambiguates.
            PreparedStatement ps = con.prepareStatement(
                "INSERT INTO print_orders " +
                "(user_id, book_id, quantity, page_count, unit_price_cents, amount_cents, currency, status, " +
                " interior_pdf_url, cover_pdf_url, pdf_expires_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
                new String[]{"id"});
            ps.setLong(1, userId);
            ps.setLong(2, bookId);
            ps.setInt(3, quantity);
            ps.setInt(4, pageCount);
            ps.setInt(5, price.unitPriceCents());
            ps.setInt(6, price.totalCents());
            ps.setString(7, price.currency());
            ps.setString(8, interiorUrl);
            ps.setString(9, coverUrl);
            ps.setTimestamp(10, Timestamp.from(pdfExpiresAt));
            return ps;
        }, keyHolder);
        Number id = keyHolder.getKey();   // single "id" column requested above, so getKey() is unambiguous
        if (id == null) {
            throw new IllegalStateException("print_orders insert returned no generated id");
        }
        return id.longValue();
    }

    /** A book that fails the print gate (too few / too many filled pages) — never opens a checkout. Mapped to 409. */
    public static class NotOrderableException extends RuntimeException {
        private final transient PrintInteriorService.Orderability gate;
        public NotOrderableException(PrintInteriorService.Orderability gate) {
            super("Book is not orderable: " + gate.pageCount() + " filled pages (need "
                + gate.min() + "–" + gate.max() + "); reason=" + gate.reason());
            this.gate = gate;
        }
        public PrintInteriorService.Orderability gate() { return gate; }
    }
}
