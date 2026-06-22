package com.gotcherapp.api.bump;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.bump.dto.CreateBumpPhotoRequest;
import com.gotcherapp.api.bump.dto.UpdateBumpPhotoRequest;
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
import static org.mockito.Mockito.*;

/**
 * Mockito coverage for BumpPhotoService — parity with FirstTimeServiceTest. Verifies profile
 * gating, the "photo or note required" create guard, the dynamic-patch update branches, and the
 * rows-affected delete contract.
 */
@ExtendWith(MockitoExtension.class)
class BumpPhotoServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks BumpPhotoService service;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID = 99L;
    private static final Long BP_ID      = 10L;

    private Map<String, Object> sampleRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", BP_ID);
        row.put("baby_profile_id", PROFILE_ID);
        row.put("week", 20);
        row.put("image_url", "https://img/bump.jpg");
        row.put("note", "Feeling kicks!");
        row.put("taken_date", "2026-05-01");
        row.put("image_orientation", "portrait");
        row.put("created_at", "2026-05-01T00:00:00Z");
        return row;
    }

    // ── findAll ───────────────────────────────────────────────────────────────

    @Test
    void findAll_returnsEmptyList_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(List.of(), service.findAll(USER_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void findAll_returnsMappedList_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID))).thenReturn(List.of(sampleRow()));

        List<BumpPhoto> result = service.findAll(USER_ID);

        assertEquals(1, result.size());
        assertEquals(20, result.get(0).week());
        assertEquals("Feeling kicks!", result.get(0).note());
        assertEquals("portrait", result.get(0).imageOrientation());
    }

    // ── create ────────────────────────────────────────────────────────────────

    @Test
    void create_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        var req = new CreateBumpPhotoRequest(20, "https://img", null, null, null);
        assertThrows(IllegalStateException.class, () -> service.create(USER_ID, req));
    }

    @Test
    void create_throwsIllegalArgument_whenWeekMissing() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new CreateBumpPhotoRequest(null, "https://img", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.create(USER_ID, req));
    }

    @Test
    void create_throwsIllegalArgument_whenNeitherPhotoNorNote() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new CreateBumpPhotoRequest(20, "   ", "  ", null, null);
        assertThrows(IllegalArgumentException.class, () -> service.create(USER_ID, req));
        verify(jdbc, never()).queryForMap(anyString(), any(Object[].class));
    }

    @Test
    void create_succeeds_withPhotoOnly() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq(20), eq("https://img"),
                isNull(), isNull(), isNull()))
            .thenReturn(sampleRow());

        var req = new CreateBumpPhotoRequest(20, "https://img", null, null, null);
        BumpPhoto result = service.create(USER_ID, req);

        assertEquals(BP_ID, result.id());
        assertEquals(20, result.week());
    }

    @Test
    void create_succeeds_withNoteOnly() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq(20), isNull(),
                eq("Just a note"), isNull(), isNull()))
            .thenReturn(sampleRow());

        var req = new CreateBumpPhotoRequest(20, null, "Just a note", null, null);
        BumpPhoto result = service.create(USER_ID, req);

        assertEquals(BP_ID, result.id());
    }

    // ── update ────────────────────────────────────────────────────────────────

    @Test
    void update_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        var req = new UpdateBumpPhotoRequest(21, null, null, null, null);
        assertEquals(Optional.empty(), service.update(USER_ID, BP_ID, req));
    }

    @Test
    void update_performsSelectOnly_whenPatchIsEmpty() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("SELECT"), eq(BP_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(sampleRow()));

        var req = new UpdateBumpPhotoRequest(null, null, null, null, null);
        Optional<BumpPhoto> result = service.update(USER_ID, BP_ID, req);

        assertTrue(result.isPresent());
        verify(jdbc, never()).queryForList(contains("UPDATE bump_photos"), any(Object[].class));
    }

    @Test
    void update_updatesWeek_forPartialPatch() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> updated = new HashMap<>(sampleRow());
        updated.put("week", 21);
        when(jdbc.queryForList(contains("UPDATE bump_photos SET week"), eq(21), eq(BP_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(updated));

        var req = new UpdateBumpPhotoRequest(21, null, null, null, null);
        Optional<BumpPhoto> result = service.update(USER_ID, BP_ID, req);

        assertTrue(result.isPresent());
        assertEquals(21, result.get().week());
    }

    @Test
    void update_returnsEmpty_whenNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("UPDATE bump_photos"), eq(21), eq(BP_ID), eq(PROFILE_ID)))
            .thenReturn(List.of());

        var req = new UpdateBumpPhotoRequest(21, null, null, null, null);
        assertEquals(Optional.empty(), service.update(USER_ID, BP_ID, req));
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Test
    void delete_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertFalse(service.delete(USER_ID, BP_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void delete_returnsFalse_whenNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(BP_ID), eq(PROFILE_ID))).thenReturn(0);
        assertFalse(service.delete(USER_ID, BP_ID));
    }

    @Test
    void delete_returnsTrue_whenDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(BP_ID), eq(PROFILE_ID))).thenReturn(1);
        assertTrue(service.delete(USER_ID, BP_ID));
    }
}
