package com.gotcherapp.api.auth;

import com.gotcherapp.api.auth.AuthService.*;
import com.gotcherapp.api.auth.dto.*;
import com.gotcherapp.api.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock JwtUtil jwtUtil;
    @Mock PasswordEncoder passwordEncoder;
    @Mock EmailVerificationService emailVerificationService;
    @InjectMocks AuthService authService;

    private static final Long USER_ID = 1L;
    private static final String EMAIL = "test@example.com";
    private static final String PASSWORD = "password123";
    private static final String HASH = "$2a$10$hash";
    private static final String ACCESS_TOKEN = "access.token.here";
    private static final String REFRESH_TOKEN = "refresh.token.here";

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    void register_returnsAuthResponse_onSuccess() {
        when(passwordEncoder.encode(PASSWORD)).thenReturn(HASH);
        when(jdbc.queryForMap(contains("INSERT INTO users"), eq(EMAIL), eq(HASH), isNull()))
                .thenReturn(Map.of("id", USER_ID, "email", EMAIL, "display_name", "Test"));
        when(jwtUtil.generateAccessToken(USER_ID, EMAIL)).thenReturn(ACCESS_TOKEN);
        when(jwtUtil.generateRefreshToken(USER_ID)).thenReturn(REFRESH_TOKEN);

        var req = new RegisterRequest(EMAIL, PASSWORD, null);
        AuthResponse result = authService.register(req);

        assertEquals(ACCESS_TOKEN, result.accessToken());
        assertEquals(REFRESH_TOKEN, result.refreshToken());
        assertEquals(EMAIL, result.user().email());
    }

    @Test
    void register_hashesPassword() {
        when(passwordEncoder.encode(PASSWORD)).thenReturn(HASH);
        when(jdbc.queryForMap(contains("INSERT INTO users"), eq(EMAIL), eq(HASH), isNull()))
                .thenReturn(Map.of("id", USER_ID, "email", EMAIL, "display_name", "Test"));
        when(jwtUtil.generateAccessToken(any(), any())).thenReturn(ACCESS_TOKEN);
        when(jwtUtil.generateRefreshToken(any())).thenReturn(REFRESH_TOKEN);

        authService.register(new RegisterRequest(EMAIL, PASSWORD, null));

        verify(passwordEncoder).encode(PASSWORD);
    }

    @Test
    void register_throwsEmailAlreadyExists_onDuplicate() {
        when(passwordEncoder.encode(any())).thenReturn(HASH);
        when(jdbc.queryForMap(contains("INSERT INTO users"), any(), any(), any()))
                .thenThrow(new DuplicateKeyException("duplicate key"));

        assertThrows(EmailAlreadyExistsException.class,
                () -> authService.register(new RegisterRequest(EMAIL, PASSWORD, null)));
    }

    @Test
    void register_throwsIllegalArgument_whenEmailNull() {
        assertThrows(IllegalArgumentException.class,
                () -> authService.register(new RegisterRequest(null, PASSWORD, null)));
    }

    @Test
    void register_throwsIllegalArgument_whenPasswordNull() {
        assertThrows(IllegalArgumentException.class,
                () -> authService.register(new RegisterRequest(EMAIL, null, null)));
    }

    @Test
    void register_throwsIllegalArgument_whenPasswordTooShort() {
        assertThrows(IllegalArgumentException.class,
                () -> authService.register(new RegisterRequest(EMAIL, "short", null)));
    }

    @Test
    void register_doesNotFailIfEmailSendingFails() throws Exception {
        when(passwordEncoder.encode(PASSWORD)).thenReturn(HASH);
        when(jdbc.queryForMap(contains("INSERT INTO users"), any(), any(), any()))
                .thenReturn(Map.of("id", USER_ID, "email", EMAIL, "display_name", "Test"));
        when(jwtUtil.generateAccessToken(any(), any())).thenReturn(ACCESS_TOKEN);
        when(jwtUtil.generateRefreshToken(any())).thenReturn(REFRESH_TOKEN);
        doThrow(new RuntimeException("SMTP error")).when(emailVerificationService).sendVerificationEmail(any(), any());

        // Should NOT throw even if email fails
        assertDoesNotThrow(() -> authService.register(new RegisterRequest(EMAIL, PASSWORD, null)));
    }

    // ── login ─────────────────────────────────────────────────────────────────

    @Test
    void login_returnsAuthResponse_onSuccess() {
        Map<String, Object> userRow = buildUserRow(true, true);
        when(jdbc.queryForList(contains("FROM users WHERE email"), eq(EMAIL)))
                .thenReturn(List.of(userRow));
        when(passwordEncoder.matches(PASSWORD, HASH)).thenReturn(true);
        when(jwtUtil.generateAccessToken(USER_ID, EMAIL)).thenReturn(ACCESS_TOKEN);
        when(jwtUtil.generateRefreshToken(USER_ID)).thenReturn(REFRESH_TOKEN);

        AuthResponse result = authService.login(new LoginRequest(EMAIL, PASSWORD, false));

        assertEquals(ACCESS_TOKEN, result.accessToken());
        assertEquals(EMAIL, result.user().email());
    }

    @Test
    void login_throwsInvalidCredentials_whenUserNotFound() {
        when(jdbc.queryForList(contains("FROM users WHERE email"), eq(EMAIL)))
                .thenReturn(List.of());

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(new LoginRequest(EMAIL, PASSWORD, false)));
    }

    @Test
    void login_throwsInvalidCredentials_whenWrongPassword() {
        when(jdbc.queryForList(contains("FROM users WHERE email"), eq(EMAIL)))
                .thenReturn(List.of(buildUserRow(true, false)));
        when(passwordEncoder.matches(eq(PASSWORD), any())).thenReturn(false);

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(new LoginRequest(EMAIL, PASSWORD, false)));
    }

    @Test
    void login_throwsAccountDisabled_whenUserInactive() {
        when(jdbc.queryForList(contains("FROM users WHERE email"), eq(EMAIL)))
                .thenReturn(List.of(buildUserRow(false, true)));
        when(passwordEncoder.matches(PASSWORD, HASH)).thenReturn(true);

        assertThrows(AccountDisabledException.class,
                () -> authService.login(new LoginRequest(EMAIL, PASSWORD, false)));
    }

    @Test
    void login_throwsIllegalArgument_whenEmailNull() {
        assertThrows(IllegalArgumentException.class,
                () -> authService.login(new LoginRequest(null, PASSWORD, false)));
    }

    // ── refresh ───────────────────────────────────────────────────────────────

    @Test
    void refresh_returnsNewTokenPair_onSuccess() {
        when(jwtUtil.getUserId(REFRESH_TOKEN)).thenReturn(USER_ID);
        when(jdbc.queryForList(contains("refresh_tokens WHERE token"), eq(REFRESH_TOKEN)))
                .thenReturn(List.of(buildValidTokenRow()));
        when(jdbc.queryForList(contains("FROM users WHERE id"), eq(USER_ID)))
                .thenReturn(List.of(Map.of("id", USER_ID, "email", EMAIL, "email_verified", false)));
        when(jwtUtil.generateAccessToken(USER_ID, EMAIL)).thenReturn("new.access");
        when(jwtUtil.generateRefreshToken(USER_ID)).thenReturn("new.refresh");

        AuthResponse result = authService.refresh(REFRESH_TOKEN);

        assertEquals("new.access", result.accessToken());
        assertEquals("new.refresh", result.refreshToken());
    }

    @Test
    void refresh_throwsIllegalArgument_whenTokenNull() {
        assertThrows(IllegalArgumentException.class, () -> authService.refresh(null));
    }

    @Test
    void refresh_throwsInvalidToken_whenTokenNotInDb() {
        when(jwtUtil.getUserId(REFRESH_TOKEN)).thenReturn(USER_ID);
        when(jdbc.queryForList(contains("refresh_tokens WHERE token"), eq(REFRESH_TOKEN)))
                .thenReturn(List.of());

        assertThrows(InvalidTokenException.class, () -> authService.refresh(REFRESH_TOKEN));
    }

    @Test
    void refresh_throwsInvalidToken_whenTokenRevoked() {
        when(jwtUtil.getUserId(REFRESH_TOKEN)).thenReturn(USER_ID);
        Map<String, Object> revokedRow = buildValidTokenRow();
        revokedRow.put("is_revoked", true);
        when(jdbc.queryForList(contains("refresh_tokens WHERE token"), eq(REFRESH_TOKEN)))
                .thenReturn(List.of(revokedRow));

        assertThrows(InvalidTokenException.class, () -> authService.refresh(REFRESH_TOKEN));
    }

    @Test
    void refresh_throwsInvalidToken_whenTokenExpired() {
        when(jwtUtil.getUserId(REFRESH_TOKEN)).thenReturn(USER_ID);
        Map<String, Object> expiredRow = buildValidTokenRow();
        expiredRow.put("expires_at", Timestamp.from(Instant.now().minus(1, ChronoUnit.DAYS)));
        when(jdbc.queryForList(contains("refresh_tokens WHERE token"), eq(REFRESH_TOKEN)))
                .thenReturn(List.of(expiredRow));

        assertThrows(InvalidTokenException.class, () -> authService.refresh(REFRESH_TOKEN));
    }

    @Test
    void refresh_throwsInvalidToken_whenJwtInvalid() {
        when(jwtUtil.getUserId(REFRESH_TOKEN)).thenThrow(new RuntimeException("bad jwt"));

        assertThrows(InvalidTokenException.class, () -> authService.refresh(REFRESH_TOKEN));
    }

    // ── logout ────────────────────────────────────────────────────────────────

    @Test
    void logout_revokesToken() {
        authService.logout(REFRESH_TOKEN);
        verify(jdbc).update(contains("is_revoked = TRUE"), eq(REFRESH_TOKEN));
    }

    @Test
    void logout_throwsIllegalArgument_whenTokenNull() {
        assertThrows(IllegalArgumentException.class, () -> authService.logout(null));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> buildUserRow(boolean active, boolean passwordMatches) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", USER_ID);
        row.put("email", EMAIL);
        row.put("password_hash", passwordMatches ? HASH : "wrong_hash");
        row.put("display_name", "Test");
        row.put("is_active", active);
        row.put("email_verified", false);
        return row;
    }

    private Map<String, Object> buildValidTokenRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", 5L);
        row.put("user_id", USER_ID);
        row.put("is_revoked", false);
        row.put("expires_at", Timestamp.from(Instant.now().plus(7, ChronoUnit.DAYS)));
        return row;
    }
}
