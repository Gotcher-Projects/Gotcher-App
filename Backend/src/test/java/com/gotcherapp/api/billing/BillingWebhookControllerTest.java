package com.gotcherapp.api.billing;

import com.stripe.exception.SignatureVerificationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Payments P4 — the webhook's HTTP contract with Stripe. Only three outcomes matter, and getting the
 * status codes wrong is expensive: a bad signature must be 4xx (a forgery won't verify on retry, so
 * telling Stripe "no" stops the retries), while a transient processing failure must be 5xx so Stripe
 * DOES retry a genuinely-paid event. The service is mocked; this is purely the mapping.
 */
@ExtendWith(MockitoExtension.class)
class BillingWebhookControllerTest {

    @Mock BillingWebhookService webhookService;
    @InjectMocks BillingWebhookController controller;

    @Test
    void validEvent_returns200() throws Exception {
        ResponseEntity<String> result = controller.webhook("body", "sig");

        assertEquals(200, result.getStatusCode().value());
        verify(webhookService).handle("body", "sig");
    }

    @Test
    void badSignature_returns400() throws Exception {
        doThrow(new SignatureVerificationException("bad", "sig"))
            .when(webhookService).handle(any(), any());

        ResponseEntity<String> result = controller.webhook("body", "badsig");

        assertEquals(400, result.getStatusCode().value());
    }

    @Test
    void processingFailure_returns500_soStripeRetries() throws Exception {
        doThrow(new BillingWebhookService.WebhookProcessingException(new RuntimeException("db down")))
            .when(webhookService).handle(any(), any());

        ResponseEntity<String> result = controller.webhook("body", "sig");

        assertEquals(500, result.getStatusCode().value());
    }
}
