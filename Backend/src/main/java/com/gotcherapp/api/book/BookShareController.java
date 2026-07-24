package com.gotcherapp.api.book;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Share s13a — manage a book's revocable share token. JWT-protected (/books/** is not in
 * SecurityConfig's permitAll list). The public read of a token comes in s13b (GET /book/public/{token}).
 */
@RestController
@RequestMapping("/books/{bookId}/share")
public class BookShareController {

    private final BookShareService shareService;

    public BookShareController(BookShareService shareService) {
        this.shareService = shareService;
    }

    /** Mint or regenerate the token. 402 if the book hasn't been unlocked; 404 if not owned. */
    @PostMapping
    public ResponseEntity<?> mint(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId
    ) {
        try {
            return ResponseEntity.ok(shareService.mint(principal.userId(), bookId));
        } catch (BookShareService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (BookShareService.BookNotUnlockedException e) {
            return ApiError.paymentRequired(e.getMessage());
        } catch (Exception e) {
            // Catch Exception: an uncaught RuntimeException re-dispatches to /error and surfaces as 401 (CLAUDE.md).
            return ApiError.serverError(e.getMessage());
        }
    }

    /** The current token, or { token: null, shareUrl: null } if none. 404 if not owned. */
    @GetMapping
    public ResponseEntity<?> get(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId
    ) {
        try {
            return ResponseEntity.ok(shareService.get(principal.userId(), bookId));
        } catch (BookShareService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    /** Revoke the token. Idempotent — 204 even if none existed. 404 if not owned. */
    @DeleteMapping
    public ResponseEntity<?> revoke(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long bookId
    ) {
        try {
            shareService.revoke(principal.userId(), bookId);
            return ResponseEntity.noContent().build();
        } catch (BookShareService.BookNotAccessibleException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }
}
