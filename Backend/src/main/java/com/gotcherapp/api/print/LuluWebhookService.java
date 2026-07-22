package com.gotcherapp.api.print;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Print s14a-1 — verifies and processes Lulu's {@code PRINT_JOB_STATUS_CHANGED} webhook. Exactly the same
 * posture as the Stripe webhook (Payments P3): Lulu sends no JWT, so <b>the HMAC signature IS the
 * authentication</b>, and it is computed over the RAW request bytes — which is why the controller takes the body
 * as a String and nothing deserializes it first.
 *
 * <p><b>Why this one is allowed under {@code /print/**}</b> (which is {@code permitAll} in SecurityConfig, and
 * which pr9 was deliberately kept OUT of): the pr9 order lookup returned owner data with no proof of identity,
 * so it needed the JWT namespace. This endpoint proves the caller holds our Lulu API secret before it touches
 * anything — the same self-authorizing pattern as {@code AdminController}'s {@code X-Admin-Secret}.
 *
 * <p><b>200 is the safe answer for anything we can't act on.</b> Lulu <b>deactivates a webhook after 5
 * consecutive failed deliveries</b>, so a dummy {@code /webhooks/{id}/test/} payload or an event about a job
 * with no order behind it must not spend one of those five. Only a genuine processing failure returns 500.
 */
@Service
public class LuluWebhookService {

    private static final Logger log = LoggerFactory.getLogger(LuluWebhookService.class);

    /** The only topic we subscribe to; anything else is acknowledged and ignored. */
    public static final String TOPIC_PRINT_JOB_STATUS_CHANGED = "PRINT_JOB_STATUS_CHANGED";

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final PrintOrderStatusService statusService;
    private final LuluJobStatusMapper mapper;
    private final ObjectMapper json;
    private final String secret;

    public LuluWebhookService(PrintOrderStatusService statusService, LuluJobStatusMapper mapper,
                              ObjectMapper json, @Value("${lulu.client-secret:}") String secret) {
        this.statusService = statusService;
        this.mapper = mapper;
        this.json = json;
        this.secret = secret;
    }

    /**
     * @throws SignatureException bad/absent/unverifiable signature — the controller maps this (and only this)
     *                            to 400. A forgery will never verify on retry, so there is nothing to retry.
     * @throws Exception          a validly-signed delivery we failed to process → 500, so Lulu retries. Safe:
     *                            {@link PrintOrderStatusService#applyJobUpdate} is idempotent.
     */
    public void handle(String payload, String signature) throws Exception {
        verify(payload, signature);

        JsonNode root = json.readTree(payload);
        String topic = root.path("topic").asText(null);
        if (topic != null && !TOPIC_PRINT_JOB_STATUS_CHANGED.equals(topic)) {
            log.debug("Ignoring Lulu webhook topic {}.", topic);
            return;
        }
        // Documented shape is { topic, data: <print job> }; fall back to the root so a bare print-job body
        // (or a differently-wrapped test delivery) still gets read rather than silently dropped.
        JsonNode job = root.hasNonNull("data") ? root.path("data") : root;

        LuluJobStatusMapper.JobUpdate update = mapper.parse(job);
        if (!update.isActionable()) {
            log.info("Lulu webhook carried no print-job id (topic {}) — acknowledged, nothing to do.", topic);
            return;
        }
        statusService.applyJobUpdate(update);
    }

    /**
     * HMAC-SHA256 over the raw body, keyed on our Lulu API secret, compared in constant time.
     *
     * <p>Lulu's header is documented as the digest of the body but not as an explicit encoding, and our sandbox
     * account has never delivered one (sandbox jobs stop at UNPAID), so we accept the two encodings a digest is
     * ever sent as — lowercase hex and base64. Both are the same secret-derived bytes; accepting either widens
     * nothing an attacker could use, and the first real delivery pins which one Lulu actually sends.
     */
    private void verify(String payload, String signature) throws SignatureException {
        if (secret == null || secret.isBlank()) {
            // Refusing is the safe default: with no secret we cannot tell Lulu from anyone else on the internet.
            throw new SignatureException("Lulu webhook secret (lulu.client-secret) is not configured.");
        }
        if (signature == null || signature.isBlank()) {
            throw new SignatureException("Missing Lulu-HMAC-SHA256 header.");
        }
        byte[] digest = hmac(payload);
        String presented = signature.trim();
        boolean ok = constantTimeEquals(presented, HexFormat.of().formatHex(digest))
                  || constantTimeEquals(presented, Base64.getEncoder().encodeToString(digest));
        if (!ok) {
            throw new SignatureException("Lulu-HMAC-SHA256 did not match the body.");
        }
    }

    private byte[] hmac(String payload) throws SignatureException {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new SignatureException("Could not compute the Lulu webhook HMAC: " + e.getMessage());
        }
    }

    /** Case-insensitive for hex, exact for base64; {@link MessageDigest#isEqual} for the timing-safe compare. */
    private static boolean constantTimeEquals(String presented, String expected) {
        byte[] a = presented.getBytes(StandardCharsets.UTF_8);
        byte[] b = expected.getBytes(StandardCharsets.UTF_8);
        if (MessageDigest.isEqual(a, b)) return true;
        return MessageDigest.isEqual(presented.toLowerCase().getBytes(StandardCharsets.UTF_8), b);
    }

    /** A delivery we could not authenticate — the controller's ONLY 4xx case. */
    public static class SignatureException extends Exception {
        public SignatureException(String message) { super(message); }
    }
}
