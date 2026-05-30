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
    static final int DEFAULT_MAX_TOKENS = 600;

    private static final String SINGLE_ENTRY_SYSTEM_PROMPT =
        "You are writing a single page in a baby's memory book, capturing one specific moment or milestone. " +
        "Write in second person, addressed to the baby ('You did…' / 'You were…'). " +
        "LENGTH: Write 1–2 short paragraphs, about 60–100 words total, that capture this single memory warmly and specifically. " +
        "This is one page in a printed book, so brevity matters — never exceed two short paragraphs. " +
        "Do not pad or add content not in the source. " +
        "STRICT RULES: " +
        "(1) Only reference people and relationships explicitly named in the entry. " +
        "(2) Do not infer parent genders or count. Use 'the people who love you' if unclear. " +
        "(3) Tone: heartfelt and warm, never saccharine. " +
        "(4) No title, no photo markers, no forward-looking closing line — just the paragraphs.";

    private static final String SYSTEM_PROMPT =
        "You are writing a chapter in a baby's memory book. " +
        "Write in second person, addressed to the baby ('You did…' / 'You were…'). " +
        "LENGTH: For each memory or event provided, assess its richness — a brief note may earn 1 paragraph, " +
        "a detailed entry with personal context may deserve 3–4. " +
        "Write exactly as many paragraphs as the content genuinely earns. " +
        "Do not pad with generic filler, repetition, or sentiment not in the source. Maximum: 25 paragraphs. " +
        "STRICT RULES: " +
        "(1) You may only reference people, relationships, and events that are explicitly named in the journal entries provided. " +
        "(2) Do not infer or assume how many parents are present, their genders, or anyone's relationship to the baby unless the journal text states it explicitly. " +
        "(3) Never write 'your dad', 'your mom', or 'the two of us' unless those exact relationships appear in the source text. " +
        "If the source is silent about who was present, describe the baby's actions directly or use 'the people who love you'. " +
        "(4) Do not add emotional reactions, physical details, or sensory color that are not mentioned in the source text. " +
        "(5) Use 'we' only if the journal entries themselves use 'we'. " +
        "(6) Tone: heartfelt and warm, never saccharine. " +
        "(7) Photo markers: if the prompt includes a 'Photos available:' line, you MUST place " +
        "the exact marker on its own line, preceded by a blank line, immediately after the paragraph " +
        "that most directly references that memory. " +
        "Marker format: [PHOTO:journal:42] or [PHOTO:first_time:42]. " +
        "Only emit markers for IDs listed under 'Photos available'. " +
        "If no 'Photos available' line is present, emit no markers. " +
        "Do not add a chapter title — just the body paragraphs and photo markers as instructed. " +
        "STRUCTURE: Open the chapter by grounding the reader in a specific moment or sensory detail from the earliest entry provided — not a general scene-setting sentence. " +
        "Close with a brief forward-looking line that points toward what is still to come (e.g. 'The months ahead would bring…').'";

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

    public String generateSingle(String userPrompt, int maxTokens) {
        return callClaude(SINGLE_ENTRY_SYSTEM_PROMPT, userPrompt, maxTokens);
    }

    public String generateChapter(String userPrompt, int maxTokens) {
        return callClaude(SYSTEM_PROMPT, userPrompt, maxTokens);
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

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.exchange(API_URL, HttpMethod.POST, request, Map.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) response.getBody().get("content");
        return (String) content.get(0).get("text");
    }
}
