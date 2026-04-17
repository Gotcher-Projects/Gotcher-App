package com.gotcherapp.api.journal;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.journal.dto.JournalEntryRequest;
import com.gotcherapp.api.journal.dto.JournalEntryResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JournalServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks JournalService journalService;

    private static final Long USER_ID = 1L;
    private static final Long PROFILE_ID = 99L;
    private static final Long ENTRY_ID = 10L;

    // ── getAll ────────────────────────────────────────────────────────────────

    @Test
    void getAll_returnsEmptyList_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(List.of(), journalService.getAll(USER_ID));
    }

    @Test
    void getAll_returnsEntries_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> entryRow = new HashMap<>();
        entryRow.put("id", ENTRY_ID); entryRow.put("week", 4);
        entryRow.put("title", "First smile"); entryRow.put("story", "So cute");
        entryRow.put("entry_date", "2026-01-01"); entryRow.put("image_url", null);
        when(jdbc.queryForList(contains("journal_entries"), eq(PROFILE_ID)))
                .thenReturn(List.of(entryRow));

        List<JournalEntryResponse> entries = journalService.getAll(USER_ID);

        assertEquals(1, entries.size());
        assertEquals("First smile", entries.get(0).title());
    }

    // ── create ────────────────────────────────────────────────────────────────

    @Test
    void create_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        var req = new JournalEntryRequest(4, "Title", "Story", null, null);
        assertThrows(IllegalStateException.class, () -> journalService.create(USER_ID, req));
    }

    @Test
    void create_returnsEntry_whenProfileExists() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        Map<String, Object> createRow = new HashMap<>();
        createRow.put("id", ENTRY_ID); createRow.put("week", 4);
        createRow.put("title", "Title"); createRow.put("story", "Story");
        createRow.put("entry_date", "2026-01-01"); createRow.put("image_url", null);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq(4), eq("Title"), eq("Story"), isNull(), isNull()))
                .thenReturn(createRow);

        var req = new JournalEntryRequest(4, "Title", "Story", null, null);
        JournalEntryResponse entry = journalService.create(USER_ID, req);

        assertEquals("Title", entry.title());
        assertEquals(4, entry.week());
    }

    @Test
    void create_includesImageUrl_whenProvided() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq(4), eq("Title"), eq("Story"), eq("https://img.url"), isNull()))
                .thenReturn(Map.of(
                        "id", ENTRY_ID, "week", 4,
                        "title", "Title", "story", "Story",
                        "entry_date", "2026-01-01", "image_url", "https://img.url"
                ));

        var req = new JournalEntryRequest(4, "Title", "Story", "https://img.url", null);
        JournalEntryResponse entry = journalService.create(USER_ID, req);

        assertEquals("https://img.url", entry.imageUrl());
    }

    // ── updateImage ───────────────────────────────────────────────────────────

    @Test
    void updateImage_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(Optional.empty(), journalService.updateImage(USER_ID, ENTRY_ID, "https://url"));
    }

    @Test
    void updateImage_returnsEmpty_whenEntryNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("UPDATE journal_entries"), eq("https://url"), eq(ENTRY_ID), eq(PROFILE_ID)))
                .thenReturn(List.of());

        assertEquals(Optional.empty(), journalService.updateImage(USER_ID, ENTRY_ID, "https://url"));
    }

    @Test
    void updateImage_returnsUpdatedEntry_whenSuccessful() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("UPDATE journal_entries"), eq("https://new.url"), eq(ENTRY_ID), eq(PROFILE_ID)))
                .thenReturn(List.of(Map.of(
                        "id", ENTRY_ID, "week", 4,
                        "title", "Title", "story", "Story",
                        "entry_date", "2026-01-01", "image_url", "https://new.url"
                )));

        Optional<JournalEntryResponse> result = journalService.updateImage(USER_ID, ENTRY_ID, "https://new.url");

        assertTrue(result.isPresent());
        assertEquals("https://new.url", result.get().imageUrl());
    }

    // ── update ───────────────────────────────────────────────────────────────

    @Test
    void update_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        var req = new com.gotcherapp.api.journal.dto.JournalEntryUpdateRequest("New Title", null, null);
        assertEquals(Optional.empty(), journalService.update(USER_ID, ENTRY_ID, req));
    }

    @Test
    void update_performsSelectOnly_whenPatchIsEmpty() {
        // An all-null patch means no fields to set — service should SELECT (not UPDATE) and return current entry.
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> existing = new HashMap<>();
        existing.put("id", ENTRY_ID); existing.put("week", 4);
        existing.put("title", "Existing Title"); existing.put("story", "Story");
        existing.put("entry_date", "2026-01-01"); existing.put("image_url", null);
        existing.put("image_orientation", "landscape");
        when(jdbc.queryForList(contains("SELECT"), eq(ENTRY_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(existing));

        var req = new com.gotcherapp.api.journal.dto.JournalEntryUpdateRequest(null, null, null);
        Optional<JournalEntryResponse> result = journalService.update(USER_ID, ENTRY_ID, req);

        assertTrue(result.isPresent());
        assertEquals("Existing Title", result.get().title());
    }

    @Test
    void update_updatesOnlyProvidedFields_forPartialPatch() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> updated = new HashMap<>();
        updated.put("id", ENTRY_ID); updated.put("week", 4);
        updated.put("title", "Updated Title"); updated.put("story", "Old Story");
        updated.put("entry_date", "2026-01-01"); updated.put("image_url", null);
        updated.put("image_orientation", "landscape");
        // Partial patch: only title provided. The UPDATE SQL will include "title = ?" but not story.
        when(jdbc.queryForList(contains("UPDATE journal_entries SET title"), eq("Updated Title"), eq(ENTRY_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(updated));

        var req = new com.gotcherapp.api.journal.dto.JournalEntryUpdateRequest("Updated Title", null, null);
        Optional<JournalEntryResponse> result = journalService.update(USER_ID, ENTRY_ID, req);

        assertTrue(result.isPresent());
        assertEquals("Updated Title", result.get().title());
    }

    @Test
    void update_returnsEmpty_whenEntryNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        // title is non-null so UPDATE path is taken; UPDATE returns empty list → no entry found
        when(jdbc.queryForList(contains("UPDATE journal_entries"), eq("Title"), eq(ENTRY_ID), eq(PROFILE_ID)))
            .thenReturn(List.of());

        var req = new com.gotcherapp.api.journal.dto.JournalEntryUpdateRequest("Title", null, null);
        assertEquals(Optional.empty(), journalService.update(USER_ID, ENTRY_ID, req));
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Test
    void delete_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertFalse(journalService.delete(USER_ID, ENTRY_ID));
    }

    @Test
    void delete_returnsFalse_whenEntryNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(ENTRY_ID), eq(PROFILE_ID))).thenReturn(0);

        assertFalse(journalService.delete(USER_ID, ENTRY_ID));
    }

    @Test
    void delete_returnsTrue_whenEntryDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(ENTRY_ID), eq(PROFILE_ID))).thenReturn(1);

        assertTrue(journalService.delete(USER_ID, ENTRY_ID));
    }
}
