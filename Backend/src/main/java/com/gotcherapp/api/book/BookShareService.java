package com.gotcherapp.api.book;

import com.gotcherapp.api.book.dto.ShareResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

/**
 * Share s13a — the revocable share TOKEN and its management (mint / read / revoke).
 *
 * <p>The token is the secret in the public URL ({@code /book/{token}}). It is NOT the entitlement:
 * "this book is paid for" lives in {@code books.share_unlocked_at} (set by the Payments webhook, P3)
 * and this class never writes it. Regenerating a link replaces the token row and leaves the unlock
 * untouched, so a new link never re-charges.
 */
@Service
public class BookShareService {

    private final JdbcTemplate jdbc;
    private final String frontendUrl;
    private final SecureRandom random = new SecureRandom();

    public BookShareService(JdbcTemplate jdbc, @Value("${app.frontend-url}") String frontendUrl) {
        this.jdbc = jdbc;
        this.frontendUrl = frontendUrl;
    }

    /**
     * Mint or regenerate the book's share token. Regenerate is an upsert on the {@code UNIQUE(book_id)}
     * constraint, so there is only ever one active token per book.
     *
     * @throws BookNotAccessibleException the book is not owned by the caller (→ 404)
     * @throws BookNotUnlockedException   the book has not been paid for (→ 402)
     */
    public ShareResponse mint(Long userId, Long bookId) {
        requireOwnedBook(userId, bookId);
        if (!isUnlocked(bookId)) {
            throw new BookNotUnlockedException("Purchase required");
        }
        String token = generateToken();
        jdbc.update(
            "INSERT INTO book_share_tokens (book_id, token) VALUES (?, ?) " +
            "ON CONFLICT (book_id) DO UPDATE SET token = EXCLUDED.token, created_at = NOW()",
            bookId, token);
        return response(token);
    }

    /**
     * The book's current token, or {@code { token: null, shareUrl: null }} if it was never shared.
     *
     * @throws BookNotAccessibleException the book is not owned by the caller (→ 404)
     */
    public ShareResponse get(Long userId, Long bookId) {
        requireOwnedBook(userId, bookId);
        List<String> tokens = jdbc.queryForList(
            "SELECT token FROM book_share_tokens WHERE book_id = ?", String.class, bookId);
        return response(tokens.isEmpty() ? null : tokens.get(0));
    }

    /**
     * Revoke the book's token. Idempotent — deleting a non-existent token is a no-op.
     *
     * @throws BookNotAccessibleException the book is not owned by the caller (→ 404)
     */
    public void revoke(Long userId, Long bookId) {
        requireOwnedBook(userId, bookId);
        jdbc.update("DELETE FROM book_share_tokens WHERE book_id = ?", bookId);
    }

    // --- helpers ---------------------------------------------------------------------------------

    /**
     * IDOR boundary: books has no user_id — ownership is books.baby_profile_id -> baby_profiles.user_id.
     * Mirrors BillingService.userOwnsBook. Throws (→ 404) rather than confirming the book exists.
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

    private boolean isUnlocked(Long bookId) {
        Boolean unlocked = jdbc.queryForObject(
            "SELECT share_unlocked_at IS NOT NULL FROM books WHERE id = ?", Boolean.class, bookId);
        return Boolean.TRUE.equals(unlocked);
    }

    /** 32 random bytes, URL-safe base64, no padding (~43 chars, fits VARCHAR(64)). */
    private String generateToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private ShareResponse response(String token) {
        return new ShareResponse(token, token == null ? null : frontendUrl + "/book/" + token);
    }

    /** The book is not owned by the caller. Mapped to 404 so we don't confirm it exists. */
    public static class BookNotAccessibleException extends RuntimeException {
        public BookNotAccessibleException(String message) {
            super(message);
        }
    }

    /** The book has not been paid for; a link can't be minted. Mapped to 402. */
    public static class BookNotUnlockedException extends RuntimeException {
        public BookNotUnlockedException(String message) {
            super(message);
        }
    }
}
