package com.gotcherapp.api.storybook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.storybook.dto.ChapterResponse;
import com.gotcherapp.api.storybook.dto.GeneratedPageResponse;
import com.gotcherapp.api.storybook.dto.UpdateChapterRequest;
import com.gotcherapp.api.storybook.dto.WizardRequest;
import com.gotcherapp.api.upload.ImageUploadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Coverage for StorybookService. Started life as the s3 IDOR regression suite (selected memory ids
 * must belong to the caller's profile) and broadened in s6 to the pure helpers, the generatePages
 * credit gating + refund paths, and the wizard/update branches. DB calls are mocked via JdbcTemplate;
 * a real ObjectMapper is used so the JSON parse/serialize helpers exercise genuine behaviour.
 */
@ExtendWith(MockitoExtension.class)
class StorybookServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @Mock ClaudeClient claudeClient;
    @Mock ImageUploadService imageUploadService;

    StorybookService service;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID  = 99L;
    private static final Long CHAPTER_ID  = 5001L;

    @BeforeEach
    void setUp() {
        service = new StorybookService(jdbc, babyProfileRepository, claudeClient,
            new ObjectMapper(), imageUploadService);
    }

    private WizardRequest wizardReq(List<Long> journalIds, List<Long> firstTimeIds) {
        return new WizardRequest(
            "8-12", "Weeks 8–12", 8, 12,
            journalIds, firstTimeIds,
            null, null, null
        );
    }

    // ── wizard() ownership boundary ─────────────────────────────────────────────

    @Test
    void wizard_rejectsForeignJournalId() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        // 1 id requested, COUNT(*) of owned rows = 0 → not owned
        when(jdbc.queryForObject(contains("journal_entries"), eq(Integer.class), any(Object[].class))).thenReturn(0);

        var req = wizardReq(List.of(424242L), null);

        assertThrows(IllegalArgumentException.class, () -> service.wizard(USER_ID, req));
        // Must never reach the INSERT/UPDATE with a foreign id.
        verify(jdbc, never()).queryForMap(contains("INSERT INTO storybook_chapters"), any());
    }

    @Test
    void wizard_rejectsForeignFirstTimeId() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForObject(contains("first_times"), eq(Integer.class), any(Object[].class))).thenReturn(0);

        var req = wizardReq(null, List.of(777L));

        assertThrows(IllegalArgumentException.class, () -> service.wizard(USER_ID, req));
    }

    @Test
    void wizard_acceptsOwnedIds_andCreatesChapter() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        // 1 id requested, 1 owned → passes the ownership check
        when(jdbc.queryForObject(contains("journal_entries"), eq(Integer.class), any(Object[].class))).thenReturn(1);
        // no existing chapter for this anchor → INSERT path
        when(jdbc.queryForList(contains("anchor_key = ?"), eq(PROFILE_ID), eq("8-12")))
            .thenReturn(List.of());
        when(jdbc.queryForMap(contains("INSERT INTO storybook_chapters"), any(Object[].class)))
            .thenReturn(Map.of("id", CHAPTER_ID));
        Map<String, Object> savedRow = new HashMap<>();
        savedRow.put("id", CHAPTER_ID);
        when(jdbc.queryForList(contains("FROM storybook_chapters WHERE id = ?"), eq(CHAPTER_ID)))
            .thenReturn(List.of(savedRow));

        ChapterResponse resp = service.wizard(USER_ID, wizardReq(List.of(5L), null));

        assertEquals(CHAPTER_ID, resp.id());
    }

    // ── generatePages() read scoping ────────────────────────────────────────────

    @Test
    void generatePages_scopesMemoryReadsByBabyProfile() {
        when(jdbc.queryForMap(contains("FROM users WHERE id = ?"), eq(USER_ID)))
            .thenReturn(Map.of("tier", "plus", "ai_credits_remaining", 100));
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));

        Map<String, Object> chapterRow = new HashMap<>();
        chapterRow.put("wizard_journal_ids", "5");
        chapterRow.put("wizard_first_time_ids", null);
        chapterRow.put("wizard_entry_notes", null);
        when(jdbc.queryForList(contains("FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?"),
                eq(CHAPTER_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(chapterRow));
        when(jdbc.queryForMap(contains("FROM baby_profiles WHERE id = ?"), eq(PROFILE_ID)))
            .thenReturn(Map.of("baby_name", "Lily"));
        when(jdbc.queryForList(contains("FROM journal_entries"), any(Object[].class))).thenReturn(List.of());
        // atomic charge succeeds (1 row updated)
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining -"), eq(1), eq(USER_ID), eq(1)))
            .thenReturn(1);
        when(claudeClient.generatePagesBatch(anyString(), anyInt())).thenReturn("{\"pages\":[]}");

        service.generatePages(USER_ID, CHAPTER_ID, null);

        ArgumentCaptor<String> sqlCap = ArgumentCaptor.forClass(String.class);
        verify(jdbc, atLeastOnce()).queryForList(sqlCap.capture(), any(Object[].class));
        String journalSql = sqlCap.getAllValues().stream()
            .filter(s -> s.contains("journal_entries"))
            .findFirst()
            .orElseThrow(() -> new AssertionError("journal_entries was never queried"));
        assertTrue(journalSql.contains("baby_profile_id = ?"),
            "journal read must be scoped by baby_profile_id, was: " + journalSql);
    }

    @Test
    void generatePages_throwsInsufficientCredits_whenAtomicChargeAffectsZeroRows() {
        when(jdbc.queryForMap(contains("FROM users WHERE id = ?"), eq(USER_ID)))
            .thenReturn(Map.of("tier", "plus"));
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));

        Map<String, Object> chapterRow = new HashMap<>();
        chapterRow.put("wizard_journal_ids", "5");
        chapterRow.put("wizard_first_time_ids", null);
        chapterRow.put("wizard_entry_notes", null);
        when(jdbc.queryForList(contains("FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?"),
                eq(CHAPTER_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(chapterRow));
        when(jdbc.queryForMap(contains("FROM baby_profiles WHERE id = ?"), eq(PROFILE_ID)))
            .thenReturn(Map.of("baby_name", "Lily"));
        // conditional charge affects 0 rows → insufficient balance
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining -"), eq(1), eq(USER_ID), eq(1)))
            .thenReturn(0);

        assertThrows(StorybookService.InsufficientCreditsException.class,
            () -> service.generatePages(USER_ID, CHAPTER_ID, null));
        // The AI call must not happen if the charge didn't go through.
        verify(claudeClient, never()).generatePagesBatch(anyString(), anyInt());
    }

    // ── generatePages() gating ──────────────────────────────────────────────────

    @Test
    void generatePages_freeTier_throwsForbidden() {
        when(jdbc.queryForMap(contains("FROM users WHERE id = ?"), eq(USER_ID)))
            .thenReturn(Map.of("tier", "free"));

        assertThrows(StorybookService.ForbiddenException.class,
            () -> service.generatePages(USER_ID, CHAPTER_ID, null));
        verify(claudeClient, never()).generatePagesBatch(anyString(), anyInt());
    }

    @Test
    void generatePages_noProfile_throwsForbidden() {
        when(jdbc.queryForMap(contains("FROM users WHERE id = ?"), eq(USER_ID)))
            .thenReturn(Map.of("tier", "plus"));
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());

        assertThrows(StorybookService.ForbiddenException.class,
            () -> service.generatePages(USER_ID, CHAPTER_ID, null));
    }

    @Test
    void generatePages_chapterNotFound_throwsNoSuchElement() {
        when(jdbc.queryForMap(contains("FROM users WHERE id = ?"), eq(USER_ID)))
            .thenReturn(Map.of("tier", "plus"));
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?"),
                eq(CHAPTER_ID), eq(PROFILE_ID))).thenReturn(List.of());

        assertThrows(NoSuchElementException.class,
            () -> service.generatePages(USER_ID, CHAPTER_ID, null));
    }

    @Test
    void generatePages_noEntriesSelected_throwsIllegalArgument() {
        when(jdbc.queryForMap(contains("FROM users WHERE id = ?"), eq(USER_ID)))
            .thenReturn(Map.of("tier", "plus"));
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> emptyChapter = new HashMap<>();
        emptyChapter.put("wizard_journal_ids", null);
        emptyChapter.put("wizard_first_time_ids", null);
        emptyChapter.put("wizard_entry_notes", null);
        when(jdbc.queryForList(contains("FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?"),
                eq(CHAPTER_ID), eq(PROFILE_ID))).thenReturn(List.of(emptyChapter));

        assertThrows(IllegalArgumentException.class,
            () -> service.generatePages(USER_ID, CHAPTER_ID, null));
        // No charge should be attempted when there's nothing to generate.
        verify(jdbc, never()).update(contains("ai_credits_remaining = ai_credits_remaining -"), any(), any(), any());
    }

    // ── generatePages() happy path + credit refunds (highest value) ─────────────

    @Test
    void generatePages_happyPath_chargesAndWritesGeneratedContent() {
        arrangeChargeableChapter();
        when(claudeClient.generatePagesBatch(anyString(), anyInt()))
            .thenReturn("{\"pages\":[{\"sourceKey\":\"journal:5\",\"body\":\"Once upon a time\",\"title\":\"Day one\"}]}");

        List<GeneratedPageResponse> pages = service.generatePages(USER_ID, CHAPTER_ID, null);

        assertEquals(1, pages.size());
        assertEquals("journal:5", pages.get(0).sourceKey());
        assertEquals("Once upon a time", pages.get(0).body());
        // Charged exactly one credit (one selected entry) ...
        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining -"), eq(1), eq(USER_ID), eq(1));
        // ... and persisted the generated content; no refund.
        verify(jdbc).update(contains("SET generated_content"), anyString(), eq(CHAPTER_ID));
        verify(jdbc, never()).update(contains("ai_credits_remaining = ai_credits_remaining +"), anyInt(), eq(USER_ID));
    }

    @Test
    void generatePages_refundsCredits_whenClaudeFails() {
        arrangeChargeableChapter();
        when(claudeClient.generatePagesBatch(anyString(), anyInt()))
            .thenThrow(new RuntimeException("Claude API timeout"));

        assertThrows(RuntimeException.class, () -> service.generatePages(USER_ID, CHAPTER_ID, null));

        // The credit charged up front must be returned when generation never produced anything.
        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining +"), eq(1), eq(USER_ID));
        verify(jdbc, never()).update(contains("SET generated_content"), anyString(), any());
    }

    @Test
    void generatePages_refundsCredits_whenResponseUnparseable() {
        arrangeChargeableChapter();
        // Valid call, but the model returned JSON with no "pages" array → parse failure after charge.
        when(claudeClient.generatePagesBatch(anyString(), anyInt()))
            .thenReturn("{\"unexpected\":true}");

        assertThrows(RuntimeException.class, () -> service.generatePages(USER_ID, CHAPTER_ID, null));

        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining +"), eq(1), eq(USER_ID));
        verify(jdbc, never()).update(contains("SET generated_content"), anyString(), any());
    }

    // Common arrangement for a single-entry chapter that successfully passes the credit charge.
    private void arrangeChargeableChapter() {
        when(jdbc.queryForMap(contains("FROM users WHERE id = ?"), eq(USER_ID)))
            .thenReturn(Map.of("tier", "plus"));
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> chapterRow = new HashMap<>();
        chapterRow.put("wizard_journal_ids", "5");
        chapterRow.put("wizard_first_time_ids", null);
        chapterRow.put("wizard_entry_notes", null);
        when(jdbc.queryForList(contains("FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?"),
                eq(CHAPTER_ID), eq(PROFILE_ID))).thenReturn(List.of(chapterRow));
        when(jdbc.queryForMap(contains("FROM baby_profiles WHERE id = ?"), eq(PROFILE_ID)))
            .thenReturn(Map.of("baby_name", "Lily"));
        when(jdbc.queryForList(contains("FROM journal_entries"), any(Object[].class))).thenReturn(List.of());
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining -"), eq(1), eq(USER_ID), eq(1)))
            .thenReturn(1);
    }

    // ── wizard() field validation + create/update branch ────────────────────────

    @Test
    void wizard_missingRequiredFields_throwsIllegalArgument() {
        // anchorKey null → rejected before any DB/profile interaction.
        var req = new WizardRequest(null, "Weeks 8–12", 8, 12, List.of(5L), null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.wizard(USER_ID, req));
        verifyNoInteractions(babyProfileRepository);
    }

    @Test
    void wizard_noSelections_throwsIllegalArgument() {
        var req = new WizardRequest("8-12", "Weeks 8–12", 8, 12, null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.wizard(USER_ID, req));
    }

    @Test
    void wizard_existingChapter_takesUpdateBranch() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForObject(contains("journal_entries"), eq(Integer.class), any(Object[].class))).thenReturn(1);
        // A chapter already exists for this anchor → UPDATE, not INSERT.
        when(jdbc.queryForList(contains("anchor_key = ?"), eq(PROFILE_ID), eq("8-12")))
            .thenReturn(List.of(Map.of("id", CHAPTER_ID)));
        when(jdbc.queryForList(contains("FROM storybook_chapters WHERE id = ?"), eq(CHAPTER_ID)))
            .thenReturn(List.of(rowWithId(CHAPTER_ID)));

        ChapterResponse resp = service.wizard(USER_ID, wizardReq(List.of(5L), null));

        assertEquals(CHAPTER_ID, resp.id());
        verify(jdbc).update(contains("UPDATE storybook_chapters SET anchor_label"),
            any(), any(), any(), any(), any(), any(), any());
        verify(jdbc, never()).queryForMap(contains("INSERT INTO storybook_chapters"), any(Object[].class));
    }

    // ── update() dynamic SET ────────────────────────────────────────────────────

    @Test
    void update_noProfile_returnsEmpty() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        var req = new UpdateChapterRequest("new body", null, null, null, null);
        assertTrue(service.update(USER_ID, CHAPTER_ID, req).isEmpty());
    }

    @Test
    void update_emptyPatch_selectsCurrentRow_withoutUpdating() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("FROM storybook_chapters WHERE id = ? AND baby_profile_id = ?"),
                eq(CHAPTER_ID), eq(PROFILE_ID))).thenReturn(List.of(rowWithId(CHAPTER_ID)));

        var req = new UpdateChapterRequest(null, null, null, null, null);
        Optional<ChapterResponse> r = service.update(USER_ID, CHAPTER_ID, req);

        assertTrue(r.isPresent());
        verify(jdbc, never()).queryForList(contains("UPDATE storybook_chapters SET"), any(Object[].class));
    }

    @Test
    void update_clearLayoutData_setsColumnToNull() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("UPDATE storybook_chapters SET"), any(Object[].class)))
            .thenReturn(List.of(rowWithId(CHAPTER_ID)));

        service.update(USER_ID, CHAPTER_ID, new UpdateChapterRequest(null, null, null, null, true));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), any(Object[].class));
        assertTrue(sql.getValue().contains("layout_data = NULL"), sql.getValue());
        assertFalse(sql.getValue().contains("layout_data = ?"), sql.getValue());
    }

    @Test
    void update_layoutData_serializesToJsonParam() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("UPDATE storybook_chapters SET"), any(Object[].class)))
            .thenReturn(List.of(rowWithId(CHAPTER_ID)));

        service.update(USER_ID, CHAPTER_ID, new UpdateChapterRequest(null, null, null, Map.of("pages", 3), null));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForList(sql.capture(), args.capture());
        assertTrue(sql.getValue().contains("layout_data = ?"), sql.getValue());
        // First bound param is the serialized layout JSON.
        assertEquals("{\"pages\":3}", args.getValue()[0]);
    }

    @Test
    void update_publishedStatus_stampsPublishedAt() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("UPDATE storybook_chapters SET"), any(Object[].class)))
            .thenReturn(List.of(rowWithId(CHAPTER_ID)));

        service.update(USER_ID, CHAPTER_ID, new UpdateChapterRequest(null, "published", null, null, null));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), any(Object[].class));
        assertTrue(sql.getValue().contains("status = ?"), sql.getValue());
        assertTrue(sql.getValue().contains("published_at = NOW()"), sql.getValue());
    }

    // ── Pure helpers (no mocks) ─────────────────────────────────────────────────

    @Test
    void extractJson_unwrapsObjectFromSurroundingProse() {
        assertEquals("{\"pages\":[]}", StorybookService.extractJson("Sure!\n```json\n{\"pages\":[]}\n```"));
        assertEquals("{}", StorybookService.extractJson(null));
        // No braces → returned unchanged (caller's readTree will then fail and trigger a refund).
        assertEquals("no json here", StorybookService.extractJson("no json here"));
    }

    @Test
    void parseIdsCsv_serializeIds_roundTrip() {
        assertEquals("3,1,2", service.serializeIds(List.of(3L, 1L, 2L)));
        assertEquals(List.of(3L, 1L, 2L), service.parseIdsCsv("3,1,2"));
        // Whitespace and stray separators are tolerated.
        assertEquals(List.of(5L, 6L), service.parseIdsCsv(" 5 , 6 "));
        // Empty/null edges.
        assertNull(service.serializeIds(null));
        assertNull(service.serializeIds(List.of()));
        assertNull(service.parseIdsCsv(null));
        assertEquals(List.of(), service.parseIdsCsv(""));
    }

    @Test
    void jsonParseHelpers_returnFallback_onMalformedInput_notThrow() {
        assertNull(service.parseJsonMap("not json"));
        assertNull(service.parseJsonMap(null));
        assertEquals(Map.of("a", "b"), service.parseJsonMap("{\"a\":\"b\"}"));

        assertNull(service.parseJsonObject("{bad"));
        assertNull(service.parseJsonObject(null));

        assertEquals(List.of(), service.parseJsonList("nope"));
        assertEquals(List.of(), service.parseJsonList(null));
        assertEquals(1, service.parseJsonList("[{\"k\":\"v\"}]").size());

        assertNull(service.parseGeneratedContent("garbage"));
        assertNull(service.parseGeneratedContent(null));
    }

    private Map<String, Object> rowWithId(Long id) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", id);
        return row;
    }
}
