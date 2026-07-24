package com.gotcherapp.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtUtil {

    // Print pr3 — render token: a short-lived JWT scoped to one book, authorizing the unauthenticated payload
    // fetch during a render (headless Chrome loads /print/book/{token} → GET /print/payload/{token}). ~5 min is
    // ample (a full-book render is ~4s) and the exposure window stays tiny.
    private static final long PRINT_RENDER_EXPIRATION_MS = 5 * 60 * 1000L;
    private static final String PRINT_RENDER_PURPOSE = "print-render";

    private final SecretKey key;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-expiration-ms}") long accessExpirationMs,
            @Value("${app.jwt.refresh-expiration-ms}") long refreshExpirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirationMs = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    public String generateAccessToken(Long userId, String email) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessExpirationMs))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(Long userId) {
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(userId.toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshExpirationMs))
                .signWith(key)
                .compact();
    }

    /** Print pr3 — mint a short-lived render token scoped to one book (subject = bookId, purpose claim). */
    public String generatePrintRenderToken(Long bookId) {
        return Jwts.builder()
                .subject(bookId.toString())
                .claim("purpose", PRINT_RENDER_PURPOSE)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + PRINT_RENDER_EXPIRATION_MS))
                .signWith(key)
                .compact();
    }

    /**
     * Print pr3 — verify a render token (signature + expiry via parseToken) and its purpose, returning the
     * book id it authorizes. Throws {@link io.jsonwebtoken.JwtException} on any invalid/expired/wrong-purpose
     * token, which the payload endpoint maps to 404 (don't confirm which part failed).
     */
    public Long getPrintRenderBookId(String token) {
        Claims claims = parseToken(token);
        if (!PRINT_RENDER_PURPOSE.equals(claims.get("purpose", String.class))) {
            throw new io.jsonwebtoken.JwtException("not a print-render token");
        }
        return Long.parseLong(claims.getSubject());
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long getUserId(String token) {
        return Long.parseLong(parseToken(token).getSubject());
    }

    public String getEmail(String token) {
        return parseToken(token).get("email", String.class);
    }
}
