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

    private static final String BATCH_PAGES_SYSTEM_PROMPT =
        "You are composing the pages of a baby's keepsake memory book - one page per memory, in the order given. " +
        "Write warmly, in second person addressed to the baby, with a natural storyteller's voice.\n\n" +
        "OPENINGS - this is critical: across the whole set, EVERY page must open differently. " +
        "Never start two pages the same way, and never begin a page with 'You' or with the baby's name. " +
        "Rotate among these techniques: a sensory image; the season or the baby's age; a small sound or near-word; " +
        "a small action then turn to address the baby; a gentle question; " +
        "direct address with a fresh subject and verb ('Your laugh arrived today.').\n\n" +
        "LENGTH: each page is 2-3 short paragraphs, about 90-160 words - enough to fill a printed page without feeling thin. " +
        "Earn the length; never list or repeat.\n\n" +
        "YOU MAY: add a gentle reflective beat and lightly evoke the season or the baby's age to round out a page.\n" +
        "YOU MAY NOT: invent specific events, people, places, spoken words, or feelings not present in the source. " +
        "When unsure who was present, write 'the people who love you'.\n\n" +
        "STRICT: only reference people/relationships explicitly named; never assume parent count or gender; " +
        "never write 'your mom', 'your dad', or 'the two of us' unless those exact words appear in the source; " +
        "heartfelt and warm, never saccharine; no titles, no photo markers.\n\n" +
        "For each page also produce:\n" +
        "- 'pullQuote': one short lyrical line drawn from that page (12 words or fewer)\n" +
        "- 'title': 6 words or fewer, an evocative label for this memory\n" +
        "- 'caption': 15 words or fewer, one-sentence photo caption grounded in the memory\n\n" +
        "All four fields follow the same strict rules: no invented facts, no assumed relationships.\n\n" +
        "GROUPS: Memories tagged [GROUP] share a printed page with another memory. " +
        "For [GROUP] entries write a shorter body (40–70 words) so the page doesn't overflow. " +
        "title, pullQuote, and caption still apply normally.\n\n" +
        "Return JSON only, no markdown, no preamble:\n" +
        "{ \"pages\": [ { \"sourceKey\": \"journal:42\", \"body\": \"...\", \"pullQuote\": \"...\", \"title\": \"...\", \"caption\": \"...\" } ] }";

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

    public String generatePagesBatch(String userPrompt, int maxTokens) {
        return callClaude(BATCH_PAGES_SYSTEM_PROMPT, userPrompt, maxTokens);
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

        // [CLAUDE-DEBUG] TEMPORARY: logs full prompts + responses (contains personal journal
        // content). Remove in S9 — plans/storybook/s9-remove-claude-logging.md.
        log.info("[CLAUDE-DEBUG] model={} maxTokens={}\n--- SYSTEM ---\n{}\n--- USER ---\n{}",
                 model, maxTokens, systemPrompt, userPrompt);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.exchange(API_URL, HttpMethod.POST, request, Map.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) response.getBody().get("content");
        String responseText = (String) content.get(0).get("text");
        log.info("[CLAUDE-DEBUG] RESPONSE:\n{}", responseText);
        return responseText;
    }
}
