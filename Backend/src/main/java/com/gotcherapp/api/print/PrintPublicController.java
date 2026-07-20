package com.gotcherapp.api.print;

import com.gotcherapp.api.book.PublicBookService;
import com.gotcherapp.api.book.dto.PublicBookResponse;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.JwtUtil;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * Print pr3 — the two UNAUTHENTICATED, token-authorized print endpoints (under {@code /print/**}, permitAll):
 *
 * <ul>
 *   <li>{@code GET /print/payload/{token}} — a render token (short-lived JWT) authorizes the content-FILTERED
 *       book payload the print route renders (pr5.5: filled pages only, so guided books don't print blank
 *       template pages). Consumed by the headless-Chrome sidecar, which has no session.</li>
 *   <li>{@code GET /print/pdf/{token}} — an opaque token serves the persisted PDF. This is the URL Lulu
 *       fetches server-side (pr5).</li>
 * </ul>
 *
 * Replaces pr2's throwaway {@code PrintDevController}.
 */
@RestController
public class PrintPublicController {

    private final JwtUtil jwtUtil;
    private final PublicBookService publicBookService;
    private final PrintPdfStore pdfStore;

    public PrintPublicController(JwtUtil jwtUtil, PublicBookService publicBookService, PrintPdfStore pdfStore) {
        this.jwtUtil = jwtUtil;
        this.publicBookService = publicBookService;
        this.pdfStore = pdfStore;
    }

    @GetMapping("/print/payload/{token}")
    public ResponseEntity<?> payload(@PathVariable String token) {
        Long bookId;
        try {
            bookId = jwtUtil.getPrintRenderBookId(token);
        } catch (Exception e) {
            // Any invalid/expired/wrong-purpose token → 404, don't reveal which part failed.
            return ApiError.notFound("Invalid or expired token");
        }
        try {
            PublicBookResponse payload = publicBookService.getByBookIdFiltered(bookId);
            return ResponseEntity.ok(payload);
        } catch (PublicBookService.NotFoundException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    @GetMapping("/print/pdf/{token}")
    public ResponseEntity<?> pdf(@PathVariable String token) {
        Optional<PrintPdfStore.Pdf> found = pdfStore.fetch(token);
        if (found.isEmpty()) {
            return ApiError.notFound("Not found");
        }
        PrintPdfStore.Pdf p = found.get();
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(p.contentType()))
            .body(p.bytes());
    }
}
