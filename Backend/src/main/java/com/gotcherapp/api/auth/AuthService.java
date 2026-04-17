package com.gotcherapp.api.auth;

import com.gotcherapp.api.auth.dto.*;
import com.gotcherapp.api.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    public AuthService(JdbcTemplate jdbc, JwtUtil jwtUtil, PasswordEncoder passwordEncoder,
                       EmailVerificationService emailVerificationService) {
        this.jdbc = jdbc;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
        this.emailVerificationService = emailVerificationService;
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

        String accessToken = jwtUtil.generateAccessToken(userId, email);
        String refreshToken = jwtUtil.generateRefreshToken(userId);
        storeRefreshToken(userId, refreshToken);

        try {
            emailVerificationService.sendVerificationEmail(userId, email);
        } catch (Exception e) {
            log.warn("Failed to send verification email to {}: {}", email, e.getMessage());
        }

        return new AuthResponse(accessToken, refreshToken, new UserDto(userId, email, displayName, false));
    }

    public AuthResponse login(LoginRequest req) {
        if (req.email() == null || req.password() == null) {
            throw new IllegalArgumentException("Email and password are required");
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, email, password_hash, display_name, is_active, email_verified FROM users WHERE email = ?",
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

        jdbc.update("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?", userId);

        String accessToken = jwtUtil.generateAccessToken(userId, email);
        String refreshToken = jwtUtil.generateRefreshToken(userId);
        storeRefreshToken(userId, refreshToken);

        return new AuthResponse(accessToken, refreshToken, new UserDto(userId, email, displayName, emailVerified));
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
            "SELECT id, email, display_name, email_verified FROM users WHERE id = ?", userId);
        if (userRows.isEmpty()) throw new InvalidTokenException();

        String email = (String) userRows.get(0).get("email");
        String displayName = (String) userRows.get(0).get("display_name");
        boolean emailVerified = Boolean.TRUE.equals(userRows.get(0).get("email_verified"));
        String newAccessToken = jwtUtil.generateAccessToken(userId, email);
        String newRefreshToken = jwtUtil.generateRefreshToken(userId);
        storeRefreshToken(userId, newRefreshToken);

        return new AuthResponse(newAccessToken, newRefreshToken, new UserDto(userId, email, displayName, emailVerified));
    }

    public void logout(String refreshToken) {
        if (refreshToken == null) {
            throw new IllegalArgumentException("Refresh token required");
        }
        jdbc.update("UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = ?", refreshToken);
    }

    private void storeRefreshToken(Long userId, String token) {
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
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
