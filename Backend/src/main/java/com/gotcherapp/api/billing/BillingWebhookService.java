package com.gotcherapp.api.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Charge;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.LineItem;
import com.stripe.model.Refund;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionRetrieveParams;
import com.gotcherapp.api.print.PrintOrderFulfilmentService;
import com.gotcherapp.api.print.PrintRefundService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Payments P3 — verifies and processes Stripe webhooks. Fulfilment happens HERE (the signed webhook),
 * never on the browser's return to the success page, which anyone can visit.
 *
 * The Stripe API call that reads the credit count lives in this service (outside the DB transaction);
 * the atomic ledger-insert + grant lives in GrantService (@Transactional). See P3 plan for the design.
 */
@Service
public class BillingWebhookService {

    private static final Logger log = LoggerFactory.getLogger(BillingWebhookService.class);

    private final GrantService grantService;
    private final PrintOrderFulfilmentService printOrderFulfilmentService;
    private final PrintRefundService printRefundService;
    private final String webhookSecret;

    public BillingWebhookService(
        GrantService grantService,
        PrintOrderFulfilmentService printOrderFulfilmentService,
        PrintRefundService printRefundService,
        @Value("${stripe.webhook.secret}") String webhookSecret
    ) {
        this.grantService = grantService;
        this.printOrderFulfilmentService = printOrderFulfilmentService;
        this.printRefundService = printRefundService;
        this.webhookSecret = webhookSecret;
    }

    /**
     * Verify the signature over the RAW body, then fulfil a checkout.session.completed event.
     *
     * @throws SignatureVerificationException bad/absent signature — the controller maps this (and ONLY
     *                                        this) to a 4xx. It won't get better on retry.
     * @throws WebhookProcessingException     a valid event that we failed to process — the controller
     *                                        returns 500 so Stripe retries (the grant is idempotent).
     */
    public void handle(String payload, String sigHeader) throws SignatureVerificationException {
        Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);

        // Log every verified event on arrival, so "did Stripe reach us and what did we do with it" is always
        // answerable from the logs (a misconfigured endpoint URL shows up as simply no line here).
        log.info("Stripe webhook received: id={} type={} livemode={}", event.getId(), event.getType(), event.getLivemode());

        // We never create subscriptions/invoices, so Stripe won't send them — but acknowledge every type we
        // don't handle with a 200 rather than erroring on something we simply didn't subscribe to.
        String type = event.getType();
        if (!"checkout.session.completed".equals(type)
            && !"charge.refunded".equals(type)
            && !"refund.created".equals(type)
            && !"refund.failed".equals(type)) {
            log.debug("Ignoring Stripe event type {} ({})", type, event.getId());
            return;
        }

        try {
            StripeObject obj = readObject(event);
            switch (type) {
                case "checkout.session.completed" -> fulfil(event.getId(), ((Session) obj).getId());
                // s14a-2: a refund Michael issued by hand in the dashboard. We only RECORD it — nothing in the
                // app ever calls Refund.create (decision D2). Non-print refunds are filtered out downstream.
                case "charge.refunded" -> printRefundService.recordRefund(event.getId(), (Charge) obj);
                // The only event that reliably carries the refund id — charge.refunded's `refunds` list is not
                // expanded on the webhook payload. Records the id and nothing else, so ordering doesn't matter.
                case "refund.created" -> printRefundService.recordRefundId((Refund) obj);
                // The money did NOT reach the customer, and we've already promised it. Straight to a human.
                case "refund.failed" -> printRefundService.refundFailed((Refund) obj);
                default -> log.debug("Unhandled Stripe event type {} ({})", type, event.getId());
            }
        } catch (Exception e) {
            log.error("Failed to process Stripe event {}: {}", event.getId(), e.getMessage(), e);
            throw new WebhookProcessingException(e);
        }
    }

    /**
     * getObject() can be empty when the account's API version differs from the library's; fall back to
     * deserializeUnsafe so a version skew doesn't drop a paid event.
     */
    private StripeObject readObject(Event event) throws Exception {
        EventDataObjectDeserializer d = event.getDataObjectDeserializer();
        return d.getObject().isPresent() ? d.getObject().get() : d.deserializeUnsafe();
    }

    private void fulfil(String eventId, String sessionId) throws Exception {
        // Re-retrieve the session fresh (with the line item's price expanded) so we read the buyer,
        // metadata, and credit count from a complete object regardless of what the event embedded.
        Session session = Session.retrieve(
            sessionId,
            SessionRetrieveParams.builder().addExpand("line_items.data.price").build(),
            null);

        // Route by metadata.type. Print orders (pr7) are fulfilled by submitting a Lulu job, not a credit grant;
        // everything without this marker is a digital SKU and falls through to the original grant path below.
        if ("print_order".equals(session.getMetadata().get("type"))) {
            printOrderFulfilmentService.fulfil(eventId, session);
            return;
        }

        long userId = Long.parseLong(session.getClientReferenceId());
        String sku = session.getMetadata().get("sku");
        String bookIdRaw = session.getMetadata().get("bookId");
        Long bookId = (bookIdRaw == null || bookIdRaw.isBlank()) ? null : Long.parseLong(bookIdRaw);

        int credits = readCredits(session);

        boolean applied = grantService.apply(eventId, userId, sku, credits, bookId);
        if (applied) {
            log.info("Fulfilled event {} for user {}: sku={}, credits={}, book={}",
                eventId, userId, sku, credits, bookId);
        } else {
            log.info("Event {} already applied (redelivery) — no second grant", eventId);
        }
    }

    /**
     * The credit count is read from the Stripe PRICE metadata — the single source of truth set in the
     * dashboard — not a Java map that would drift the day someone edits a price. Missing or non-numeric
     * metadata is a misconfiguration we can't invent a number for: log loudly and treat as 0. The event
     * is still recorded (no retry storm) and a valid book unlock still applies.
     */
    private int readCredits(Session session) {
        if (session.getLineItems() == null || session.getLineItems().getData().isEmpty()) {
            log.error("Session {} returned no line items; granting 0 credits", session.getId());
            return 0;
        }
        LineItem item = session.getLineItems().getData().get(0);
        String raw = (item.getPrice() == null) ? null : item.getPrice().getMetadata().get("credits");
        try {
            return (raw == null) ? 0 : Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            log.error("Price {} has non-numeric credits metadata '{}'; granting 0 credits",
                (item.getPrice() == null ? "?" : item.getPrice().getId()), raw);
            return 0;
        }
    }

    /** A validly-signed event we failed to process. Mapped to 500 so Stripe retries (grant is idempotent). */
    public static class WebhookProcessingException extends RuntimeException {
        public WebhookProcessingException(Throwable cause) {
            super(cause);
        }
    }
}
