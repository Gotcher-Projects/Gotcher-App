package com.gotcherapp.api.print;

import com.gotcherapp.api.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * Print pr3 — orchestrates one interior render: owner check → mint render token → drive the sidecar over the
 * pr2 print route → persist the PDF → return the Lulu-facing fetch URL.
 *
 * <p>Invoked by the owner-triggered endpoint now; pr7/pr8 call it at order placement (the pr0.5 "pre-checkout
 * render" decision). pr4 added the sibling {@link #renderCover} over the same sidecar + token machinery.
 */
@Service
public class PrintRenderService {

    private static final String READY_SELECTOR = "[data-print-ready=\"true\"]";

    private final JdbcTemplate jdbc;
    private final JwtUtil jwtUtil;
    private final PrintSidecarClient sidecar;
    private final PrintPdfStore store;
    private final String frontendBase;
    private final String backendBase;
    private final int renderTimeoutMs;
    private final int ttlHours;

    public PrintRenderService(
            JdbcTemplate jdbc,
            JwtUtil jwtUtil,
            PrintSidecarClient sidecar,
            PrintPdfStore store,
            @Value("${app.print.frontend-base}") String frontendBase,
            @Value("${app.backend-url}") String backendBase,
            @Value("${app.print.render-timeout-ms:120000}") int renderTimeoutMs,
            @Value("${app.print.pdf-ttl-hours:24}") int ttlHours) {
        this.jdbc = jdbc;
        this.jwtUtil = jwtUtil;
        this.sidecar = sidecar;
        this.store = store;
        this.frontendBase = frontendBase.replaceAll("/+$", "");
        this.backendBase = backendBase.replaceAll("/+$", "");
        this.renderTimeoutMs = renderTimeoutMs;
        this.ttlHours = ttlHours;
    }

    public record RenderResult(String pdfUrl, Instant expiresAt) {}

    /** Render the book's interior to a persisted PDF. Only the owner may render (IDOR check). */
    public RenderResult renderInterior(Long userId, Long bookId) {
        return render(userId, bookId, "interior", "/print/book/");
    }

    /**
     * Render the book's COVER (a separate wrap PDF — back|spine|front) to a persisted PDF (pr4). Lulu wants the
     * cover as its own file; spine width is derived from the interior page count inside the cover route itself,
     * so this drives the same sidecar over the cover route and needs no extra inputs.
     */
    public RenderResult renderCover(Long userId, Long bookId) {
        return render(userId, bookId, "cover", "/print/cover/");
    }

    /** Shared render: owner check → mint render token → drive the sidecar over {routePrefix}{token} → persist. */
    private RenderResult render(Long userId, Long bookId, String kind, String routePrefix) {
        requireOwnedBook(userId, bookId);

        String renderToken = jwtUtil.generatePrintRenderToken(bookId);
        String url = frontendBase + routePrefix + renderToken;

        byte[] pdf = sidecar.render(url, READY_SELECTOR, renderTimeoutMs);

        PrintPdfStore.Stored stored =
            store.save(bookId, kind, pdf, "application/pdf", Duration.ofHours(ttlHours));

        String pdfUrl = backendBase + "/print/pdf/" + stored.token();
        return new RenderResult(pdfUrl, stored.expiresAt());
    }

    /**
     * IDOR boundary: books has no user_id — ownership is books.baby_profile_id -> baby_profiles.user_id.
     * Mirrors BookShareService / BillingService. Throws (→ 404) rather than confirming the book exists.
     */
    private void requireOwnedBook(Long userId, Long bookId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM books b JOIN baby_profiles bp ON b.baby_profile_id = bp.id " +
            "WHERE b.id = ? AND bp.user_id = ?",
            Integer.class, bookId, userId);
        if (count == null || count == 0) {
            throw new BookNotAccessibleException("Book not found");
        }
    }

    /** The book is not owned by the caller. Mapped to 404 so we don't confirm it exists. */
    public static class BookNotAccessibleException extends RuntimeException {
        public BookNotAccessibleException(String message) {
            super(message);
        }
    }
}
