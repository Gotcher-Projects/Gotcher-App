package com.gotcherapp.api.firsttimes;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.firsttimes.dto.CreateFirstTimeRequest;
import com.gotcherapp.api.firsttimes.dto.UpdateFirstTimeRequest;
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

@ExtendWith(MockitoExtension.class)
class FirstTimeServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks FirstTimeService firstTimeService;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID = 99L;
    private static final Long FT_ID      = 10L;

    private Map<String, Object> sampleRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", FT_ID);
        row.put("baby_profile_id", PROFILE_ID);
        row.put("label", "First smile");
        row.put("occurred_date", "2026-04-01");
        row.put("image_url", null);
        row.put("notes", "So cute!");
        row.put("created_at", "2026-04-01T00:00:00Z");
        row.put("image_orientation", "landscape");
        return row;
    }

    // ── findAll ───────────────────────────────────────────────────────────────

    @Test
    void findAll_returnsEmptyList_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(List.of(), firstTimeService.findAll(USER_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void findAll_returnsMappedList_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID))).thenReturn(List.of(sampleRow()));

        List<FirstTime> result = firstTimeService.findAll(USER_ID);

        assertEquals(1, result.size());
        assertEquals("First smile", result.get(0).label());
    }

    // ── create ────────────────────────────────────────────────────────────────

    @Test
    void create_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        var req = new CreateFirstTimeRequest("First smile", "2026-04-01", null, null, null);
        assertThrows(IllegalStateException.class, () -> firstTimeService.create(USER_ID, req));
    }

    @Test
    void create_throwsIllegalArgument_whenLabelIsBlank() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new CreateFirstTimeRequest("", "2026-04-01", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> firstTimeService.create(USER_ID, req));
    }

    @Test
    void create_throwsIllegalArgument_whenOccurredDateIsBlank() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new CreateFirstTimeRequest("First smile", "", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> firstTimeService.create(USER_ID, req));
    }

    @Test
    void create_returnsFirstTime_forValidRequest() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("First smile"),
                eq("2026-04-01"), isNull(), eq("So cute!"), isNull()))
            .thenReturn(sampleRow());

        var req = new CreateFirstTimeRequest("First smile", "2026-04-01", null, "So cute!", null);
        FirstTime result = firstTimeService.create(USER_ID, req);

        assertEquals("First smile", result.label());
        assertEquals("2026-04-01", result.occurredDate());
    }

    // ── update ────────────────────────────────────────────────────────────────

    @Test
    void update_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        var req = new UpdateFirstTimeRequest("Updated", null, null, null, null);
        assertEquals(Optional.empty(), firstTimeService.update(USER_ID, FT_ID, req));
    }

    @Test
    void update_performsSelectOnly_whenPatchIsEmpty() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("SELECT"), eq(FT_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(sampleRow()));

        var req = new UpdateFirstTimeRequest(null, null, null, null, null);
        Optional<FirstTime> result = firstTimeService.update(USER_ID, FT_ID, req);

        assertTrue(result.isPresent());
        assertEquals("First smile", result.get().label());
    }

    @Test
    void update_updatesLabel_forPartialPatch() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> updated = new HashMap<>(sampleRow());
        updated.put("label", "First laugh");
        when(jdbc.queryForList(contains("UPDATE first_times SET label"), eq("First laugh"), eq(FT_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(updated));

        var req = new UpdateFirstTimeRequest("First laugh", null, null, null, null);
        Optional<FirstTime> result = firstTimeService.update(USER_ID, FT_ID, req);

        assertTrue(result.isPresent());
        assertEquals("First laugh", result.get().label());
    }

    @Test
    void update_returnsEmpty_whenFirstTimeNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        // "Updated" is non-null so UPDATE path is taken; UPDATE returns empty list → not found
        when(jdbc.queryForList(contains("UPDATE first_times"), eq("Updated"), eq(FT_ID), eq(PROFILE_ID)))
            .thenReturn(List.of());

        var req = new UpdateFirstTimeRequest("Updated", null, null, null, null);
        assertEquals(Optional.empty(), firstTimeService.update(USER_ID, FT_ID, req));
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Test
    void delete_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertFalse(firstTimeService.delete(USER_ID, FT_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void delete_returnsFalse_whenNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(FT_ID), eq(PROFILE_ID))).thenReturn(0);
        assertFalse(firstTimeService.delete(USER_ID, FT_ID));
    }

    @Test
    void delete_returnsTrue_whenDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(FT_ID), eq(PROFILE_ID))).thenReturn(1);
        assertTrue(firstTimeService.delete(USER_ID, FT_ID));
    }
}
