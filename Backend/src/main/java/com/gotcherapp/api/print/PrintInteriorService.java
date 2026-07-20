package com.gotcherapp.api.print;

import com.gotcherapp.api.book.PublicBookService;
import com.gotcherapp.api.book.dto.PublicBookResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Print pr5.5 — the SINGLE SOURCE OF TRUTH (D5) for the print interior page count and whether a book can be
 * ordered. Everything downstream reads this: the Lulu submit's cover-spine cross-check, the pr6 price, and the
 * pr8 order UI's gate. The count is Σ (filtered chapter pages) — i.e. exactly the pages the print PDF renders
 * ({@link PublicBookService#getByBookIdFiltered}), so the number can never drift from what actually prints.
 *
 * <p>Gate (D2, no padding): a book needs at least {@value #MIN_PAGES} filled interior pages — the SKU's hard
 * floor. Freeform "scrapbook" books are additionally capped at {@value #MAX_PAGES_FREEFORM} (the pr6 pricing
 * table is defined 32–50); guided books ride the SKU ceiling ({@value #MAX_PAGES_GUIDED}), which their fixed
 * arcs never approach. Guided books can't add pages, so an under-floor guided book must FILL more pages rather
 * than add them — {@link Reason} distinguishes the two so pr8 shows the right message.
 */
@Service
public class PrintInteriorService {

    /** The SKU's hard interior minimum (0850X1100FCPREPB080CW444GXX requires 32–800 pages). */
    public static final int MIN_PAGES = 32;
    /** Scrapbook (freeform) upper bound — the pr6 pricing table is defined 32–50. */
    public static final int MAX_PAGES_FREEFORM = 50;
    /** Guided upper bound — the SKU ceiling (fixed arcs are ~32–37, so this is only a safety rail). */
    public static final int MAX_PAGES_GUIDED = 800;

    /** Why a book is / isn't orderable — lets pr8 phrase it right (guided can't add pages, only fill them). */
    public enum Reason { OK, FILL_MORE, ADD_MORE, OVER_MAX }

    private final JdbcTemplate jdbc;
    private final PublicBookService publicBookService;

    public PrintInteriorService(JdbcTemplate jdbc, PublicBookService publicBookService) {
        this.jdbc = jdbc;
        this.publicBookService = publicBookService;
    }

    /**
     * @param pageCount filled interior pages (== the pages that print)
     * @param min       the SKU floor (always {@link #MIN_PAGES})
     * @param max       the type-specific ceiling (freeform 50 / guided 800)
     * @param orderable count is within [min, max]
     * @param shortBy   pages still needed to reach the floor (0 when already ≥ floor)
     * @param overBy    pages over the ceiling (0 when ≤ ceiling)
     */
    public record Orderability(int pageCount, int min, int max, boolean orderable,
                               int shortBy, int overBy, String bookType, Reason reason) {}

    /** Filled interior page count for an already-fetched payload = Σ chapter pages (== what prints). */
    public int pageCount(PublicBookResponse book) {
        int n = 0;
        for (PublicBookResponse.Chapter ch : book.chapters()) {
            if (ch.pages() != null) n += ch.pages().size();
        }
        return n;
    }

    /** Filled interior page count for a book id. Caller must have already authorized access to the book. */
    public int pageCount(Long bookId) {
        return pageCount(publicBookService.getByBookIdFiltered(bookId));
    }

    /** Pure gate evaluation for a known book type + filled page count. */
    public Orderability evaluate(String bookType, int pageCount) {
        boolean freeform = "freeform".equals(bookType);
        int max = freeform ? MAX_PAGES_FREEFORM : MAX_PAGES_GUIDED;
        int shortBy = Math.max(0, MIN_PAGES - pageCount);
        int overBy = Math.max(0, pageCount - max);
        boolean orderable = shortBy == 0 && overBy == 0;
        Reason reason;
        if (overBy > 0)       reason = Reason.OVER_MAX;
        else if (shortBy > 0) reason = freeform ? Reason.ADD_MORE : Reason.FILL_MORE;
        else                  reason = Reason.OK;
        return new Orderability(pageCount, MIN_PAGES, max, orderable, shortBy, overBy, bookType, reason);
    }

    /** Owner-checked gate for the order UI (pr8) + price (pr6). Throws (→ 404) if the book isn't owned. */
    public Orderability orderability(Long userId, Long bookId) {
        requireOwnedBook(userId, bookId);
        PublicBookResponse book = publicBookService.getByBookIdFiltered(bookId);
        return evaluate(book.type(), pageCount(book));
    }

    /**
     * IDOR boundary — books has no user_id; ownership is books.baby_profile_id -> baby_profiles.user_id.
     * Mirrors {@link PrintRenderService}'s check; reuses its exception so callers map it to 404 uniformly.
     */
    private void requireOwnedBook(Long userId, Long bookId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM books b JOIN baby_profiles bp ON b.baby_profile_id = bp.id " +
            "WHERE b.id = ? AND bp.user_id = ?",
            Integer.class, bookId, userId);
        if (count == null || count == 0) {
            throw new PrintRenderService.BookNotAccessibleException("Book not found");
        }
    }
}
