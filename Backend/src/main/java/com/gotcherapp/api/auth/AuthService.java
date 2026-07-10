package com.gotcherapp.api.auth;

import com.gotcherapp.api.auth.dto.*;
import com.gotcherapp.api.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final JdbcTemplate jdbc;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;
    private final int freeGrantLimit;
    private final int freeGrantSize;

    public AuthService(JdbcTemplate jdbc, JwtUtil jwtUtil, PasswordEncoder passwordEncoder,
                       EmailVerificationService emailVerificationService,
                       @Value("${app.free-grant.limit:500}") int freeGrantLimit,
                       @Value("${app.free-grant.size:5}") int freeGrantSize) {
        this.jdbc = jdbc;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
        this.emailVerificationService = emailVerificationService;
        this.freeGrantLimit = freeGrantLimit;
        this.freeGrantSize = freeGrantSize;
    }

    public AuthResponse register(RegisterRequest req) {
        if (req.email() == null || req.password() == null) {
            throw new IllegalArgumentException("Email and password are required");
        }
        if (req.password().length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }

        String hash = passwordEncoder.encode(req.password());
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap(
                "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?) RETURNING id, email, display_name",
                req.email().toLowerCase(), hash, req.displayName()
            );
        } catch (DuplicateKeyException e) {
            throw new EmailAlreadyExistsException();
        }

        Long userId = ((Number) row.get("id")).longValue();
        String email = (String) row.get("email");
        String displayName = (String) row.get("display_name");

        int credits = grantFreeCredits(userId);

        String accessToken = jwtUtil.generateAccessToken(userId, email);
        String refreshToken = jwtUtil.generateRefreshToken(userId);
        storeRefreshToken(userId, refreshToken, 7);

        try {
            emailVerificationService.sendVerificationEmail(userId, email);
        } catch (Exception e) {
            log.warn("Failed to send verification email to {}: {}", email, e.getMessage());
        }

        return new AuthResponse(accessToken, refreshToken, new UserDto(userId, email, displayName, false, "free", credits));
    }

    // Grant the launch promotion to the first `freeGrantLimit` signups (sv2-grant). Returns the user's
    // resulting credit balance — 0 when the cap is reached, so a late signup gets a normal account.
    //
    // The cap check and the write live in ONE statement: a read-then-write would let two concurrent
    // signups both observe limit-1 and both grant. This is not fully race-free either — under READ
    // COMMITTED the count subquery reads a snapshot, and concurrent signups touch different rows, so
    // simultaneous grants can still overshoot by roughly the number of in-flight registrations. That is
    // accepted: the cap is a spend ceiling, not a correctness boundary. What the statement DOES
    // guarantee is the part that matters — `free_grant_at IS NULL` is evaluated against the row
    // Postgres locks, so a user can never be granted twice.
    //
    // Never let this fail a signup. A user created without a grant is self-consistent (free_grant_at
    // stays null), so we log and fall through to a 0-credit account, same stance as the verification
    // email below.
    private int grantFreeCredits(Long userId) {
        if (freeGrantLimit <= 0 || freeGrantSize <= 0) return 0;
        try {
            List<Map<String, Object>> granted = jdbc.queryForList(
                "UPDATE users SET ai_credits_remaining = ai_credits_remaining + ?, free_grant_at = NOW() " +
                "WHERE id = ? AND free_grant_at IS NULL " +
                "AND (SELECT count(*) FROM users WHERE free_grant_at IS NOT NULL) < ? " +
                "RETURNING ai_credits_remaining",
                freeGrantSize, userId, freeGrantLimit
            );
            if (granted == null || granted.isEmpty()) return 0;  // cap reached, or already granted
            Object balance = granted.get(0).get("ai_credits_remaining");
            return balance != null ? ((Number) balance).intValue() : 0;
        } catch (Exception e) {
            log.warn("Free credit grant failed for user {}: {}", userId, e.getMessage());
            return 0;
        }
    }

    public AuthResponse login(LoginRequest req) {
        if (req.email() == null || req.password() == null) {
            throw new IllegalArgumentException("Email and password are required");
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, email, password_hash, display_name, is_active, email_verified, tier, ai_credits_remaining FROM users WHERE email = ?",
            req.email().toLowerCase()
        );

        if (rows.isEmpty() || !passwordEncoder.matches(req.password(), (String) rows.get(0).get("password_hash"))) {
            throw new InvalidCredentialsException();
        }

        Map<String, Object> user = rows.get(0);
        if (!(Boolean) user.get("is_active")) {
            throw new AccountDisabledException();
        }

        Long userId = ((Number) user.get("id")).longValue();
        String email = (String) user.get("email");
        String displayName = (String) user.get("display_name");
        boolean emailVerified = Boolean.TRUE.equals(user.get("email_verified"));
        String tier = (String) user.get("tier");
        int credits = user.get("ai_credits_remaining") != null ? ((Number) user.get("ai_credits_remaining")).intValue() : 0;

        jdbc.update("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?", userId);

        String accessToken = jwtUtil.generateAccessToken(userId, email);
        String refreshToken = jwtUtil.generateRefreshToken(userId);
        storeRefreshToken(userId, refreshToken, req.rememberMe() ? 30 : 7);

        return new AuthResponse(accessToken, refreshToken, new UserDto(userId, email, displayName, emailVerified, tier, credits));
    }

    public AuthResponse refresh(String refreshToken) {
        if (refreshToken == null) {
            throw new IllegalArgumentException("Refresh token required");
        }

        Long userId;
        try {
            userId = jwtUtil.getUserId(refreshToken);
        } catch (Exception e) {
            throw new InvalidTokenException();
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, user_id, expires_at, is_revoked FROM refresh_tokens WHERE token = ?",
            refreshToken
        );

        if (rows.isEmpty()) throw new InvalidTokenException();

        Map<String, Object> stored = rows.get(0);
        boolean isRevoked = (Boolean) stored.get("is_revoked");
        Instant expiresAt = ((Timestamp) stored.get("expires_at")).toInstant();

        if (isRevoked || expiresAt.isBefore(Instant.now())) {
            throw new InvalidTokenException();
        }

        // Rotate: revoke old, issue new pair
        jdbc.update("UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = ?", stored.get("id"));

        List<Map<String, Object>> userRows = jdbc.queryForList(
            "SELECT id, email, display_name, email_verified, tier, ai_credits_remaining FROM users WHERE id = ?", userId);
        if (userRows.isEmpty()) throw new InvalidTokenException();

        String email = (String) userRows.get(0).get("email");
        String displayName = (String) userRows.get(0).get("display_name");
        boolean emailVerified = Boolean.TRUE.equals(userRows.get(0).get("email_verified"));
        String tier = (String) userRows.get(0).get("tier");
        int credits = userRows.get(0).get("ai_credits_remaining") != null ? ((Number) userRows.get(0).get("ai_credits_remaining")).intValue() : 0;
        String newAccessToken = jwtUtil.generateAccessToken(userId, email);
        String newRefreshToken = jwtUtil.generateRefreshToken(userId);
        storeRefreshToken(userId, newRefreshToken, 7);

        return new AuthResponse(newAccessToken, newRefreshToken, new UserDto(userId, email, displayName, emailVerified, tier, credits));
    }

    public void logout(String refreshToken) {
        if (refreshToken == null) {
            throw new IllegalArgumentException("Refresh token required");
        }
        jdbc.update("UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = ?", refreshToken);
    }

    public UserDto getUser(Long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, email, display_name, email_verified, tier, ai_credits_remaining FROM users WHERE id = ?", userId);
        if (rows.isEmpty()) throw new InvalidTokenException();
        Map<String, Object> u = rows.get(0);
        int credits = u.get("ai_credits_remaining") != null ? ((Number) u.get("ai_credits_remaining")).intValue() : 0;
        return new UserDto(
            ((Number) u.get("id")).longValue(),
            (String) u.get("email"),
            (String) u.get("display_name"),
            Boolean.TRUE.equals(u.get("email_verified")),
            (String) u.get("tier"),
            credits
        );
    }

    private void storeRefreshToken(Long userId, String token, int days) {
        Instant expiresAt = Instant.now().plus(days, ChronoUnit.DAYS);
        jdbc.update(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            userId, token, Timestamp.from(expiresAt)
        );
    }

    // ── Custom exceptions ─────────────────────────────────────────────────────
    public static class EmailAlreadyExistsException extends RuntimeException {
        public EmailAlreadyExistsException() { super("Email already registered"); }
    }
    public static class InvalidCredentialsException extends RuntimeException {
        public InvalidCredentialsException() { super("Invalid credentials"); }
    }
    public static class AccountDisabledException extends RuntimeException {
        public AccountDisabledException() { super("Account is disabled"); }
    }
    public static class InvalidTokenException extends RuntimeException {
        public InvalidTokenException() { super("Invalid or expired token"); }
    }
}
