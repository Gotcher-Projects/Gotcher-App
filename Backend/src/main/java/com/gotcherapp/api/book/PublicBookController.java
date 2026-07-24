package com.gotcherapp.api.book;

import com.gotcherapp.api.book.dto.PublicBookResponse;
import com.gotcherapp.api.common.ApiError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Share s13b — the public, no-auth read of a shared book by its token.
 * `/book/public/**` is in SecurityConfig's permitAll list, so a logged-out visitor can reach it.
 */
@RestController
public class PublicBookController {

    private final PublicBookService publicBookService;

    public PublicBookController(PublicBookService publicBookService) {
        this.publicBookService = publicBookService;
    }

    @GetMapping("/book/public/{token}")
    public ResponseEntity<?> getPublicBook(@PathVariable String token) {
        try {
            PublicBookResponse book = publicBookService.getByToken(token);
            return ResponseEntity.ok(book);
        } catch (PublicBookService.NotFoundException e) {
            // 404 → the frontend renders "This link is no longer active."
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            // Catch Exception: an uncaught RuntimeException re-dispatches to /error and surfaces as 401 (CLAUDE.md).
            return ApiError.serverError(e.getMessage());
        }
    }
}
