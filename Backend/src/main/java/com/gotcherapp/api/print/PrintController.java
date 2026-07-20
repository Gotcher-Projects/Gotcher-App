package com.gotcherapp.api.print;

import com.gotcherapp.api.billing.dto.CheckoutResponse;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Print pr3 — the owner-triggered render. Under {@code /books/**} (NOT {@code /print/**}), so it is
 * JWT-protected: the token endpoints (payload/pdf) are permitAll and authorize by their own token, but
 * triggering a render must prove ownership. pr7/pr8 call this at order placement (pre-checkout render).
 */
@RestController
@RequestMapping("/books/{bookId}/print")
public class PrintController {

    private final PrintRenderService renderService;
    private final PrintInteriorService printInteriorService;
    private final PrintPricingService pricingService;
    private final PrintOrderService printOrderService;

    public PrintController(PrintRenderService renderService,
                           PrintInteriorService printInteriorService, PrintPricingService pricingService,
                           PrintOrderService printOrderService) {
        this.renderService = renderService;
        this.printInteriorService = printInteriorService;
        this.pricingService = pricingService;
        this.printOrderService = printOrderService;
    }

    /**
     * The print gate (pr5.5, D2) — filled interior page count + whether the book can be ordered. The single
     * source of truth pr6 (price) and pr8 (order UI) both consume. 404 if not owned. Owner-scoped, not a
     * throwaway: this endpoint survives pr7 (unlike the lulu-test triggers below).
     */
    @GetMapping("/orderability")
    public ResponseEntity<?> orderability(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId
    ) {
        try {
            return ResponseEntity.ok(printInteriorService.orderability(principal.userId(), bookId));
        } catch (PrintRenderService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    /**
     * Print pr6 — the retail price for {@code quantity} copies of a book. The amount pr7's Stripe checkout
     * charges: a flat, all-in (incl. MAIL shipping) price by filled interior page count (see
     * {@link PrintPricingService}). Gated on {@link PrintInteriorService} — an un-orderable book (too few / too
     * many pages) returns 409 with its gate, never a price. 404 if not owned. Owner-scoped; survives pr7.
     */
    @GetMapping("/price")
    public ResponseEntity<?> price(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId,
        @RequestParam(name = "quantity", defaultValue = "1") int quantity
    ) {
        try {
            PrintInteriorService.Orderability gate = printInteriorService.orderability(principal.userId(), bookId);
            if (!gate.orderable()) {
                return ApiError.conflict("Book is not orderable (" + gate.pageCount() + " pages, need "
                    + gate.min() + "–" + gate.max() + "); reason=" + gate.reason());
            }
            PrintPricingService.Price p = pricingService.price(gate.pageCount(), quantity);
            return ResponseEntity.ok(Map.of(
                "pageCount", gate.pageCount(),
                "bookType", gate.bookType(),
                "unitPriceCents", p.unitPriceCents(),
                "quantity", p.quantity(),
                "totalCents", p.totalCents(),
                "currency", p.currency()));
        } catch (PrintRenderService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    /**
     * Print pr7 (commit a) — open a variable-amount Stripe Checkout Session for {@code quantity} copies of this
     * book. Self-contained: gates on the kill switch, re-checks orderability + recomputes the amount server-side
     * (never trusts a client), renders + persists the PDFs, inserts a {@code pending} print_orders row, and opens
     * the session. Returns the hosted URL. The webhook (commit b) fulfils on payment. 404 if not owned; 409 if
     * print is off or the book isn't orderable; 400 on a bad quantity. Owner-scoped (JWT under /books/**).
     */
    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId,
        @RequestParam(name = "quantity", defaultValue = "1") int quantity
    ) {
        try {
            String url = printOrderService.createCheckout(principal.userId(), bookId, quantity);
            return ResponseEntity.ok(new CheckoutResponse(url));
        } catch (PrintRenderService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (LuluClient.PrintDisabledException e) {
            // Kill switch — feature intentionally off. 409, never a charge.
            return ApiError.conflict(e.getMessage());
        } catch (PrintOrderService.NotOrderableException e) {
            // Gate failed (too few / too many filled pages) — 409, no session opened.
            return ApiError.conflict(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        } catch (Exception e) {
            // Catch Exception: an uncaught RuntimeException re-dispatches to /error and surfaces as 401 (CLAUDE.md).
            return ApiError.serverError(e.getMessage());
        }
    }

    /** Render the book interior → { pdfUrl, expiresAt }. 404 if not owned. */
    @PostMapping("/interior")
    public ResponseEntity<?> renderInterior(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId
    ) {
        try {
            PrintRenderService.RenderResult r = renderService.renderInterior(principal.userId(), bookId);
            return ResponseEntity.ok(Map.of("pdfUrl", r.pdfUrl(), "expiresAt", r.expiresAt().toString()));
        } catch (PrintRenderService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            // Catch Exception: an uncaught RuntimeException re-dispatches to /error and surfaces as 401 (CLAUDE.md).
            return ApiError.serverError(e.getMessage());
        }
    }

    /** Render the book cover (separate wrap PDF, pr4) → { pdfUrl, expiresAt }. 404 if not owned. */
    @PostMapping("/cover")
    public ResponseEntity<?> renderCover(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId
    ) {
        try {
            PrintRenderService.RenderResult r = renderService.renderCover(principal.userId(), bookId);
            return ResponseEntity.ok(Map.of("pdfUrl", r.pdfUrl(), "expiresAt", r.expiresAt().toString()));
        } catch (PrintRenderService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            // Catch Exception: an uncaught RuntimeException re-dispatches to /error and surfaces as 401 (CLAUDE.md).
            return ApiError.serverError(e.getMessage());
        }
    }
}
