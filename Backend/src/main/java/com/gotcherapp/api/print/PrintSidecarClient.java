package com.gotcherapp.api.print;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Print pr3 — HTTP client for the pr1 Node/Puppeteer sidecar. POSTs a print-route URL to {@code /render} and
 * gets back PDF bytes. Uses its OWN RestTemplate with a generous read timeout (a full-book render is seconds,
 * but headroom avoids a spurious timeout), independent of the shared app RestTemplate.
 */
@Component
public class PrintSidecarClient {

    private final RestTemplate rest;
    private final String sidecarUrl;

    public PrintSidecarClient(
            @Value("${app.print.sidecar-url}") String sidecarUrl,
            @Value("${app.print.render-timeout-ms:120000}") int renderTimeoutMs) {
        this.sidecarUrl = sidecarUrl.replaceAll("/+$", "");
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(renderTimeoutMs);
        this.rest = new RestTemplate(factory);
    }

    /**
     * Render {@code url} to a PDF via the sidecar. {@code waitForSelector} is the readiness marker the print
     * route sets once fonts + images have settled ([data-print-ready="true"]).
     *
     * @throws IllegalStateException the sidecar returned a non-PDF (surfaced as a handled error upstream)
     */
    public byte[] render(String url, String waitForSelector, int timeoutMs) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(java.util.List.of(MediaType.APPLICATION_PDF, MediaType.ALL));

        Map<String, Object> body = Map.of(
            "url", url,
            "waitForSelector", waitForSelector,
            "timeoutMs", timeoutMs);

        ResponseEntity<byte[]> resp = rest.exchange(
            sidecarUrl + "/render", HttpMethod.POST, new HttpEntity<>(body, headers), byte[].class);

        byte[] pdf = resp.getBody();
        if (pdf == null || pdf.length < 5
                || pdf[0] != '%' || pdf[1] != 'P' || pdf[2] != 'D' || pdf[3] != 'F') {
            throw new IllegalStateException("Sidecar did not return a PDF");
        }
        return pdf;
    }
}
