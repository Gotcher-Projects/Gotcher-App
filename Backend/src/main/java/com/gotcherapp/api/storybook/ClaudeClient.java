package com.gotcherapp.api.storybook;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Component
public class ClaudeClient {

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private static final Logger log = LoggerFactory.getLogger(ClaudeClient.class);

    @Value("${anthropic.api.key}")
    private String apiKey;

    @Value("${anthropic.model}")
    private String model;

    @Value("${anthropic.temperature:0.3}")
    private double temperature;

    private final RestTemplate restTemplate;

    public ClaudeClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    // True only when an API key is configured. Lets callers surface a clean "AI unavailable"
    // instead of charging a credit and then failing the HTTP call.
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    // Single-shot text generation for the per-field "write this for me" assist (sv2-s10).
    // The caller owns both prompts; this only performs the HTTP call and returns the text.
    public String generateText(String systemPrompt, String userPrompt, int maxTokens) {
        return callClaude(systemPrompt, userPrompt, maxTokens);
    }

    private String callClaude(String systemPrompt, String userPrompt, int maxTokens) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("ANTHROPIC_API_KEY is not configured");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", ANTHROPIC_VERSION);

        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", maxTokens,
            "temperature", temperature,
            "system", systemPrompt,
            "messages", List.of(
                Map.of("role", "user", "content", userPrompt)
            )
        );

        // Deliberately do NOT log the prompt or response — they carry personal family content.
        log.info("Claude call model={} maxTokens={}", model, maxTokens);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.exchange(API_URL, HttpMethod.POST, request, Map.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) response.getBody().get("content");
        return (String) content.get(0).get("text");
    }
}
