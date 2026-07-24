package com.gotcherapp.api.print;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * Print s14a-1 — Lulu's print-job status webhook. Public (under the {@code /print/**} permitAll block): Lulu
 * sends no JWT, so the HMAC signature verified in {@link LuluWebhookService} is the authentication.
 *
 * <p>The body MUST be taken as a raw String — the signature hashes the exact request bytes, so letting Spring
 * deserialize it to a DTO would re-serialize different bytes and fail verification. Same as
 * {@link com.gotcherapp.api.billing.BillingWebhookController}.
 *
 * <p>Registration is a one-time setup call per environment, not app code — see {@code Backend/lulu-webhooks.sh}.
 */
@RestController
public class LuluWebhookController {

    private static final Logger log = LoggerFactory.getLogger(LuluWebhookController.class);

    private final LuluWebhookService webhookService;

    public LuluWebhookController(LuluWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping(value = "/print/lulu-webhook", consumes = "application/json")
    public ResponseEntity<String> webhook(
        @RequestBody String payload,
        @RequestHeader(value = "Lulu-HMAC-SHA256", required = false) String signature
    ) {
        try {
            webhookService.handle(payload, signature);
            return ResponseEntity.ok("");
        } catch (LuluWebhookService.SignatureException e) {
            // The ONLY 4xx. A body that doesn't match its signature will never match on retry.
            log.warn("Lulu webhook signature verification failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body("Invalid signature");
        } catch (Exception e) {
            // Valid signature, processing blew up. Explicit 500 (caught here so it does NOT re-dispatch to
            // /error and surface as 401 — see CLAUDE.md) so Lulu retries; applying an update is idempotent.
            // ⚠ 5 CONSECUTIVE failures deactivate the webhook, so this branch must stay genuinely exceptional —
            // anything merely unrecognised is acknowledged with a 200 inside the service.
            log.error("Lulu webhook processing error: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body("");
        }
    }
}
