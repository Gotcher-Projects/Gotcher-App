package com.gotcherapp.api.storybook;

import com.gotcherapp.api.storybook.dto.AssistFieldRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.function.Function;

// Per-field "✨ write this for me" assist (sv2-s10) — the ONLY AI surface in v2. It words a single
// text field the user already has; it never creates pages or book structure. Gated purely on the
// credit balance (1 credit per call) — NOT on subscription tier. Credits are the unit we sell
// (e.g. a one-time "20 credits for $2" pack); anyone with ≥1 credit can use it, 0 credits → buy more.
@Service
public class AiAssistService {

    private final JdbcTemplate jdbc;
    private final ClaudeClient claudeClient;

    public AiAssistService(JdbcTemplate jdbc, ClaudeClient claudeClient) {
        this.jdbc = jdbc;
        this.claudeClient = claudeClient;
    }

    // Shared voice + guardrails for every field. The per-field user prompt (below) supplies specifics.
    private static final String SYSTEM_PROMPT =
        "You help a parent word one short passage for a baby's keepsake memory book. " +
        "Return ONLY the reworded passage — no preamble, no options list, no surrounding quotes, no markdown. " +
        "Warm and heartfelt, never saccharine. " +
        "STRICT: never invent facts, events, people, places, spoken words, or feelings not present in the " +
        "parent's notes; never assume the number or gender of parents; only reference relationships the " +
        "notes explicitly name. If the notes are sparse, keep it short rather than inventing detail.";

    public String assistField(Long userId, AssistFieldRequest req) {
        if (req == null || req.promptType() == null || req.promptType().isBlank()) {
            throw new IllegalArgumentException("promptType is required");
        }
        Function<Map<String, String>, String> builder = PROMPTS.get(req.promptType());
        if (builder == null) {
            throw new IllegalArgumentException("Unknown promptType: " + req.promptType());
        }
        if (!claudeClient.isConfigured()) {
            throw new IllegalStateException("AI writing help is not available right now");
        }

        Map<String, String> ctx = req.context() != null ? req.context() : Map.of();
        String userPrompt = builder.apply(ctx);

        // Optional reshape modifier (server-whitelisted): the UI's "reshape chips" re-run a draft
        // biased shorter / warmer / more detailed. Only known keys are honored — the client can't
        // inject a free-form instruction.
        String reshape = RESHAPE.get(orBlank(ctx.get("reshape")));
        if (reshape != null) userPrompt = userPrompt + " " + reshape;

        // Gate purely on credits (no tier check): charge one credit up front, atomically. The
        // conditional WHERE both gates and decrements in a single statement so concurrent calls can't
        // overspend (TOCTOU-safe). Zero rows affected → the user is out of credits.
        int charged = jdbc.update(
            "UPDATE users SET ai_credits_remaining = ai_credits_remaining - 1 " +
            "WHERE id = ? AND ai_credits_remaining >= 1", userId);
        if (charged == 0) {
            throw new StorybookService.InsufficientCreditsException("Not enough credits — you need 1 credit");
        }

        // Charge-then-refund: the credit was debited before the external call, so any failure must
        // refund it — a failed assist never costs the user a credit.
        String text;
        try {
            text = claudeClient.generateText(SYSTEM_PROMPT, userPrompt, 1024);
        } catch (Exception e) {
            refundCredit(userId);
            throw new RuntimeException("AI writing help failed: " + e.getMessage(), e);
        }

        // The call succeeded (200) but the content may be unusable — empty, or a refusal like "I can't
        // write this for a parent without a note." That is NOT a real draft, so we must NOT charge for
        // it or offer it as something the user can accept. Refund the credit and surface a helpful error
        // (sv2-s10b: refusals were being charged and were acceptable in the review box).
        String trimmed = text != null ? text.trim() : "";
        if (trimmed.isEmpty() || looksLikeRefusal(trimmed)) {
            refundCredit(userId);
            throw new AssistUnavailableException("The AI couldn't draft that — try adding a note first, then let it help.");
        }
        return trimmed;
    }

    private void refundCredit(Long userId) {
        jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining + 1 WHERE id = ?", userId);
    }

