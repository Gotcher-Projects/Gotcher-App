package com.gotcherapp.api.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PasswordResetService {

    private final JdbcTemplate jdbc;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public PasswordResetService(JdbcTemplate jdbc, EmailService emailService, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
    }

    public void sendResetEmail(String email) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM users WHERE email = ?", email
        );
        if (rows.isEmpty()) return; // silent — prevents email enumeration

        Long userId = ((Number) rows.get(0).get("id")).longValue();
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id = ?", userId);

        String token = UUID.randomUUID().toString().replace("-", "");
        Instant expiresAt = Instant.now().plus(1, ChronoUnit.HOURS);
        jdbc.update(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            userId, token, Timestamp.from(expiresAt)
        );

        String link = frontendUrl + "?reset_token=" + token;
        emailService.send(
            email,
            "Reset your CradleHQ password",
            "Hi! Click the link below to reset your CradleHQ password:\n\n" +
            link + "\n\nThis link expires in 1 hour. If you didn't request a reset, you can ignore this email.\n\n— CradleHQ"
        );
    }

    public boolean resetPassword(String token, String newPassword) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?", token
        );
        if (rows.isEmpty()) return false;

        Instant expiresAt = ((Timestamp) rows.get(0).get("expires_at")).toInstant();
        if (expiresAt.isBefore(Instant.now())) {
            jdbc.update("DELETE FROM password_reset_tokens WHERE token = ?", token);
            return false;
        }

        Long userId = ((Number) rows.get(0).get("user_id")).longValue();
        jdbc.update(
            "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
            passwordEncoder.encode(newPassword), userId
        );
        jdbc.update("DELETE FROM password_reset_tokens WHERE token = ?", token);
        return true;
    }
}
