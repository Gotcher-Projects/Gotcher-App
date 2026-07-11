package com.gotcherapp.api.billing;

import com.gotcherapp.api.billing.dto.CheckoutRequest;
import com.gotcherapp.api.billing.dto.CheckoutResponse;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Payments P2 — checkout. JWT-protected by SecurityConfig's anyRequest().authenticated()
 * (/billing/checkout is not in the permitAll list). The public /billing/webhook comes in P3.
 */
@RestController
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @PostMapping("/billing/checkout")
    public ResponseEntity<?> checkout(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody CheckoutRequest req
    ) {
        try {
            String url = billingService.createCheckout(principal.userId(), req);
            return ResponseEntity.ok(new CheckoutResponse(url));
        } catch (BillingService.BookNotAccessibleException e) {
            // 404, not 403 — don't confirm to a stranger that the book id exists.
            return ApiError.notFound(e.getMessage());
        } catch (IllegalArgumentException e) {
            // Unknown sku, or a bookId that's required-but-missing / present-but-not-allowed.
            return ApiError.badRequest(e.getMessage());
        } catch (Exception e) {
            // Catch Exception (not just StripeException): an uncaught RuntimeException here would
            // re-dispatch to /error unauthenticated and surface as 401 instead of 500 (see CLAUDE.md).
            return ApiError.serverError(e.getMessage());
        }
    }
}
