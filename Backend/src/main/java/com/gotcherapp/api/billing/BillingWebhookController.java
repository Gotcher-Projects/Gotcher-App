package com.gotcherapp.api.billing;

import com.stripe.exception.SignatureVerificationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * Payments P3 — the Stripe webhook. Public (permitAll in SecurityConfig): Stripe sends no JWT, so the
 * signature verification IS the authentication.
 *
 * The body MUST be taken as a raw String — signature verification hashes the exact request bytes, and
 * letting Spring deserialize to a DTO would re-serialize different bytes and fail verification silently.
 */
@RestController
public class BillingWebhookController {

    private static final Logger log = LoggerFactory.getLogger(BillingWebhookController.class);

    private final BillingWebhookService webhookService;

    public BillingWebhookController(BillingWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping(value = "/billing/webhook", consumes = "application/json")
    public ResponseEntity<String> webhook(
        @RequestBody String payload,
        @RequestHeader("Stripe-Signature") String sigHeader
    ) {
        try {
            webhookService.handle(payload, sigHeader);
            return ResponseEntity.ok("");
        } catch (SignatureVerificationException e) {
            // The ONLY case we return 4xx for. A bad signature will never verify on retry, so telling
            // Stripe "failed" here is correct and stops it from retrying a forgery for days.
            log.warn("Stripe webhook signature verification failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body("Invalid signature");
        } catch (Exception e) {
            // Valid signature, but processing failed. Return an explicit 500 (caught here so it does NOT
            // re-dispatch to /error and surface as 401 — see CLAUDE.md). Because grants are idempotent, a
            // Stripe retry is safe, so a transient failure is worth retrying rather than silently dropping
            // a paid event. Malformed price metadata does NOT reach here — it's handled as 0 and returns 200.
            log.error("Stripe webhook processing error: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body("");
        }
    }
}
