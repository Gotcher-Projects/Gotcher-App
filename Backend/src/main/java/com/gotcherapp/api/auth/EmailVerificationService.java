package com.gotcherapp.api.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EmailVerificationService {

    private final JdbcTemplate jdbc;
    private final EmailService emailService;

    @Value("${app.backend-url}")
    private String backendUrl;

    public EmailVerificationService(JdbcTemplate jdbc, EmailService emailService) {
        this.jdbc = jdbc;
        this.emailService = emailService;
    }

    public void sendVerificationEmail(Long userId, String email) {
        // Replace any existing token
        jdbc.update("DELETE FROM email_verification_tokens WHERE user_id = ?", userId);

        String token = UUID.randomUUID().toString().replace("-", "");
        Instant expiresAt = Instant.now().plus(24, ChronoUnit.HOURS);
        jdbc.update(
            "INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            userId, token, Timestamp.from(expiresAt)
        );

        String link = backendUrl + "/auth/verify-email?token=" + token;
        emailService.send(
            email,
            "Verify your Baby Steps email",
            "Hi! Please verify your email address by clicking the link below:\n\n" +
            link + "\n\nThis link expires in 24 hours.\n\n— Baby Steps"
        );
    }

    /** Returns true if the token was valid and the user was marked verified. */
    public boolean verify(String token) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ?", token
        );
        if (rows.isEmpty()) return false;

        Instant expiresAt = ((Timestamp) rows.get(0).get("expires_at")).toInstant();
        if (expiresAt.isBefore(Instant.now())) {
            jdbc.update("DELETE FROM email_verification_tokens WHERE token = ?", token);
            return false;
        }

        Long userId = ((Number) rows.get(0).get("user_id")).longValue();
        jdbc.update("UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = ?", userId);
        jdbc.update("DELETE FROM email_verification_tokens WHERE token = ?", token);
        return true;
    }
}
