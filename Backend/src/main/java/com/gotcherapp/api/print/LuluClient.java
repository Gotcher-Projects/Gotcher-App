package com.gotcherapp.api.print;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Print pr5 — low-level Lulu Print API client: OAuth (client-credentials, token cached to its lifetime),
 * the cover-dimension calc, and the PAID print-job create/read. Sandbox-first ({@code lulu.api-base}).
 *
 * <p><b>Kill switch (deepest backstop).</b> {@link #createPrintJob} — the ONLY call that submits a paid job
 * Lulu charges the company card for — HARD-REFUSES when {@code app.print.enabled} is false: it throws before a
 * single byte reaches Lulu. pr7 (checkout) and pr8 (UI) add earlier gates, but even a request that somehow
 * reaches the client must not create a Lulu job when the feature is off. The read-only calls (token,
 * cover-dimensions, getPrintJob) are intentionally NOT gated.
 *
 * <p><b>Async.</b> Lulu accepts the create POST and fetches the {@code source_url}s server-side afterwards, so a
 * bad/unreachable PDF surfaces as a later job STATUS (ERROR/REJECTED), not a failed POST. {@link #createPrintJob}
 * therefore returns the job id + status; callers poll {@link #getPrintJob} and treat an error status as a handled
 * failure, not a crash.
 */
@Component
public class LuluClient {

    // Keycloak token endpoint (same realm lulu-verify.sh authenticates against).
    private static final String TOKEN_PATH = "/auth/realms/glasstree/protocol/openid-connect/token";
    private static final long TOKEN_SKEW_SECONDS = 60; // refresh a touch early so an in-flight call never 401s

    private final RestTemplate rest;
    private final String apiBase;
    private final String clientId;
    private final String clientSecret;
    private final boolean printEnabled;

    // Cached OAuth token (client-credentials grant); guarded by `this`.
    private String cachedToken;
    private Instant tokenExpiresAt = Instant.EPOCH;

    public LuluClient(
            @Value("${lulu.api-base:https://api.sandbox.lulu.com}") String apiBase,
            @Value("${lulu.client-id:}") String clientId,
            @Value("${lulu.client-secret:}") String clientSecret,
            @Value("${app.print.enabled:false}") boolean printEnabled) {
        this.apiBase = apiBase.replaceAll("/+$", "");
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.printEnabled = printEnabled;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        this.rest = new RestTemplate(factory);
    }

    /** Lulu's cover-dimension calc result for a SKU + page count (unit "inch"): the FULL wrap width/height. */
    public record CoverDimensions(double width, double height, String unit) {}

    /** One line item's async status within a print job. */
    public record LineItemStatus(Long id, String status) {}

    /** A created/fetched print job — just what we act on: the id, top-level status, and per-item statuses. */
    public record PrintJob(long id, String status, String externalId, List<LineItemStatus> lineItems) {}

    /**
     * Cover-dimension calc for {@code podPackageId} + interior page count (unit=inch). Read-only — NOT gated by
     * the kill switch. Returns the full outside-wrap width/height Lulu computes (bleed + both trim panels + spine).
     */
    public CoverDimensions coverDimensions(String podPackageId, int interiorPageCount) {
        Map<String, Object> body = Map.of(
            "pod_package_id", podPackageId,
            "interior_page_count", interiorPageCount,
            "unit", "inch");
        JsonNode n = exchange(HttpMethod.POST, "/cover-dimensions/", body);
        return new CoverDimensions(
            n.path("width").asDouble(),
            n.path("height").asDouble(),
            n.path("unit").asText("inch"));
    }

    /**
     * Submit a PAID print job (Lulu charges the company card on file). <b>Kill switch:</b> refuses with
     * {@link PrintDisabledException} when {@code app.print.enabled} is false — nothing is POSTed to Lulu. On
     * success returns the created job (async status; poll {@link #getPrintJob} for the fetch/print outcome).
     */
    public PrintJob createPrintJob(Map<String, Object> jobBody) {
        if (!printEnabled) {
            throw new PrintDisabledException(
                "Print is disabled (app.print.enabled=false) — refusing to submit a paid Lulu print job.");
        }
        return parseJob(exchange(HttpMethod.POST, "/print-jobs/", jobBody));
    }

    /** Fetch a print job's current status (poll the async validate → print flow). Read-only — NOT gated. */
    public PrintJob getPrintJob(long jobId) {
        return parseJob(getPrintJobRaw(jobId));
    }

    /**
     * The same fetch, unparsed. s14a-1's reconciliation sweep feeds this straight to
     * {@link LuluJobStatusMapper} — the mapper reads the line-item rejection messages and the shipped tracking
     * fields that {@link PrintJob} deliberately doesn't carry, and it must see the SAME shape the signed webhook
     * delivers or the two feeds would interpret a rejection differently. Read-only — NOT gated.
     */
    public JsonNode getPrintJobRaw(long jobId) {
        return exchange(HttpMethod.GET, "/print-jobs/" + jobId + "/", null);
    }

    private PrintJob parseJob(JsonNode n) {
        List<LineItemStatus> items = new ArrayList<>();
        for (JsonNode li : n.path("line_items")) {
            items.add(new LineItemStatus(
                li.hasNonNull("id") ? li.path("id").asLong() : null,
                li.path("status").path("name").asText(null)));
        }
        return new PrintJob(
            n.path("id").asLong(),
            n.path("status").path("name").asText(null),
            n.hasNonNull("external_id") ? n.path("external_id").asText() : null,
            items);
    }

    // ── HTTP plumbing ──────────────────────────────────────────────────────────────────────────────────

    /** One authenticated JSON exchange. {@code body} null for GET. Wraps Lulu 4xx/5xx as {@link LuluApiException}. */
    private JsonNode exchange(HttpMethod method, String path, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token());
        if (body != null) headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            return rest.exchange(apiBase + path, method, new HttpEntity<>(body, headers), JsonNode.class).getBody();
        } catch (RestClientResponseException e) {
            throw new LuluApiException("Lulu " + method + " " + path + " failed: HTTP "
                + e.getStatusCode().value() + " " + e.getResponseBodyAsString(), e);
        }
    }

    /** A valid access token, fetching + caching a fresh one (client-credentials) whenever the cache is expired. */
    private synchronized String token() {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiresAt)) {
            return cachedToken;
        }
        if (clientId.isBlank() || clientSecret.isBlank()) {
            throw new LuluApiException("Lulu credentials not configured (LULU_CLIENT_ID/SECRET blank).", null);
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(clientId, clientSecret);
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");
        try {
            JsonNode n = rest.exchange(apiBase + TOKEN_PATH, HttpMethod.POST,
                new HttpEntity<>(form, headers), JsonNode.class).getBody();
            String token = n == null ? null : n.path("access_token").asText(null);
            if (token == null) {
                throw new LuluApiException("Lulu token response had no access_token.", null);
            }
            long expiresIn = n.path("expires_in").asLong(300);
            cachedToken = token;
            tokenExpiresAt = Instant.now().plusSeconds(Math.max(0, expiresIn - TOKEN_SKEW_SECONDS));
            return token;
        } catch (RestClientResponseException e) {
            throw new LuluApiException("Lulu OAuth failed: HTTP "
                + e.getStatusCode().value() + " " + e.getResponseBodyAsString(), e);
        }
    }

    /** The print feature is off ({@code app.print.enabled=false}); a handled refusal, not a crash. */
    public static class PrintDisabledException extends RuntimeException {
        public PrintDisabledException(String message) { super(message); }
    }

    /** Any Lulu API / transport failure — surfaced as a handled error upstream (never a bare 500/401). */
    public static class LuluApiException extends RuntimeException {
        public LuluApiException(String message, Throwable cause) { super(message, cause); }
    }
}
