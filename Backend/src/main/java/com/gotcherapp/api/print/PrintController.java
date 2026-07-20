package com.gotcherapp.api.print;

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
    private final LuluPrintService luluPrintService;
    private final PrintInteriorService printInteriorService;
    private final PrintPricingService pricingService;

    public PrintController(PrintRenderService renderService, LuluPrintService luluPrintService,
                           PrintInteriorService printInteriorService, PrintPricingService pricingService) {
        this.renderService = renderService;
        this.luluPrintService = luluPrintService;
        this.printInteriorService = printInteriorService;
        this.pricingService = pricingService;
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

    // ── THROWAWAY dev triggers (pr5) — pr7 DELETES both and moves the submit into the Stripe webhook ──────────
    // These exercise the Lulu client against the sandbox: render interior+cover, cross-check the cover, submit a
    // PAID job with a canned US address + qty 1. Owner-guarded (book IDOR check in the render service) + behind
    // the app.print.enabled kill switch (submit hard-refuses when off). NOT a real order — no print_orders,
    // customer, address form, or checkout (that's pr7). Requires Lulu to reach the persisted PDF URLs: in dev set
    // BACKEND_URL=<tunnel> so /print/pdf/{token} is publicly fetchable.

    /** Render + cross-check + submit a paid SANDBOX Lulu job → { jobId, status, urls, coverCheck, lineItems }. */
    @PostMapping("/lulu-test")
    public ResponseEntity<?> luluTest(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId
    ) {
        try {
            LuluPrintService.LuluTestResult r = luluPrintService.submitTestJob(principal.userId(), bookId);
            return ResponseEntity.ok(Map.of(
                "jobId", r.jobId(),
                "status", r.status() == null ? "" : r.status(),
                "interiorUrl", r.interiorUrl(),
                "coverUrl", r.coverUrl(),
                "coverCheck", r.coverCheck(),
                "lineItems", r.lineItems()));
        } catch (PrintRenderService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (LuluPrintService.NotOrderableException e) {
            // Gate failed (too few / too many filled pages) — 409, never reaches Lulu.
            return ApiError.conflict(e.getMessage());
        } catch (LuluClient.PrintDisabledException e) {
            // Kill switch tripped — handled 409 (feature intentionally off), never a 500.
            return ApiError.conflict(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    /** Poll a submitted job's async status (Lulu fetches the PDFs after the POST) → { jobId, status, lineItems }. */
    @GetMapping("/lulu-test/{jobId}")
    public ResponseEntity<?> luluTestStatus(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId,
        @PathVariable long jobId
    ) {
        try {
            LuluClient.PrintJob job = luluPrintService.getJobStatus(jobId);
            return ResponseEntity.ok(Map.of(
                "jobId", job.id(),
                "status", job.status() == null ? "" : job.status(),
                "externalId", job.externalId() == null ? "" : job.externalId(),
                "lineItems", job.lineItems()));
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }
}
