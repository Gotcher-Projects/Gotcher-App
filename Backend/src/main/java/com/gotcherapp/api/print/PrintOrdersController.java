package com.gotcherapp.api.print;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Print s14c — "your print orders". The customer's own read-only view of every order they've paid for.
 *
 * <p><b>Why this is a top-level path and not {@code /print/orders}:</b> {@code /print/**} is in SecurityConfig's
 * {@code permitAll} list (the token-authorized PDF routes live there), so anything under it is unauthenticated.
 * pr9 hit this exact trap. {@code /print-orders} falls through to {@code anyRequest().authenticated()} and is
 * protected by default — the safer side of the line to be on when the payload includes a shipping name.
 *
 * <p>Owner scoping happens in {@link PrintOrderService#listOrders} via {@code WHERE user_id = ?}; there is no
 * path parameter here to tamper with at all.
 */
@RestController
public class PrintOrdersController {

    private final PrintOrderService printOrderService;

    public PrintOrdersController(PrintOrderService printOrderService) {
        this.printOrderService = printOrderService;
    }

    /** The caller's paid orders, newest first. Abandoned (never-paid) checkouts are filtered out server-side. */
    @GetMapping("/print-orders")
    public ResponseEntity<?> list(@AuthenticationPrincipal AuthPrincipal principal) {
        try {
            return ResponseEntity.ok(printOrderService.listOrders(principal.userId()));
        } catch (Exception e) {
            // Catch Exception: an uncaught RuntimeException re-dispatches to /error and surfaces as 401 (CLAUDE.md).
            return ApiError.serverError(e.getMessage());
        }
    }
}
