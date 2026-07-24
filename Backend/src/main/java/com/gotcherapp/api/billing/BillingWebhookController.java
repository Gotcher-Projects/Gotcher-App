package com.gotcherapp.api.billing;

import com.stripe.exception.SignatureVerificationException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Payments P3 — the Stripe webhook. Public (permitAll in SecurityConfig): Stripe sends no JWT, so the
 * signature verification IS the authentication.
 *
 * The body MUST be read as raw bytes off the servlet input stream and decoded UTF-8 ourselves — NOT via
 * {@code @RequestBody String}. Spring's StringHttpMessageConverter decodes with the request's negotiated
 * (or default ISO-8859-1) charset; behind Caddy the real Stripe request tripped that converter with
 * "Invalid encoding: ISO-8859-1", which — thrown during argument resolution, outside the try/catch below —
 * re-dispatched to /error and surfaced as a 401 (the Spring 401 trap, see CLAUDE.md), so Stripe retried
 * forever and no event was ever processed. Reading the raw stream sidesteps charset negotiation entirely and
 * hands constructEvent Stripe's exact signed bytes.
 */
@RestController
public class BillingWebhookController {

    private static final Logger log = LoggerFactory.getLogger(BillingWebhookController.class);

    private final BillingWebhookService webhookService;

    public BillingWebhookController(BillingWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping(value = "/billing/webhook")
    public ResponseEntity<String> webhook(
        HttpServletRequest request,
        @RequestHeader("Stripe-Signature") String sigHeader
    ) {
        String payload;
        try {
            payload = new String(request.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            // Could not read the body at all — a transient read error. Let Stripe retry.
            log.error("Stripe webhook: failed to read request body: {}", e.getMessage());
            return ResponseEntity.status(500).body("");
        }
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
