package com.gotcherapp.api.storybook;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.storybook.dto.ChapterResponse;
import com.gotcherapp.api.storybook.dto.UpdateChapterRequest;
import com.gotcherapp.api.storybook.dto.WizardRequest;
import com.gotcherapp.api.upload.ImageUploadService;
import com.gotcherapp.api.upload.UploadFolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class StorybookService {

    // All chapter columns — used in every SELECT / RETURNING to keep mapRow() consistent.
    private static final String CHAPTER_COLS =
        "id, anchor_type, anchor_key, anchor_label, period_start_weeks, period_end_weeks, " +
        "sort_order, body, status, image_url, generated_at, published_at, created_at, updated_at, " +
        "wizard_journal_ids, wizard_first_time_ids, supplementary_notes, photo_overrides, wizard_entry_notes, layout_data, chapter_photos";

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;
    private final ObjectMapper objectMapper;
    private final ImageUploadService imageUploadService;

    public StorybookService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository,
                            ObjectMapper objectMapper, ImageUploadService imageUploadService) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
        this.objectMapper = objectMapper;
        this.imageUploadService = imageUploadService;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    // Book-scoped (sv2-s7a): scoping by baby_profile_id AND book_id is the IDOR boundary — a book_id
    // belonging to another tenant won't match this profile's baby_profile_id, so it returns empty.
    public List<ChapterResponse> findAll(Long userId, Long bookId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT " + CHAPTER_COLS + " FROM storybook_chapters WHERE baby_profile_id = ? AND book_id = ? " +
            "ORDER BY COALESCE(sort_order, 999999), created_at",
            profileId.get(), bookId
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

    // ── Wizard ────────────────────────────────────────────────────────────────

    // Creates or updates the period chapter row from the wizard's memory selection.
    // Page content is produced separately by generatePages() (batched, per-page).
    public ChapterResponse wizard(Long userId, WizardRequest req) {
        if (req.bookId() == null) {
            throw new IllegalArgumentException("bookId is required");
        }
        if (req.anchorKey() == null || req.anchorLabel() == null
                || req.periodStartWeeks() == null || req.periodEndWeeks() == null) {
            throw new IllegalArgumentException("anchorKey, anchorLabel, periodStartWeeks, and periodEndWeeks are required");
        }
        if (req.selectedJournalIds() == null && req.selectedFirstTimeIds() == null) {
            throw new IllegalArgumentException("At least selectedJournalIds or selectedFirstTimeIds must be provided");
        }

        Long profileId = babyProfileRepository.requireProfileId(userId);

        // SECURITY: the book must belong to this profile (IDOR boundary for the book container).
        assertBookOwned(profileId, req.bookId());

        // SECURITY: reject selections that reference another tenant's memories (s3 IDOR fix).
        assertSelectionsOwned(profileId, req.selectedJournalIds(), req.selectedFirstTimeIds());

        String journalIdsCsv = serializeIds(req.selectedJournalIds());
        String firstTimeIdsCsv = serializeIds(req.selectedFirstTimeIds());
        String photoOverridesJson = serializeJsonMap(req.photoOverrides());
        String entryNotesJson = serializeJsonMap(req.entryNotes());

        List<Map<String, Object>> existing = jdbc.queryForList(
            "SELECT id FROM storybook_chapters WHERE book_id = ? AND anchor_type = 'period' AND anchor_key = ?",
            req.bookId(), req.anchorKey()
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
                "(baby_profile_id, book_id, anchor_type, anchor_key, anchor_label, period_start_weeks, period_end_weeks, " +
                "wizard_journal_ids, wizard_first_time_ids, supplementary_notes, photo_overrides, wizard_entry_notes, status) " +
                "VALUES (?, ?, 'period', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unlocked') RETURNING id",
                profileId, req.bookId(), req.anchorKey(), req.anchorLabel(),
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

        String url = imageUploadService.upload(file, UploadFolder.STORYBOOK.folderName(), userId);
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

    // ── Ownership validation ────────────────────────────────────────────────────

    // Fails loudly if any selected journal/first-time id does not belong to the caller's profile.
    // This is the write-side boundary check; buildBatchPagesPrompt also scopes its reads as
    // defense-in-depth (and to protect any ids stored before this check existed).
    // Fails loudly if the book does not belong to the caller's profile (sv2-s7a IDOR boundary).
    private void assertBookOwned(Long profileId, Long bookId) {
        Integer owned = jdbc.queryForObject(
            "SELECT COUNT(*) FROM books WHERE id = ? AND baby_profile_id = ?",
            Integer.class, bookId, profileId
        );
        if (owned == null || owned == 0) {
            throw new IllegalArgumentException("Book not found");
        }
    }

    private void assertSelectionsOwned(Long profileId, List<Long> journalIds, List<Long> firstTimeIds) {
        assertOwned("journal_entries", profileId, journalIds, "journal entries");
        assertOwned("first_times", profileId, firstTimeIds, "first-time memories");
    }

    private void assertOwned(String table, Long profileId, List<Long> ids, String label) {
        if (ids == null || ids.isEmpty()) return;
        List<Long> distinct = ids.stream().distinct().toList();
        String ph = distinct.stream().map(i -> "?").collect(Collectors.joining(","));
        List<Object> params = new ArrayList<>();
        params.add(profileId);
        params.addAll(distinct);
        Integer owned = jdbc.queryForObject(
            "SELECT COUNT(*) FROM " + table + " WHERE baby_profile_id = ? AND id IN (" + ph + ")",
            Integer.class, params.toArray()
        );
        if (owned == null || owned != distinct.size()) {
            throw new IllegalArgumentException("One or more selected " + label + " do not belong to you");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    // These pure (or objectMapper-only) helpers are package-private so StorybookServiceTest can
    // unit-test the parse/serialize round-trips and malformed-input fallbacks without DB mocks.

    List<Long> parseIdsCsv(Object raw) {
        if (raw == null) return null;
        String s = raw.toString().trim();
        if (s.isEmpty()) return List.of();
        return Arrays.stream(s.split(","))
            .map(String::trim)
            .filter(t -> !t.isEmpty())
            .map(Long::parseLong)
            .collect(Collectors.toList());
    }

    String serializeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return null;
        return ids.stream().map(Object::toString).collect(Collectors.joining(","));
    }

    Map<String, String> parseJsonMap(Object raw) {
        if (raw == null) return null;
        try {
            return objectMapper.readValue(raw.toString(), new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    Map<String, Object> parseJsonObject(Object raw) {
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
            parseJsonList(row.get("chapter_photos"))
        );
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> parseJsonList(Object raw) {
        if (raw == null) return List.of();
        try {
            return objectMapper.readValue(raw.toString(), new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    // ── Custom exceptions ─────────────────────────────────────────────────────

    public static class ForbiddenException extends RuntimeException {
        public ForbiddenException(String message) { super(message); }
    }

    public static class InsufficientCreditsException extends RuntimeException {
        public InsufficientCreditsException(String message) { super(message); }
    }
}
