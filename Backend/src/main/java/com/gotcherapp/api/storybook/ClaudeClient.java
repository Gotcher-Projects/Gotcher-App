package com.gotcherapp.api.storybook;

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
    private static final int MAX_TOKENS = 600;

    private static final String SYSTEM_PROMPT =
        "You are writing a chapter in a baby's memory book. " +
        "Write 2–3 paragraphs in second person, addressed to the baby ('You did…' / 'You were…'). " +
        "STRICT RULES: " +
        "(1) You may only reference people, relationships, and events that are explicitly named in the journal entries provided. " +
        "(2) Do not infer or assume how many parents are present, their genders, or anyone's relationship to the baby unless the journal text states it explicitly. " +
        "(3) Never write 'your dad', 'your mom', or 'the two of us' unless those exact relationships appear in the source text. " +
        "If the source is silent about who was present, describe the baby's actions directly or use 'the people who love you'. " +
        "(4) Do not add emotional reactions, physical details, or sensory color that are not mentioned in the source text. " +
        "(5) Use 'we' only if the journal entries themselves use 'we'. " +
        "(6) Tone: heartfelt and warm, never saccharine. " +
        "Do not add a chapter title — just the body paragraphs.";

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

    public String generateChapter(String userPrompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("ANTHROPIC_API_KEY is not configured");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", ANTHROPIC_VERSION);

        Map<String, Object> body = Map.of(
            "model", model,
            "max_tokens", MAX_TOKENS,
            "temperature", temperature,
            "system", SYSTEM_PROMPT,
            "messages", List.of(
                Map.of("role", "user", "content", userPrompt)
            )
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.exchange(API_URL, HttpMethod.POST, request, Map.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) response.getBody().get("content");
        return (String) content.get(0).get("text");
    }
}
