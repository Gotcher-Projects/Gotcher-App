package com.gotcherapp.api.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock EmailService emailService;
    @InjectMocks EmailVerificationService emailVerificationService;

    private static final String TOKEN = "abc123def456";
    private static final Long USER_ID = 5L;

    // ── verify ────────────────────────────────────────────────────────────────

    @Test
    void verify_returnsFalse_whenTokenNotFound() {
        when(jdbc.queryForList(contains("email_verification_tokens"), eq(TOKEN)))
            .thenReturn(List.of());

        assertFalse(emailVerificationService.verify(TOKEN));
        verify(jdbc, never()).update(contains("UPDATE users"), eq(USER_ID));
    }

    @Test
    void verify_returnsFalse_andDeletesToken_whenExpired() {
        Instant expired = Instant.now().minus(1, ChronoUnit.HOURS);
        Map<String, Object> row = Map.of(
            "user_id",    USER_ID,
            "expires_at", Timestamp.from(expired)
        );
        when(jdbc.queryForList(contains("email_verification_tokens"), eq(TOKEN)))
            .thenReturn(List.of(row));

        assertFalse(emailVerificationService.verify(TOKEN));
        verify(jdbc).update(contains("DELETE FROM email_verification_tokens"), eq(TOKEN));
        verify(jdbc, never()).update(contains("UPDATE users"), eq(USER_ID));
    }

    @Test
    void verify_returnsTrue_andMarksEmailVerified_whenTokenValid() {
        Instant future = Instant.now().plus(12, ChronoUnit.HOURS);
        Map<String, Object> row = Map.of(
            "user_id",    USER_ID,
            "expires_at", Timestamp.from(future)
        );
        when(jdbc.queryForList(contains("email_verification_tokens"), eq(TOKEN)))
            .thenReturn(List.of(row));

        assertTrue(emailVerificationService.verify(TOKEN));
        verify(jdbc).update(contains("UPDATE users SET email_verified"), eq(USER_ID));
        verify(jdbc).update(contains("DELETE FROM email_verification_tokens"), eq(TOKEN));
    }
}
