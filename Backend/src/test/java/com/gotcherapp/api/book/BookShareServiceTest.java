package com.gotcherapp.api.book;

import com.gotcherapp.api.book.dto.ShareResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookShareServiceTest {

    @Mock JdbcTemplate jdbc;

    private static final Long USER_ID = 1L;
    private static final Long BOOK_ID = 10L;
    private static final String FRONTEND = "http://localhost:3000";

    private BookShareService service() {
        return new BookShareService(jdbc, FRONTEND);
    }

    private void stubOwnership(boolean owned) {
        when(jdbc.queryForObject(contains("COUNT(*)"), eq(Integer.class), eq(BOOK_ID), eq(USER_ID)))
            .thenReturn(owned ? 1 : 0);
    }

    private void stubUnlocked(boolean unlocked) {
        when(jdbc.queryForObject(contains("share_unlocked_at IS NOT NULL"), eq(Boolean.class), eq(BOOK_ID)))
            .thenReturn(unlocked);
    }

    // ── mint ────────────────────────────────────────────────────────────────────

    @Test
    void mint_ownedAndUnlocked_upsertsTokenAndReturnsShareUrl() {
        stubOwnership(true);
        stubUnlocked(true);

        ShareResponse res = service().mint(USER_ID, BOOK_ID);

        assertNotNull(res.token());
        assertEquals(FRONTEND + "/book/" + res.token(), res.shareUrl());
        // URL-safe base64 of 32 bytes, no padding
        assertTrue(res.token().matches("[A-Za-z0-9_-]+"), "token must be URL-safe");
        assertFalse(res.token().contains("="), "token must be unpadded");

        ArgumentCaptor<String> tokenArg = ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(contains("INSERT INTO book_share_tokens"), eq(BOOK_ID), tokenArg.capture());
        assertEquals(res.token(), tokenArg.getValue());
    }

    @Test
    void mint_notOwned_throwsNotAccessible_andNeverWrites() {
        stubOwnership(false);

        assertThrows(BookShareService.BookNotAccessibleException.class,
            () -> service().mint(USER_ID, BOOK_ID));
        verify(jdbc, never()).update(contains("INSERT INTO book_share_tokens"), any(), any());
    }

    @Test
    void mint_ownedButLocked_throwsNotUnlocked_andNeverWrites() {
        stubOwnership(true);
        stubUnlocked(false);

        assertThrows(BookShareService.BookNotUnlockedException.class,
            () -> service().mint(USER_ID, BOOK_ID));
        verify(jdbc, never()).update(contains("INSERT INTO book_share_tokens"), any(), any());
    }

    // ── get ─────────────────────────────────────────────────────────────────────

    @Test
    void get_existingToken_returnsTokenAndUrl() {
        stubOwnership(true);
        when(jdbc.queryForList(contains("SELECT token"), eq(String.class), eq(BOOK_ID)))
            .thenReturn(List.of("abc123"));

        ShareResponse res = service().get(USER_ID, BOOK_ID);

        assertEquals("abc123", res.token());
        assertEquals(FRONTEND + "/book/abc123", res.shareUrl());
    }

    @Test
    void get_noToken_returnsNulls() {
        stubOwnership(true);
        when(jdbc.queryForList(contains("SELECT token"), eq(String.class), eq(BOOK_ID)))
            .thenReturn(List.of());

        ShareResponse res = service().get(USER_ID, BOOK_ID);

        assertNull(res.token());
        assertNull(res.shareUrl());
    }

    @Test
    void get_notOwned_throwsNotAccessible() {
        stubOwnership(false);
        assertThrows(BookShareService.BookNotAccessibleException.class,
            () -> service().get(USER_ID, BOOK_ID));
    }

    // ── revoke ──────────────────────────────────────────────────────────────────

    @Test
    void revoke_owned_deletesToken() {
        stubOwnership(true);

        service().revoke(USER_ID, BOOK_ID);

        verify(jdbc).update(contains("DELETE FROM book_share_tokens"), eq(BOOK_ID));
    }

    @Test
    void revoke_notOwned_throws_andNeverDeletes() {
        stubOwnership(false);

        assertThrows(BookShareService.BookNotAccessibleException.class,
            () -> service().revoke(USER_ID, BOOK_ID));
        verify(jdbc, never()).update(contains("DELETE FROM book_share_tokens"), eq(BOOK_ID));
    }
}
