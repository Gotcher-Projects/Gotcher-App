package com.gotcherapp.api.storybook;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.storybook.dto.ChapterResponse;
import com.gotcherapp.api.storybook.dto.GeneratedPageResponse;
import com.gotcherapp.api.storybook.dto.UnlockRequest;
import com.gotcherapp.api.storybook.dto.UpdateChapterRequest;
import com.gotcherapp.api.storybook.dto.WizardRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StorybookService {

    // All chapter columns — used in every SELECT / RETURNING to keep mapRow() consistent.
    private static final String CHAPTER_COLS =
        "id, anchor_type, anchor_key, anchor_label, period_start_weeks, period_end_weeks, " +
        "sort_order, body, status, image_url, generated_at, published_at, created_at, updated_at, " +
        "wizard_journal_ids, wizard_first_time_ids, supplementary_notes, photo_overrides, wizard_entry_notes, layout_data";

    // Mirrors MILESTONES in Frontend/src/lib/babyData.js — used to decode DB keys (e.g. "8-2")
    // into human-readable labels for the Claude prompt. Keep in sync if labels change.
    private static final Map<Integer, String[]> MILESTONE_LABELS = Map.ofEntries(
        Map.entry(0,  new String[]{"Turns toward voices", "Lifts head during tummy time", "High contrast patterns"}),
        Map.entry(4,  new String[]{"Social smiling", "Tracks objects side to side", "Brings hands to mouth"}),
        Map.entry(8,  new String[]{"Coos and babbles", "Better head control", "Kicks and stretches"}),
        Map.entry(12, new String[]{"Laughs out loud", "Holds head steady", "Grasps toys and shakes them"}),
        Map.entry(16, new String[]{"Rolls tummy to back", "Reaches for objects", "Brings feet to hands"}),
        Map.entry(20, new String[]{"Rolls both ways", "Responds to name", "Babbles ba-da sounds"}),
        Map.entry(24, new String[]{"Sits with support", "Transfers objects hand to hand", "Explores with mouth"}),
        Map.entry(28, new String[]{"Sits without support", "Bears weight on legs", "Object permanence begins"}),
        Map.entry(32, new String[]{"Army crawls or pivots", "Stranger awareness", "Imitates sounds"}),
        Map.entry(36, new String[]{"Crawls on hands/knees", "Pulls to stand", "Plays peek-a-boo"}),
        Map.entry(40, new String[]{"Cruises along furniture", "Pincer grasp", "Says mama/dada"}),
        Map.entry(44, new String[]{"Stands alone briefly", "Understands gestures", "Drops objects on purpose"}),
        Map.entry(48, new String[]{"Takes first steps", "Says 1-2 words with meaning", "Claps and waves"})
    );

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;
    private final ClaudeClient claudeClient;
    private final ObjectMapper objectMapper;

    public StorybookService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository,
                            ClaudeClient claudeClient, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
        this.claudeClient = claudeClient;
        this.objectMapper = objectMapper;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public List<ChapterResponse> findAll(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT " + CHAPTER_COLS + " FROM storybook_chapters WHERE baby_profile_id = ? " +
            "ORDER BY COALESCE(sort_order, 999999), created_at",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    // ── Unlock ────────────────────────────────────────────────────────────────

    public ChapterResponse unlock(Long userId, UnlockRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        validateUnlockRequest(req);

        List<Map<String, Object>> existing = jdbc.queryForList(
            "SELECT " + CHAPTER_COLS + " FROM storybook_chapters " +
            "WHERE baby_profile_id = ? AND anchor_type = ? AND anchor_key = ?",
            profileId, req.anchorType(), req.anchorKey()
        );
        if (!existing.isEmpty()) return mapRow(existing.get(0));

        String imageUrl = req.imageUrl();
        if (imageUrl == null && "milestone".equals(req.anchorType())) {
            int week = Integer.parseInt(req.anchorKey().split("-")[0]);
            List<Map<String, Object>> imgRows = jdbc.queryForList(
                "SELECT image_url FROM journal_entries WHERE baby_profile_id = ? " +
                "AND image_url IS NOT NULL AND ABS(week - ?) <= 3 ORDER BY ABS(week - ?) LIMIT 1",
                profileId, week, week
            );
            if (!imgRows.isEmpty()) imageUrl = (String) imgRows.get(0).get("image_url");
        }
        if (imageUrl == null && "period".equals(req.anchorType())) {
            List<Map<String, Object>> imgRows = jdbc.queryForList(
                "SELECT image_url FROM journal_entries WHERE baby_profile_id = ? " +
                "AND image_url IS NOT NULL AND week >= ? AND week <= ? ORDER BY entry_date LIMIT 1",
                profileId, req.periodStartWeeks(), req.periodEndWeeks()
            );
            if (!imgRows.isEmpty()) imageUrl = (String) imgRows.get(0).get("image_url");
        }

        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO storybook_chapters " +
            "(baby_profile_id, anchor_type, anchor_key, anchor_label, period_start_weeks, period_end_weeks, image_url, status) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'unlocked') " +
            "RETURNING " + CHAPTER_COLS,
            profileId, req.anchorType(), req.anchorKey(), req.anchorLabel(),
            req.periodStartWeeks(), req.periodEndWeeks(), imageUrl
        );
        return mapRow(row);
    }

    private void validateUnlockRequest(UnlockRequest req) {
        if (req.anchorType() == null || req.anchorKey() == null || req.anchorLabel() == null) {
            throw new IllegalArgumentException("anchorType, anchorKey, and anchorLabel are required");
        }
        if ("period".equals(req.anchorType()) && (req.periodStartWeeks() == null || req.periodEndWeeks() == null)) {
            throw new IllegalArgumentException("periodStartWeeks and periodEndWeeks are required for period chapters");
        }
        if (!Set.of("milestone", "first_time", "period").contains(req.anchorType())) {
            throw new IllegalArgumentException("anchorType must be 'milestone', 'first_time', or 'period'");
        }
    }

    // ── Generate ──────────────────────────────────────────────────────────────

    public ChapterResponse generate(Long userId, Long chapterId) {
        Map<String, Object> user = jdbc.queryForMap(
            "SELECT tier, ai_credits_remaining FROM users WHERE id = ?", userId
        );
        String tier = (String) user.get("tier");
        int credits = ((Number) user.get("ai_credits_remaining")).intValue();

        if ("free".equals(tier)) throw new ForbiddenException("Upgrade to Plus to generate chapters");
        if (credits <= 0) throw new InsufficientCreditsException("No AI credits remaining this month");

        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new ForbiddenException("No baby profile found");

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, anchor_type, anchor_key, anchor_label, period_start_weeks, period_end_weeks, " +
            "wizard_journal_ids, wizard_first_time_ids, supplementary_notes, wizard_entry_notes, photo_overrides " +
            "FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?",
            chapterId, profileId.get()
        );
        if (rows.isEmpty()) throw new NoSuchElementException("Chapter not found");
        Map<String, Object> chapter = rows.get(0);

        Map<String, Object> baby = jdbc.queryForMap(
            "SELECT baby_name, birthdate FROM baby_profiles WHERE id = ?", profileId.get()
        );

        List<Long> wizardJournalIds = parseIdsCsv(chapter.get("wizard_journal_ids"));
        List<Long> wizardFirstTimeIds = parseIdsCsv(chapter.get("wizard_first_time_ids"));
        String suppNotes = (String) chapter.get("supplementary_notes");
        Map<String, String> wizardEntryNotes = parseJsonMap(chapter.get("wizard_entry_notes"));
        int entryNotesCount = wizardEntryNotes != null ? wizardEntryNotes.size() : 0;
        int maxTokens = computeMaxTokens(wizardJournalIds, wizardFirstTimeIds,
            suppNotes != null && !suppNotes.isBlank(), entryNotesCount);

        jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining - 1 WHERE id = ?", userId);

        String generatedBody;
        try {
            String prompt = buildPrompt(chapter, baby, profileId.get());
            generatedBody = claudeClient.generateChapter(prompt, maxTokens);
        } catch (Exception e) {
            jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining + 1 WHERE id = ?", userId);
            throw new RuntimeException("Chapter generation failed: " + e.getMessage(), e);
        }

        Map<String, Object> updated = jdbc.queryForMap(
            "UPDATE storybook_chapters SET body = ?, status = 'draft', generated_at = NOW(), updated_at = NOW() " +
            "WHERE id = ? RETURNING " + CHAPTER_COLS,
            generatedBody, chapterId
        );
        return mapRow(updated);
    }

    // ── Wizard ────────────────────────────────────────────────────────────────

    public ChapterResponse wizard(Long userId, WizardRequest req) {
        if (req.anchorKey() == null || req.anchorLabel() == null
                || req.periodStartWeeks() == null || req.periodEndWeeks() == null) {
            throw new IllegalArgumentException("anchorKey, anchorLabel, periodStartWeeks, and periodEndWeeks are required");
        }
        if (req.selectedJournalIds() == null && req.selectedFirstTimeIds() == null) {
            throw new IllegalArgumentException("At least selectedJournalIds or selectedFirstTimeIds must be provided");
        }

        Long profileId = babyProfileRepository.requireProfileId(userId);

        Map<String, Object> baby = jdbc.queryForMap(
            "SELECT baby_name, birthdate FROM baby_profiles WHERE id = ?", profileId
        );

        boolean skip = Boolean.TRUE.equals(req.skipGeneration());
        if (!skip) {
            Map<String, Object> user = jdbc.queryForMap(
                "SELECT tier, ai_credits_remaining FROM users WHERE id = ?", userId
            );
            String tier = (String) user.get("tier");
            int credits = ((Number) user.get("ai_credits_remaining")).intValue();
            if ("free".equals(tier)) throw new ForbiddenException("Upgrade to Plus to generate chapters");
            if (credits <= 0) throw new InsufficientCreditsException("No AI credits remaining this month");
        }

        // Upsert the chapter row
        String journalIdsCsv = serializeIds(req.selectedJournalIds());
        String firstTimeIdsCsv = serializeIds(req.selectedFirstTimeIds());
        String photoOverridesJson = serializeJsonMap(req.photoOverrides());
        String entryNotesJson = serializeJsonMap(req.entryNotes());

        List<Map<String, Object>> existing = jdbc.queryForList(
            "SELECT id FROM storybook_chapters WHERE baby_profile_id = ? AND anchor_type = 'period' AND anchor_key = ?",
            profileId, req.anchorKey()
        );

        long chapterId;
        if (!existing.isEmpty()) {
            chapterId = ((Number) existing.get(0).get("id")).longValue();
            jdbc.update(
                "UPDATE storybook_chapters SET anchor_label = ?, wizard_journal_ids = ?, " +
                "wizard_first_time_ids = ?, supplementary_notes = ?, photo_overrides = ?, " +
                "wizard_entry_notes = ?, updated_at = NOW() WHERE id = ?",
                req.anchorLabel(), journalIdsCsv, firstTimeIdsCsv,
                req.supplementaryNotes(), photoOverridesJson, entryNotesJson, chapterId
            );
        } else {
            Map<String, Object> newRow = jdbc.queryForMap(
                "INSERT INTO storybook_chapters " +
                "(baby_profile_id, anchor_type, anchor_key, anchor_label, period_start_weeks, period_end_weeks, " +
                "wizard_journal_ids, wizard_first_time_ids, supplementary_notes, photo_overrides, wizard_entry_notes, status) " +
                "VALUES (?, 'period', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unlocked') RETURNING id",
                profileId, req.anchorKey(), req.anchorLabel(),
                req.periodStartWeeks(), req.periodEndWeeks(),
                journalIdsCsv, firstTimeIdsCsv, req.supplementaryNotes(), photoOverridesJson, entryNotesJson
            );
            chapterId = ((Number) newRow.get("id")).longValue();
        }

        if (skip) {
            List<Map<String, Object>> saved = jdbc.queryForList(
                "SELECT " + CHAPTER_COLS + " FROM storybook_chapters WHERE id = ?", chapterId
            );
            return mapRow(saved.get(0));
        }

        int entryNotesCount = req.entryNotes() != null
            ? (int) req.entryNotes().values().stream().filter(v -> v != null && !v.isBlank()).count() : 0;
        int maxTokens = computeMaxTokens(req.selectedJournalIds(), req.selectedFirstTimeIds(),
            req.supplementaryNotes() != null && !req.supplementaryNotes().isBlank(), entryNotesCount);

        jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining - 1 WHERE id = ?", userId);

        String generatedBody;
        try {
            String prompt = buildWizardPrompt(req, baby, profileId);
            generatedBody = claudeClient.generateChapter(prompt, maxTokens);
        } catch (Exception e) {
            jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining + 1 WHERE id = ?", userId);
            throw new RuntimeException("Chapter generation failed: " + e.getMessage(), e);
        }

        Map<String, Object> updated = jdbc.queryForMap(
            "UPDATE storybook_chapters SET body = ?, status = 'draft', generated_at = NOW(), updated_at = NOW() " +
            "WHERE id = ? RETURNING " + CHAPTER_COLS,
            generatedBody, chapterId
        );
        return mapRow(updated);
    }

    // ── Generate pages (paged mode) ───────────────────────────────────────────

    public List<GeneratedPageResponse> generatePages(Long userId, Long chapterId) {
        Map<String, Object> user = jdbc.queryForMap(
            "SELECT tier, ai_credits_remaining FROM users WHERE id = ?", userId
        );
        String tier = (String) user.get("tier");
        int credits = ((Number) user.get("ai_credits_remaining")).intValue();

        if ("free".equals(tier)) throw new ForbiddenException("Upgrade to Plus to generate chapters");

        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new ForbiddenException("No baby profile found");

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT wizard_journal_ids, wizard_first_time_ids, wizard_entry_notes " +
            "FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?",
            chapterId, profileId.get()
        );
        if (rows.isEmpty()) throw new NoSuchElementException("Chapter not found");
        Map<String, Object> chapter = rows.get(0);

        List<Long> journalIds = parseIdsCsv(chapter.get("wizard_journal_ids"));
        if (journalIds == null) journalIds = List.of();
        List<Long> firstTimeIds = parseIdsCsv(chapter.get("wizard_first_time_ids"));
        if (firstTimeIds == null) firstTimeIds = List.of();
        Map<String, String> entryNotes = parseJsonMap(chapter.get("wizard_entry_notes"));

        int totalEntries = journalIds.size() + firstTimeIds.size();
        if (totalEntries == 0) throw new IllegalArgumentException("No entries selected for this chapter");
        if (credits < totalEntries) {
            throw new InsufficientCreditsException(
                "Not enough credits — you need " + totalEntries + " credits for " + totalEntries + " pages"
            );
        }

        Map<String, Object> baby = jdbc.queryForMap(
            "SELECT baby_name FROM baby_profiles WHERE id = ?", profileId.get()
        );
        String babyName = (String) baby.get("baby_name");

        List<GeneratedPageResponse> results = new ArrayList<>();
        int creditsUsed = 0;

        for (Long id : journalIds) {
            jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining - 1 WHERE id = ?", userId);
            creditsUsed++;
            try {
                String prompt = buildSingleJournalPrompt(id, babyName, entryNotes);
                String body = claudeClient.generateSingle(prompt, 400);
                results.add(new GeneratedPageResponse("journal:" + id, body));
            } catch (Exception e) {
                int used = creditsUsed;
                jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining + ? WHERE id = ?", used, userId);
                throw new RuntimeException("Page generation failed: " + e.getMessage(), e);
            }
        }

        for (Long id : firstTimeIds) {
            jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining - 1 WHERE id = ?", userId);
            creditsUsed++;
            try {
                String prompt = buildSingleFirstTimePrompt(id, babyName, entryNotes);
                String body = claudeClient.generateSingle(prompt, 400);
                results.add(new GeneratedPageResponse("first_time:" + id, body));
            } catch (Exception e) {
                int used = creditsUsed;
                jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining + ? WHERE id = ?", used, userId);
                throw new RuntimeException("Page generation failed: " + e.getMessage(), e);
            }
        }

        return results;
    }

    private String buildSingleJournalPrompt(Long entryId, String babyName, Map<String, String> entryNotes) {
        Map<String, Object> entry = jdbc.queryForMap(
            "SELECT title, story, week FROM journal_entries WHERE id = ?", entryId
        );
        StringBuilder prompt = new StringBuilder();
        prompt.append("Baby: ").append(babyName != null ? babyName : "the baby").append("\n\n");
        prompt.append("Journal entry — Week ").append(entry.get("week")).append(": ").append(entry.get("title")).append("\n");
        if (entry.get("story") != null) prompt.append(entry.get("story")).append("\n");
        String note = entryNotes != null ? entryNotes.get("journal:" + entryId) : null;
        if (note != null && !note.isBlank()) prompt.append("\nParent's memory: ").append(note.trim()).append("\n");
        return prompt.toString();
    }

    private String buildSingleFirstTimePrompt(Long firstTimeId, String babyName, Map<String, String> entryNotes) {
        Map<String, Object> ft = jdbc.queryForMap(
            "SELECT label, notes FROM first_times WHERE id = ?", firstTimeId
        );
        StringBuilder prompt = new StringBuilder();
        prompt.append("Baby: ").append(babyName != null ? babyName : "the baby").append("\n\n");
        prompt.append("First time milestone: ").append(ft.get("label")).append("\n");
        if (ft.get("notes") != null) prompt.append("Notes: ").append(ft.get("notes")).append("\n");
        String note = entryNotes != null ? entryNotes.get("first_time:" + firstTimeId) : null;
        if (note != null && !note.isBlank()) prompt.append("\nParent's memory: ").append(note.trim()).append("\n");
        return prompt.toString();
    }

    // ── Prompt building ───────────────────────────────────────────────────────

    private String buildPrompt(Map<String, Object> chapter, Map<String, Object> baby, Long profileId) {
        String anchorType = (String) chapter.get("anchor_type");
        String anchorLabel = (String) chapter.get("anchor_label");
        String babyName = (String) baby.get("baby_name");
        Object birthdate = baby.get("birthdate");

        StringBuilder prompt = new StringBuilder();
        prompt.append("Baby: ").append(babyName != null ? babyName : "the baby").append("\n");

        List<Long> wizardJournalIds = parseIdsCsv(chapter.get("wizard_journal_ids"));
        List<Long> wizardFirstTimeIds = parseIdsCsv(chapter.get("wizard_first_time_ids"));
        String suppNotes = (String) chapter.get("supplementary_notes");
        Map<String, String> wizardEntryNotes = parseJsonMap(chapter.get("wizard_entry_notes"));
        boolean isWizard = wizardJournalIds != null;

        if ("period".equals(anchorType)) {
            int startWeeks = ((Number) chapter.get("period_start_weeks")).intValue();
            int endWeeks = ((Number) chapter.get("period_end_weeks")).intValue();
            prompt.append("Chapter: ").append(anchorLabel).append("\n");
            prompt.append("Time period: weeks ").append(startWeeks).append("–").append(endWeeks).append(" of life\n\n");

            if (isWizard) {
                Map<String, String> photoOverrides = parseJsonMap(chapter.get("photo_overrides"));
                appendMergedMemories(prompt, wizardJournalIds, wizardFirstTimeIds, wizardEntryNotes, photoOverrides);
                appendMilestonesContext(prompt, profileId, startWeeks, endWeeks, null, null);
                if (suppNotes != null && !suppNotes.isBlank()) {
                    prompt.append("Additional memories from the parent:\n").append(suppNotes).append("\n\n");
                }
            } else {
                appendPeriodContext(prompt, profileId, startWeeks, endWeeks, birthdate);
            }
        } else {
            prompt.append("Chapter anchor event: ").append(anchorLabel).append("\n\n");
            int anchorWeek = resolveAnchorWeek(chapter, profileId, birthdate);
            appendEventContext(prompt, profileId, anchorWeek, anchorLabel, anchorType, (String) chapter.get("anchor_key"));
        }

        return prompt.toString();
    }

    private String buildWizardPrompt(WizardRequest req, Map<String, Object> baby, Long profileId) {
        String babyName = (String) baby.get("baby_name");
        StringBuilder prompt = new StringBuilder();
        prompt.append("Baby: ").append(babyName != null ? babyName : "the baby").append("\n");
        prompt.append("Chapter: ").append(req.anchorLabel()).append("\n");
        prompt.append("Time period: weeks ").append(req.periodStartWeeks())
              .append("–").append(req.periodEndWeeks()).append(" of life\n\n");

        appendMergedMemories(prompt, req.selectedJournalIds(), req.selectedFirstTimeIds(),
                             req.entryNotes(), req.photoOverrides());
        appendMilestonesContext(prompt, profileId, req.periodStartWeeks(), req.periodEndWeeks(), null, null);

        if (req.supplementaryNotes() != null && !req.supplementaryNotes().isBlank()) {
            prompt.append("Additional memories from the parent:\n").append(req.supplementaryNotes()).append("\n\n");
        }

        return prompt.toString();
    }

    private int resolveAnchorWeek(Map<String, Object> chapter, Long profileId, Object birthdate) {
        String anchorType = (String) chapter.get("anchor_type");
        if ("milestone".equals(anchorType)) {
            String anchorKey = (String) chapter.get("anchor_key");
            return Integer.parseInt(anchorKey.split("-")[0]);
        } else {
            String anchorKey = (String) chapter.get("anchor_key");
            if (birthdate == null) return 0;
            List<Map<String, Object>> ftRows = jdbc.queryForList(
                "SELECT (occurred_date - ?::date) / 7.0 AS weeks_old " +
                "FROM first_times WHERE id = ? AND baby_profile_id = ?",
                birthdate.toString(), Long.parseLong(anchorKey), profileId
            );
            if (ftRows.isEmpty()) return 0;
            return ((Number) ftRows.get(0).get("weeks_old")).intValue();
        }
    }

    private void appendEventContext(StringBuilder prompt, Long profileId, int anchorWeek,
                                    String anchorLabel, String anchorType, String anchorKey) {
        int windowStart = Math.max(0, anchorWeek - 3);
        int windowEnd = anchorWeek + 3;
        appendJournalContext(prompt, profileId, windowStart, windowEnd, 5);
        appendFirstTimesContext(prompt, profileId, windowStart, windowEnd, anchorType, anchorKey);
        appendMilestonesContext(prompt, profileId, windowStart, windowEnd, anchorType, anchorKey);
    }

    private void appendPeriodContext(StringBuilder prompt, Long profileId,
                                     int startWeeks, int endWeeks, Object birthdate) {
        appendMergedPeriodContext(prompt, profileId, startWeeks, endWeeks);
        appendMilestonesContext(prompt, profileId, startWeeks, endWeeks, null, null);
    }

    private void appendJournalContext(StringBuilder prompt, Long profileId,
                                      int weekStart, int weekEnd, int limit) {
        List<Map<String, Object>> entries = jdbc.queryForList(
            "SELECT title, story, week, entry_date FROM journal_entries " +
            "WHERE baby_profile_id = ? AND week >= ? AND week <= ? " +
            "ORDER BY entry_date LIMIT ?",
            profileId, weekStart, weekEnd, limit
        );
        if (!entries.isEmpty()) {
            prompt.append("Journal entries from this time:\n");
            for (Map<String, Object> e : entries) {
                int week = ((Number) e.get("week")).intValue();
                prompt.append("- [Week ").append(week).append("] ").append(e.get("title"));
                if (e.get("story") != null) prompt.append(": ").append(e.get("story"));
                prompt.append("\n");
            }
            prompt.append("\n");
        }
    }

    private void appendJournalByIds(StringBuilder prompt, List<Long> ids, Map<String, String> entryNotes) {
        if (ids == null || ids.isEmpty()) return;
        String placeholders = ids.stream().map(id -> "?").collect(Collectors.joining(","));
        List<Map<String, Object>> entries = jdbc.queryForList(
            "SELECT id, title, story, week FROM journal_entries WHERE id IN (" + placeholders + ") ORDER BY entry_date",
            ids.toArray()
        );
        if (!entries.isEmpty()) {
            prompt.append("Journal entries from this time:\n");
            for (Map<String, Object> e : entries) {
                int week = ((Number) e.get("week")).intValue();
                long id = ((Number) e.get("id")).longValue();
                prompt.append("- [Week ").append(week).append("] ").append(e.get("title"));
                if (e.get("story") != null) prompt.append(": ").append(e.get("story"));
                String note = entryNotes != null ? entryNotes.get("journal:" + id) : null;
                if (note != null && !note.isBlank()) prompt.append(" [Parent's memory: ").append(note.trim()).append("]");
                prompt.append("\n");
            }
            prompt.append("\n");
        }
    }

    private void appendFirstTimesContext(StringBuilder prompt, Long profileId,
                                         int weekStart, int weekEnd,
                                         String excludeType, String excludeKey) {
        List<Map<String, Object>> firsts = jdbc.queryForList(
            "SELECT ft.label, ft.notes FROM first_times ft " +
            "JOIN baby_profiles bp ON bp.id = ft.baby_profile_id " +
            "WHERE ft.baby_profile_id = ? " +
            "AND (ft.occurred_date - bp.birthdate) / 7.0 BETWEEN ? AND ?" +
            ("first_time".equals(excludeType) ? " AND ft.id != " + excludeKey : "") +
            " ORDER BY ft.occurred_date",
            profileId, (double) weekStart, (double) weekEnd
        );
        if (!firsts.isEmpty()) {
            prompt.append("First times during this period:\n");
            for (Map<String, Object> f : firsts) {
                prompt.append("- ").append(f.get("label"));
                if (f.get("notes") != null) prompt.append(" (").append(f.get("notes")).append(")");
                prompt.append("\n");
            }
            prompt.append("\n");
        }
    }

    private void appendFirstTimesByIds(StringBuilder prompt, List<Long> ids, Map<String, String> entryNotes) {
        if (ids == null || ids.isEmpty()) return;
        String placeholders = ids.stream().map(id -> "?").collect(Collectors.joining(","));
        List<Map<String, Object>> firsts = jdbc.queryForList(
            "SELECT id, label, notes FROM first_times WHERE id IN (" + placeholders + ") ORDER BY occurred_date",
            ids.toArray()
        );
        if (!firsts.isEmpty()) {
            prompt.append("First times during this period:\n");
            for (Map<String, Object> f : firsts) {
                long id = ((Number) f.get("id")).longValue();
                prompt.append("- ").append(f.get("label"));
                if (f.get("notes") != null) prompt.append(" (").append(f.get("notes")).append(")");
                String note = entryNotes != null ? entryNotes.get("first_time:" + id) : null;
                if (note != null && !note.isBlank()) prompt.append(" [Parent's memory: ").append(note.trim()).append("]");
                prompt.append("\n");
            }
            prompt.append("\n");
        }
    }

    private void appendMergedMemories(StringBuilder prompt, List<Long> journalIds, List<Long> firstTimeIds,
                                      Map<String, String> entryNotes, Map<String, String> photoOverrides) {
        record MemItem(String date, String type, long id, String line, boolean hasPhoto, String photoLabel) {}
        List<MemItem> all = new ArrayList<>();

        if (journalIds != null && !journalIds.isEmpty()) {
            String ph = journalIds.stream().map(id -> "?").collect(Collectors.joining(","));
            jdbc.queryForList(
                "SELECT id, title, story, week, entry_date, image_url FROM journal_entries WHERE id IN (" + ph + ")",
                journalIds.toArray()
            ).forEach(e -> {
                long id = ((Number) e.get("id")).longValue();
                int week = ((Number) e.get("week")).intValue();
                String date = e.get("entry_date") != null ? e.get("entry_date").toString() : "";
                String title = (String) e.get("title");
                StringBuilder line = new StringBuilder("- [Week ").append(week).append("] ").append(title);
                if (e.get("story") != null) line.append(": ").append(e.get("story"));
                String note = entryNotes != null ? entryNotes.get("journal:" + id) : null;
                if (note != null && !note.isBlank()) line.append(" [Parent's memory: ").append(note.trim()).append("]");
                boolean hasPhoto = e.get("image_url") != null ||
                                   (photoOverrides != null && photoOverrides.containsKey("journal:" + id));
                all.add(new MemItem(date, "journal", id, line.toString(), hasPhoto,
                                    title != null ? title : "journal entry"));
            });
        }

        if (firstTimeIds != null && !firstTimeIds.isEmpty()) {
            String ph = firstTimeIds.stream().map(id -> "?").collect(Collectors.joining(","));
            jdbc.queryForList(
                "SELECT id, label, notes, occurred_date, image_url FROM first_times WHERE id IN (" + ph + ")",
                firstTimeIds.toArray()
            ).forEach(f -> {
                long id = ((Number) f.get("id")).longValue();
                String date = f.get("occurred_date") != null ? f.get("occurred_date").toString() : "";
                String label = (String) f.get("label");
                StringBuilder line = new StringBuilder("- ").append(label);
                if (f.get("notes") != null) line.append(" (").append(f.get("notes")).append(")");
                String note = entryNotes != null ? entryNotes.get("first_time:" + id) : null;
                if (note != null && !note.isBlank()) line.append(" [Parent's memory: ").append(note.trim()).append("]");
                boolean hasPhoto = f.get("image_url") != null ||
                                   (photoOverrides != null && photoOverrides.containsKey("first_time:" + id));
                all.add(new MemItem(date, "first_time", id, line.toString(), hasPhoto,
                                    label != null ? label : "first time"));
            });
        }

        if (all.isEmpty()) return;
        all.sort(Comparator.comparing(MemItem::date));

        prompt.append("Memories from this time:\n");
        List<String> photoHints = new ArrayList<>();
        for (MemItem item : all) {
            prompt.append(item.line()).append("\n");
            if (item.hasPhoto()) photoHints.add(item.type() + ":" + item.id() + " (" + item.photoLabel() + ")");
        }
        prompt.append("\n");

        if (!photoHints.isEmpty()) {
            prompt.append("Photos available: ").append(String.join(", ", photoHints)).append("\n\n");
        }
    }

    private void appendMergedPeriodContext(StringBuilder prompt, Long profileId, int weekStart, int weekEnd) {
        record MemItem(String date, String line) {}
        List<MemItem> all = new ArrayList<>();

        jdbc.queryForList(
            "SELECT title, story, week, entry_date FROM journal_entries " +
            "WHERE baby_profile_id = ? AND week >= ? AND week <= ? ORDER BY entry_date LIMIT 10",
            profileId, weekStart, weekEnd
        ).forEach(e -> {
            String date = e.get("entry_date") != null ? e.get("entry_date").toString() : "";
            int week = ((Number) e.get("week")).intValue();
            StringBuilder line = new StringBuilder("- [Week ").append(week).append("] ").append(e.get("title"));
            if (e.get("story") != null) line.append(": ").append(e.get("story"));
            all.add(new MemItem(date, line.toString()));
        });

        jdbc.queryForList(
            "SELECT ft.label, ft.notes, ft.occurred_date FROM first_times ft " +
            "JOIN baby_profiles bp ON bp.id = ft.baby_profile_id " +
            "WHERE ft.baby_profile_id = ? " +
            "AND (ft.occurred_date - bp.birthdate) / 7.0 BETWEEN ? AND ? " +
            "ORDER BY ft.occurred_date",
            profileId, (double) weekStart, (double) weekEnd
        ).forEach(f -> {
            String date = f.get("occurred_date") != null ? f.get("occurred_date").toString() : "";
            StringBuilder line = new StringBuilder("- ").append(f.get("label"));
            if (f.get("notes") != null) line.append(" (").append(f.get("notes")).append(")");
            all.add(new MemItem(date, line.toString()));
        });

        if (all.isEmpty()) return;
        all.sort(Comparator.comparing(MemItem::date));

        prompt.append("Memories from this time:\n");
        for (MemItem item : all) prompt.append(item.line()).append("\n");
        prompt.append("\n");
    }

    private void appendMilestonesContext(StringBuilder prompt, Long profileId,
                                         int weekStart, int weekEnd,
                                         String excludeType, String excludeKey) {
        List<Map<String, Object>> allMilestones = jdbc.queryForList(
            "SELECT milestone_key FROM milestones WHERE baby_profile_id = ?", profileId
        );
        List<String> inWindow = new ArrayList<>();
        for (Map<String, Object> m : allMilestones) {
            String key = (String) m.get("milestone_key");
            if ("milestone".equals(excludeType) && key.equals(excludeKey)) continue;
            try {
                int week = Integer.parseInt(key.split("-")[0]);
                if (week >= weekStart && week <= weekEnd) {
                    String label = decodeMilestoneKey(key);
                    if (label != null) inWindow.add(label);
                }
            } catch (NumberFormatException ignored) {}
        }
        if (!inWindow.isEmpty()) {
            prompt.append("Other milestones achieved around this time:\n");
            for (String label : inWindow) prompt.append("- ").append(label).append("\n");
            prompt.append("\n");
        }
    }

    private String decodeMilestoneKey(String key) {
        try {
            String[] parts = key.split("-");
            int week = Integer.parseInt(parts[0]);
            int idx = Integer.parseInt(parts[1]);
            String[] labels = MILESTONE_LABELS.get(week);
            if (labels != null && idx < labels.length) return labels[idx];
        } catch (Exception ignored) {}
        return null;
    }

    private int computeMaxTokens(List<Long> journalIds, List<Long> firstTimeIds, boolean hasNotes, int entryNotesCount) {
        if (journalIds == null) return ClaudeClient.DEFAULT_MAX_TOKENS;
        int tokens = 400
            + (journalIds.size() * 150)
            + (firstTimeIds != null ? firstTimeIds.size() * 100 : 0)
            + (hasNotes ? 200 : 0)
            + (entryNotesCount * 50);
        return Math.min(tokens, 3500);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public Optional<ChapterResponse> update(Long userId, Long chapterId, UpdateChapterRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (req.body() != null)                           { setClauses.add("body = ?");        params.add(req.body()); }
        if (req.status() != null)                         { setClauses.add("status = ?");      params.add(req.status()); }
        if (req.sortOrder() != null)                      { setClauses.add("sort_order = ?");  params.add(req.sortOrder()); }
        if (Boolean.TRUE.equals(req.clearLayoutData()))   { setClauses.add("layout_data = NULL"); }
        else if (req.layoutData() != null)                { setClauses.add("layout_data = ?"); params.add(serializeJsonObject(req.layoutData())); }

        if (req.status() != null && "published".equals(req.status())) {
            setClauses.add("published_at = NOW()");
        }

        if (setClauses.isEmpty()) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT " + CHAPTER_COLS + " FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?",
                chapterId, profileId.get()
            );
            return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
        }

        setClauses.add("updated_at = NOW()");
        params.add(chapterId);
        params.add(profileId.get());

        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE storybook_chapters SET " + String.join(", ", setClauses) +
            " WHERE id = ? AND baby_profile_id = ? RETURNING " + CHAPTER_COLS,
            params.toArray()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public boolean delete(Long userId, Long chapterId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?",
            chapterId, profileId.get()
        );
        return rows > 0;
    }

    // ── Share tokens ──────────────────────────────────────────────────────────

    public String getOrCreateShareToken(Long userId) {
        Map<String, Object> user = jdbc.queryForMap(
            "SELECT tier FROM users WHERE id = ?", userId
        );
        if ("free".equals(user.get("tier"))) {
            throw new ForbiddenException("Upgrade to Plus to share your book");
        }
        Long profileId = babyProfileRepository.requireProfileId(userId);
        List<Map<String, Object>> existing = jdbc.queryForList(
            "SELECT token FROM book_share_tokens WHERE baby_profile_id = ?", profileId
        );
        if (!existing.isEmpty()) return (String) existing.get(0).get("token");
        String token = generateSecureToken();
        jdbc.update(
            "INSERT INTO book_share_tokens (baby_profile_id, token) VALUES (?, ?)",
            profileId, token
        );
        return token;
    }

    public boolean revokeShareToken(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM book_share_tokens WHERE baby_profile_id = ?", profileId.get()
        );
        return rows > 0;
    }

    public Optional<PublicBookResponse> getPublicBook(String token) {
        List<Map<String, Object>> tokenRows = jdbc.queryForList(
            "SELECT baby_profile_id FROM book_share_tokens WHERE token = ?", token
        );
        if (tokenRows.isEmpty()) return Optional.empty();
        Long profileId = ((Number) tokenRows.get(0).get("baby_profile_id")).longValue();

        Map<String, Object> baby = jdbc.queryForMap(
            "SELECT baby_name FROM baby_profiles WHERE id = ?", profileId
        );
        String firstName = extractFirstName((String) baby.get("baby_name"));

        List<Map<String, Object>> chapters = jdbc.queryForList(
            "SELECT anchor_label, body, published_at FROM storybook_chapters " +
            "WHERE baby_profile_id = ? AND status = 'published' " +
            "ORDER BY COALESCE(sort_order, 999999), created_at",
            profileId
        );

        List<PublicChapter> publicChapters = chapters.stream().map(r -> new PublicChapter(
            (String) r.get("anchor_label"),
            (String) r.get("body"),
            r.get("published_at") != null ? r.get("published_at").toString() : null
        )).toList();

        return Optional.of(new PublicBookResponse(firstName, publicChapters));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String extractFirstName(String babyName) {
        if (babyName == null || babyName.isBlank()) return "Baby";
        return babyName.trim().split("\\s+")[0];
    }

    private String generateSecureToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    private List<Long> parseIdsCsv(Object raw) {
        if (raw == null) return null;
        String s = raw.toString().trim();
        if (s.isEmpty()) return List.of();
        return Arrays.stream(s.split(","))
            .map(String::trim)
            .filter(t -> !t.isEmpty())
            .map(Long::parseLong)
            .collect(Collectors.toList());
    }

    private String serializeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return null;
        return ids.stream().map(Object::toString).collect(Collectors.joining(","));
    }

    private Map<String, String> parseJsonMap(Object raw) {
        if (raw == null) return null;
        try {
            return objectMapper.readValue(raw.toString(), new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> parseJsonObject(Object raw) {
        if (raw == null) return null;
        try {
            return objectMapper.readValue(raw.toString(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private String serializeJsonMap(Map<String, String> map) {
        if (map == null || map.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return null;
        }
    }

    private String serializeJsonObject(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return null;
        }
    }

    // ── Row mapping ───────────────────────────────────────────────────────────

    private ChapterResponse mapRow(Map<String, Object> row) {
        return new ChapterResponse(
            ((Number) row.get("id")).longValue(),
            (String) row.get("anchor_type"),
            (String) row.get("anchor_key"),
            (String) row.get("anchor_label"),
            row.get("period_start_weeks") != null ? ((Number) row.get("period_start_weeks")).intValue() : null,
            row.get("period_end_weeks") != null ? ((Number) row.get("period_end_weeks")).intValue() : null,
            row.get("sort_order") != null ? ((Number) row.get("sort_order")).intValue() : null,
            (String) row.get("body"),
            (String) row.get("status"),
            (String) row.get("image_url"),
            row.get("generated_at") != null ? row.get("generated_at").toString() : null,
            row.get("published_at") != null ? row.get("published_at").toString() : null,
            row.get("created_at") != null ? row.get("created_at").toString() : null,
            row.get("updated_at") != null ? row.get("updated_at").toString() : null,
            parseIdsCsv(row.get("wizard_journal_ids")),
            parseIdsCsv(row.get("wizard_first_time_ids")),
            (String) row.get("supplementary_notes"),
            parseJsonMap(row.get("photo_overrides")),
            parseJsonMap(row.get("wizard_entry_notes")),
            parseJsonObject(row.get("layout_data"))
        );
    }

    // ── Inner response types ──────────────────────────────────────────────────

    public record PublicBookResponse(String babyFirstName, List<PublicChapter> chapters) {}
    public record PublicChapter(String anchorLabel, String body, String publishedAt) {}

    // ── Custom exceptions ─────────────────────────────────────────────────────

    public static class ForbiddenException extends RuntimeException {
        public ForbiddenException(String message) { super(message); }
    }

    public static class InsufficientCreditsException extends RuntimeException {
        public InsufficientCreditsException(String message) { super(message); }
    }
}
