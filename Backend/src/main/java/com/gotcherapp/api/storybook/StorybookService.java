package com.gotcherapp.api.storybook;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.storybook.dto.ChapterResponse;
import com.gotcherapp.api.storybook.dto.GenerateGroupsRequest;
import com.gotcherapp.api.storybook.dto.GeneratedPageContent;
import com.gotcherapp.api.storybook.dto.GeneratedPageResponse;
import com.gotcherapp.api.storybook.dto.UnlockRequest;
import com.gotcherapp.api.storybook.dto.UpdateChapterRequest;
import com.gotcherapp.api.storybook.dto.WizardRequest;
import com.gotcherapp.api.upload.ImageUploadService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StorybookService {

    // All chapter columns — used in every SELECT / RETURNING to keep mapRow() consistent.
    private static final String CHAPTER_COLS =
        "id, anchor_type, anchor_key, anchor_label, period_start_weeks, period_end_weeks, " +
        "sort_order, body, status, image_url, generated_at, published_at, created_at, updated_at, " +
        "wizard_journal_ids, wizard_first_time_ids, supplementary_notes, photo_overrides, wizard_entry_notes, layout_data, chapter_photos, " +
        "generated_content";

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;
    private final ClaudeClient claudeClient;
    private final ObjectMapper objectMapper;
    private final ImageUploadService imageUploadService;

    public StorybookService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository,
                            ClaudeClient claudeClient, ObjectMapper objectMapper,
                            ImageUploadService imageUploadService) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
        this.claudeClient = claudeClient;
        this.objectMapper = objectMapper;
        this.imageUploadService = imageUploadService;
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

    // ── Reorder ───────────────────────────────────────────────────────────────

    public void reorderChapters(Long userId, List<Long> orderedIds) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        for (int i = 0; i < orderedIds.size(); i++) {
            jdbc.update(
                "UPDATE storybook_chapters SET sort_order = ?, updated_at = NOW() WHERE id = ? AND baby_profile_id = ?",
                i, orderedIds.get(i), profileId
            );
        }
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

    // ── Wizard ────────────────────────────────────────────────────────────────

    // Creates or updates the period chapter row from the wizard's memory selection.
    // Page content is produced separately by generatePages() (batched, per-page).
    public ChapterResponse wizard(Long userId, WizardRequest req) {
        if (req.anchorKey() == null || req.anchorLabel() == null
                || req.periodStartWeeks() == null || req.periodEndWeeks() == null) {
            throw new IllegalArgumentException("anchorKey, anchorLabel, periodStartWeeks, and periodEndWeeks are required");
        }
        if (req.selectedJournalIds() == null && req.selectedFirstTimeIds() == null) {
            throw new IllegalArgumentException("At least selectedJournalIds or selectedFirstTimeIds must be provided");
        }

        Long profileId = babyProfileRepository.requireProfileId(userId);

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

        List<Map<String, Object>> saved = jdbc.queryForList(
            "SELECT " + CHAPTER_COLS + " FROM storybook_chapters WHERE id = ?", chapterId
        );
        return mapRow(saved.get(0));
    }

    // ── Generate pages (paged mode) ───────────────────────────────────────────

    public List<GeneratedPageResponse> generatePages(Long userId, Long chapterId, GenerateGroupsRequest groupsReq) {
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

        // Build set of sourceKeys in multi-memory groups (get shorter body from AI)
        Set<String> multiGroupKeys = new HashSet<>();
        if (groupsReq != null && groupsReq.groups() != null) {
            for (GenerateGroupsRequest.PageGroup g : groupsReq.groups()) {
                if (g.sourceKeys() != null && g.sourceKeys().size() > 1) {
                    multiGroupKeys.addAll(g.sourceKeys());
                }
            }
        }

        // Charge one credit per page up front; the batched call still costs per-memory.
        jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining - ? WHERE id = ?",
            totalEntries, userId);

        String raw;
        try {
            String prompt = buildBatchPagesPrompt(journalIds, firstTimeIds, entryNotes, babyName, multiGroupKeys);
            int maxTokens = Math.min(800 + totalEntries * 320, 8000);
            raw = claudeClient.generatePagesBatch(prompt, maxTokens);
        } catch (Exception e) {
            jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining + ? WHERE id = ?",
                totalEntries, userId);
            throw new RuntimeException("Page generation failed: " + e.getMessage(), e);
        }

        try {
            JsonNode root = objectMapper.readTree(extractJson(raw));
            JsonNode pagesNode = root.get("pages");
            if (pagesNode == null || !pagesNode.isArray()) {
                throw new IllegalStateException("response had no 'pages' array");
            }
            Map<String, GeneratedPageContent> contentMap = new LinkedHashMap<>();
            List<GeneratedPageResponse> results = new ArrayList<>();
            for (JsonNode p : pagesNode) {
                String sourceKey = p.path("sourceKey").asText(null);
                String body = p.path("body").asText("");
                String pullQuote = p.path("pullQuote").asText(null);
                String title = p.path("title").asText(null);
                String caption = p.path("caption").asText(null);
                results.add(new GeneratedPageResponse(sourceKey, body, pullQuote, title, caption));
                if (sourceKey != null) {
                    contentMap.put(sourceKey, new GeneratedPageContent(body, pullQuote, title, caption));
                }
            }
            String contentJson = objectMapper.writeValueAsString(contentMap);
            jdbc.update("UPDATE storybook_chapters SET generated_content = ?::jsonb WHERE id = ?",
                contentJson, chapterId);
            return results;
        } catch (Exception e) {
            jdbc.update("UPDATE users SET ai_credits_remaining = ai_credits_remaining + ? WHERE id = ?",
                totalEntries, userId);
            throw new RuntimeException("Page generation failed: could not parse response — " + e.getMessage(), e);
        }
    }

    // Builds a single prompt listing every selected memory (date order) for the batched
    // page-generation call. Each memory is tagged with its sourceKey so the model echoes it back.
    private String buildBatchPagesPrompt(List<Long> journalIds, List<Long> firstTimeIds,
                                         Map<String, String> entryNotes, String babyName,
                                         Set<String> groupedKeys) {
        record MemItem(String date, String block) {}
        List<MemItem> all = new ArrayList<>();

        if (journalIds != null && !journalIds.isEmpty()) {
            String ph = journalIds.stream().map(id -> "?").collect(Collectors.joining(","));
            jdbc.queryForList(
                "SELECT id, title, story, week, entry_date FROM journal_entries WHERE id IN (" + ph + ")",
                journalIds.toArray()
            ).forEach(e -> {
                long id = ((Number) e.get("id")).longValue();
                int week = ((Number) e.get("week")).intValue();
                String date = e.get("entry_date") != null ? e.get("entry_date").toString() : "";
                String sourceKey = "journal:" + id;
                StringBuilder b = new StringBuilder();
                b.append("Memory — ").append(sourceKey);
                if (groupedKeys.contains(sourceKey)) b.append(" [GROUP]");
                b.append(" — Week ").append(week).append(": \"").append(e.get("title")).append("\"\n");
                if (e.get("story") != null) b.append(e.get("story")).append("\n");
                String note = entryNotes != null ? entryNotes.get(sourceKey) : null;
                if (note != null && !note.isBlank()) b.append("Parent's memory: ").append(note.trim()).append("\n");
                all.add(new MemItem(date, b.toString()));
            });
        }

        if (firstTimeIds != null && !firstTimeIds.isEmpty()) {
            String ph = firstTimeIds.stream().map(id -> "?").collect(Collectors.joining(","));
            jdbc.queryForList(
                "SELECT id, label, notes, occurred_date FROM first_times WHERE id IN (" + ph + ")",
                firstTimeIds.toArray()
            ).forEach(f -> {
                long id = ((Number) f.get("id")).longValue();
                String date = f.get("occurred_date") != null ? f.get("occurred_date").toString() : "";
                String sourceKey = "first_time:" + id;
                StringBuilder b = new StringBuilder();
                b.append("Memory — ").append(sourceKey);
                if (groupedKeys.contains(sourceKey)) b.append(" [GROUP]");
                b.append(" — \"").append(f.get("label")).append("\"\n");
                if (f.get("notes") != null) b.append(f.get("notes")).append("\n");
                String note = entryNotes != null ? entryNotes.get(sourceKey) : null;
                if (note != null && !note.isBlank()) b.append("Parent's memory: ").append(note.trim()).append("\n");
                all.add(new MemItem(date, b.toString()));
            });
        }

        all.sort(Comparator.comparing(MemItem::date));

        StringBuilder prompt = new StringBuilder();
        prompt.append("Baby: ").append(babyName != null ? babyName : "the baby").append("\n\n");
        prompt.append("Write one page for each memory below, in this order. ")
              .append("Use each memory's exact sourceKey in your output.\n\n");
        for (MemItem item : all) prompt.append(item.block()).append("\n");
        return prompt.toString();
    }

    // Pulls the JSON object out of a model response that may be wrapped in prose/fences.
    private static String extractJson(String s) {
        if (s == null) return "{}";
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        return (start >= 0 && end > start) ? s.substring(start, end + 1) : s;
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

    // ── Chapter photo upload ───────────────────────────────────────────────────

    public Map<String, Object> uploadChapterPhoto(Long chapterId, MultipartFile file, Long userId) throws Exception {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new ForbiddenException("No baby profile found");

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?",
            chapterId, profileId.get()
        );
        if (rows.isEmpty()) throw new NoSuchElementException("Chapter not found");

        String url = imageUploadService.upload(file, "storybook", userId);
        String key = "upload:" + UUID.randomUUID();
        Map<String, Object> entry = Map.of("key", key, "url", url, "label", "");

        String entryJson = objectMapper.writeValueAsString(entry);
        jdbc.update(
            "UPDATE storybook_chapters SET " +
            "chapter_photos = COALESCE(chapter_photos, '[]'::jsonb) || ?::jsonb, " +
            "updated_at = NOW() WHERE id = ?",
            "[" + entryJson + "]", chapterId
        );

        return entry;
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
            parseJsonObject(row.get("layout_data")),
            parseJsonList(row.get("chapter_photos")),
            parseGeneratedContent(row.get("generated_content"))
        );
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseJsonList(Object raw) {
        if (raw == null) return List.of();
        try {
            return objectMapper.readValue(raw.toString(), new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, GeneratedPageContent> parseGeneratedContent(Object raw) {
        if (raw == null) return null;
        try {
            return objectMapper.readValue(raw.toString(), new TypeReference<Map<String, GeneratedPageContent>>() {});
        } catch (Exception e) {
            return null;
        }
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
