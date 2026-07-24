package com.gotcherapp.api.print;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Print pr3 — persistence for rendered PDFs (D2). Stores bytes in Postgres {@code print_pdfs} keyed by an
 * unguessable token, and serves them by token with a TTL. The token is the secret in the URL Lulu fetches
 * (GET /print/pdf/{token}); expiry gates both reads and the sweep.
 */
@Service
public class PrintPdfStore {

    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();

    public PrintPdfStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Stored(String token, Instant expiresAt) {}

    public record Pdf(byte[] bytes, String contentType) {}

    /** Persist a rendered PDF and return its opaque token + expiry. {@code kind} is "interior" | "cover". */
    public Stored save(Long bookId, String kind, byte[] bytes, String contentType, Duration ttl) {
        String token = generateToken();
        Instant expiresAt = Instant.now().plus(ttl);
        jdbc.update(
            "INSERT INTO print_pdfs (token, book_id, kind, bytes, content_type, expires_at) " +
            "VALUES (?, ?, ?, ?, ?, ?)",
            token, bookId, kind, bytes, contentType, Timestamp.from(expiresAt));
        return new Stored(token, expiresAt);
    }

    /** Fetch a non-expired PDF by token (empty if missing or expired). */
    public Optional<Pdf> fetch(String token) {
        List<Pdf> rows = jdbc.query(
            "SELECT bytes, content_type FROM print_pdfs WHERE token = ? AND expires_at > NOW()",
            (rs, i) -> new Pdf(rs.getBytes("bytes"), rs.getString("content_type")),
            token);
        return rows.stream().findFirst();
    }

    /** TTL sweep — delete expired rows so baby-photo PDFs don't linger. Hourly (see @EnableScheduling). */
    @Scheduled(fixedRate = 3_600_000L)
    public void sweepExpired() {
        jdbc.update("DELETE FROM print_pdfs WHERE expires_at < NOW()");
    }

    /** 32 random bytes, URL-safe base64, no padding (~43 chars, fits VARCHAR(64)) — matches share tokens. */
    private String generateToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
