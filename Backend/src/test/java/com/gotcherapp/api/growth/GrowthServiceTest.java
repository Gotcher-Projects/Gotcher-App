package com.gotcherapp.api.growth;

import com.gotcherapp.api.baby.BabyProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GrowthServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks GrowthService growthService;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID = 42L;
    private static final Long RECORD_ID  = 10L;

    // ── getRecords ────────────────────────────────────────────────────────────

    @Test
    void getRecords_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());

        assertEquals(List.of(), growthService.getRecords(USER_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void getRecords_returnsRecords_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID))).thenReturn(List.of(buildRow()));

        List<GrowthRecord> records = growthService.getRecords(USER_ID);

        assertEquals(1, records.size());
        assertEquals(RECORD_ID, records.get(0).id());
        assertEquals("2026-01-15", records.get(0).recordedDate());
    }

    // ── addRecord ─────────────────────────────────────────────────────────────

    @Test
    void addRecord_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        var req = new GrowthRequest("2026-01-15", new BigDecimal("12.50"), new BigDecimal("21.5"), null, null);

        assertThrows(IllegalStateException.class, () -> growthService.addRecord(USER_ID, req));
        verifyNoInteractions(jdbc);
    }

    @Test
    void addRecord_throwsIllegalArgument_whenDateMissing() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new GrowthRequest(null, new BigDecimal("12.50"), null, null, null);

        assertThrows(IllegalArgumentException.class, () -> growthService.addRecord(USER_ID, req));
        verifyNoInteractions(jdbc);
    }

    @Test
    void addRecord_returnsRecord_onSuccess() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("2026-01-15"),
            eq(new BigDecimal("12.50")), eq(new BigDecimal("21.5")), isNull(), isNull()))
            .thenReturn(buildRow());

        var req = new GrowthRequest("2026-01-15", new BigDecimal("12.50"), new BigDecimal("21.5"), null, null);
        GrowthRecord result = growthService.addRecord(USER_ID, req);

        assertEquals(RECORD_ID, result.id());
        assertEquals(new BigDecimal("12.50"), result.weightLbs());
    }

    // ── deleteRecord ──────────────────────────────────────────────────────────

    @Test
    void deleteRecord_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());

        assertFalse(growthService.deleteRecord(USER_ID, RECORD_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void deleteRecord_returnsFalse_whenRecordNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(RECORD_ID), eq(PROFILE_ID))).thenReturn(0);

        assertFalse(growthService.deleteRecord(USER_ID, RECORD_ID));
    }

    @Test
    void deleteRecord_returnsTrue_whenDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(RECORD_ID), eq(PROFILE_ID))).thenReturn(1);

        assertTrue(growthService.deleteRecord(USER_ID, RECORD_ID));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> buildRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("id",            RECORD_ID);
        row.put("recorded_date", "2026-01-15");
        row.put("weight_lbs",    new BigDecimal("12.50"));
        row.put("height_in",     new BigDecimal("21.5"));
        row.put("head_in",       null);
        row.put("notes",         null);
        return row;
    }
}
