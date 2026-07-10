package com.gotcherapp.api.storybook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.storybook.dto.ChapterResponse;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Coverage for StorybookService. Started life as the s3 IDOR regression suite (selected memory ids
 * must belong to the caller's profile) and broadened in s6 to the pure helpers and the wizard/update
 * branches. The batched AI page-generation path was removed in sv2-s11 (its tests went with it — the
 * only AI now is the per-field assist, covered by AiAssistServiceTest). DB calls are mocked via
 * JdbcTemplate; a real ObjectMapper exercises the JSON parse/serialize helpers for genuine behaviour.
 */
@ExtendWith(MockitoExtension.class)
class StorybookServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @Mock ImageUploadService imageUploadService;

    StorybookService service;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID  = 99L;
    private static final Long CHAPTER_ID  = 5001L;
    private static final Long BOOK_ID     = 7L;

    @BeforeEach
    void setUp() {
        service = new StorybookService(jdbc, babyProfileRepository, new ObjectMapper(), imageUploadService);
    }

    private WizardRequest wizardReq(List<Long> journalIds, List<Long> firstTimeIds) {
        return new WizardRequest(
            BOOK_ID, "8-12", "Weeks 8–12", 8, 12,
            journalIds, firstTimeIds,
            null, null, null
        );
    }

    // Stubs the book-ownership COUNT(*) so wizard() reaches the selection-ownership check.
    private void stubBookOwned() {
        when(jdbc.queryForObject(contains("FROM books"), eq(Integer.class), any(Object[].class))).thenReturn(1);
    }

    // ── wizard() ownership boundary ─────────────────────────────────────────────

    @Test
    void wizard_rejectsForeignJournalId() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        stubBookOwned();
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
        stubBookOwned();
        when(jdbc.queryForObject(contains("first_times"), eq(Integer.class), any(Object[].class))).thenReturn(0);

        var req = wizardReq(null, List.of(777L));

        assertThrows(IllegalArgumentException.class, () -> service.wizard(USER_ID, req));
    }

    @Test
    void wizard_acceptsOwnedIds_andCreatesChapter() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        stubBookOwned();
        // 1 id requested, 1 owned → passes the ownership check
        when(jdbc.queryForObject(contains("journal_entries"), eq(Integer.class), any(Object[].class))).thenReturn(1);
        // no existing chapter for this anchor → INSERT path
        when(jdbc.queryForList(contains("anchor_key = ?"), eq(BOOK_ID), eq("8-12")))
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

    // ── wizard() field validation + create/update branch ────────────────────────

    @Test
    void wizard_missingRequiredFields_throwsIllegalArgument() {
        // anchorKey null → rejected before any DB/profile interaction (bookId is valid here).
        var req = new WizardRequest(BOOK_ID, null, "Weeks 8–12", 8, 12, List.of(5L), null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.wizard(USER_ID, req));
        verifyNoInteractions(babyProfileRepository);
    }

    @Test
    void wizard_noSelections_throwsIllegalArgument() {
        var req = new WizardRequest(BOOK_ID, "8-12", "Weeks 8–12", 8, 12, null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.wizard(USER_ID, req));
    }

    @Test
    void wizard_existingChapter_takesUpdateBranch() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        stubBookOwned();
        when(jdbc.queryForObject(contains("journal_entries"), eq(Integer.class), any(Object[].class))).thenReturn(1);
        // A chapter already exists for this anchor → UPDATE, not INSERT.
        when(jdbc.queryForList(contains("anchor_key = ?"), eq(BOOK_ID), eq("8-12")))
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
    }

    private Map<String, Object> rowWithId(Long id) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", id);
        return row;
    }
}
