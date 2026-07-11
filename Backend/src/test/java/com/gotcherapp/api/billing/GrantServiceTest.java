package com.gotcherapp.api.billing;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Payments P4 — locks in the idempotency ledger + grant shapes verified by hand in P3.
 *
 * The ON CONFLICT DO NOTHING insert is the single guard against double-granting: the grant runs ONLY
 * when the insert affected one row. These tests pin that (a redelivery is a no-op) and the three grant
 * shapes (credit pack, share-only, bundle) so a future edit can't silently regress them.
 */
@ExtendWith(MockitoExtension.class)
class GrantServiceTest {

    @Mock JdbcTemplate jdbc;
    @InjectMocks GrantService service;

    private static final String EVENT_ID = "evt_1";
    private static final Long USER_ID = 42L;
    private static final Long BOOK_ID = 7L;

    /** Stub the ledger insert to report it affected {@code rows} (1 = first delivery, 0 = redelivery). */
    private void insertAffects(int rows) {
        when(jdbc.update(startsWith("INSERT INTO stripe_events_applied"),
            any(), any(), any(), any(), any())).thenReturn(rows);
    }

    @Test
    void creditPack_grantsCredits_recordsLedger_noBookUnlock() {
        insertAffects(1);

        boolean applied = service.apply(EVENT_ID, USER_ID, "credits_50", 50, null);

        assertTrue(applied);
        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining + ?"),
            (Object) eq(50), (Object) eq(USER_ID));
        verify(jdbc, never()).update(contains("UPDATE books SET share_unlocked_at"), any(Long.class));
    }

    @Test
    void replay_returnsFalse_grantsNothing() {
        insertAffects(0);   // event_id already present — a redelivery.

        boolean applied = service.apply(EVENT_ID, USER_ID, "credits_50", 50, null);

        assertFalse(applied);
        // The ledger insert is the ONLY statement that runs — no second credit or unlock.
        verify(jdbc, never()).update(contains("ai_credits_remaining"),
            (Object) any(Integer.class), (Object) any(Long.class));
        verify(jdbc, never()).update(contains("UPDATE books SET share_unlocked_at"), any(Long.class));
    }

    @Test
    void shareOnly_unlocksBook_noCredits() {
        insertAffects(1);

        boolean applied = service.apply(EVENT_ID, USER_ID, "share_only", 0, BOOK_ID);

        assertTrue(applied);
        verify(jdbc).update(contains("UPDATE books SET share_unlocked_at"), eq(BOOK_ID));
        // credits == 0 → the balance is never touched.
        verify(jdbc, never()).update(contains("ai_credits_remaining"), any(Integer.class), any(Long.class));
    }

    @Test
    void bundle_grantsCreditsAndUnlocksBook() {
        insertAffects(1);

        boolean applied = service.apply(EVENT_ID, USER_ID, "bundle_share_150", 150, BOOK_ID);

        assertTrue(applied);
        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining + ?"),
            (Object) eq(150), (Object) eq(USER_ID));
        verify(jdbc).update(contains("UPDATE books SET share_unlocked_at"), eq(BOOK_ID));
    }
}