    // A conservative refusal/meta detector: these phrases essentially never open a heartfelt keepsake
    // passage (note "i can't wait" is deliberately NOT matched — it's a valid letter line). Checked
    // only against the start of the text, where refusals lead.
    private static boolean looksLikeRefusal(String text) {
        String head = text.toLowerCase();
        if (head.length() > 90) head = head.substring(0, 90);
        return head.contains("i can't write") || head.contains("i cannot write")
            || head.contains("i can't create") || head.contains("i cannot create")
            || head.contains("i can't help") || head.contains("i cannot help")
            || head.contains("i'm unable") || head.contains("i am unable")
            || head.contains("as an ai")
            || head.contains("without a note") || head.contains("without any note")
            || head.contains("without more");
    }

    // Thrown when the model responds but the content isn't a usable draft (empty / refusal). Mapped to
    // 422 by the controller so the field shows the message and offers nothing to accept.
    public static class AssistUnavailableException extends RuntimeException {
        public AssistUnavailableException(String message) { super(message); }
    }

    // Server-owned prompt registry keyed by promptType. The client cannot send arbitrary prompts —
    // it supplies only structured context values, which are woven into these controlled templates.
    private static final Map<String, Function<Map<String, String>, String>> PROMPTS = Map.of(
        "letter", ctx -> {
            String baby = orDefault(ctx.get("babyName"), "the baby");
            String parent = orDefault(ctx.get("parentName"), "a parent");
            return "Write a heartfelt letter from " + parent + " to their baby " + baby + ". " +
                   "First person, warm and personal, 2-3 short paragraphs. " +
                   notesClause(orBlank(ctx.get("seedText")));
        },
        "birth_note", ctx -> {
            String baby = orDefault(ctx.get("babyName"), "the baby");
            return "Write a short warm note (2-4 sentences) for " + baby + "'s birth-day page. " +
                   notesClause(orBlank(ctx.get("seedText")));
        },
        "bio", ctx -> {
            String name = orDefault(ctx.get("name"), "this person");
            String role = orBlank(ctx.get("role"));
            return "Write a short warm bio (2-3 sentences) for " + name +
                   (role.isBlank() ? "" : ", the baby's " + role) + ", for a family page. " +
                   notesClause(orBlank(ctx.get("seedText")));
        },
        "first_note", ctx -> {
            String baby = orDefault(ctx.get("babyName"), "the baby");
            String label = orBlank(ctx.get("label"));
            return "Write a short warm note (2-4 sentences) about " + baby + "'s first " +
                   (label.isBlank() ? "moment" : label) + ". " +
                   notesClause(orBlank(ctx.get("seedText")));
        },
        "bump_note", ctx ->
            "Gently tidy and lightly expand this pregnancy-diary note into 2-3 warm sentences, " +
            "keeping the parent's meaning. " + notesClause(orBlank(ctx.get("seedText"))),
        "journal", ctx -> {
            String baby = orDefault(ctx.get("babyName"), "the baby");
            String title = orBlank(ctx.get("title"));
            return "Write a short warm journal entry (2-4 sentences) about a moment with " + baby +
                   (title.isBlank() ? "" : " (\"" + title + "\")") + ". " +
                   notesClause(orBlank(ctx.get("seedText")));
        }
    );

    // Server-whitelisted reshape instructions appended when the UI's reshape chips are used.
    private static final Map<String, String> RESHAPE = Map.of(
        "shorter",     "Make this noticeably shorter and more concise.",
        "warmer",      "Make the tone a little warmer and more affectionate, without adding any new facts.",
        "more_detail", "Add a little more descriptive detail, but introduce no facts beyond the parent's notes."
    );

    private static String notesClause(String seed) {
        return seed.isBlank()
            ? "The parent has not written notes yet, so keep it brief and general — do not invent specifics."
            : "Base it on the parent's own notes and add no facts beyond them: " + seed;
    }

    private static String orDefault(String v, String d) { return (v == null || v.isBlank()) ? d : v; }
    private static String orBlank(String v) { return v == null ? "" : v; }
}
