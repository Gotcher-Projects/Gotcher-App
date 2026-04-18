package com.gotcherapp.api.diaper;

import com.gotcherapp.api.baby.BabyProfileRepository;
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
class DiaperServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks DiaperService diaperService;

    private static final Long USER_ID = 1L;
    private static final Long PROFILE_ID = 99L;
    private static final Long LOG_ID = 10L;

    // ── getLogs ───────────────────────────────────────────────────────────────

    @Test
    void getLogs_returnsEmptyList_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(List.of(), diaperService.getLogs(USER_ID, 14));
        verifyNoInteractions(jdbc);
    }

    @Test
    void getLogs_capsLimitDays_at3650() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID), eq(3650))).thenReturn(List.of());

        diaperService.getLogs(USER_ID, 99999);

        verify(jdbc).queryForList(anyString(), eq(PROFILE_ID), eq(3650));
    }

    @Test
    void getLogs_returnsMappedLogs_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> row = new HashMap<>();
        row.put("id", LOG_ID); row.put("logged_at", "2026-04-16T10:00:00Z");
        row.put("category", "poop");
        row.put("type", "normal"); row.put("color", "yellow");
        row.put("consistency", "seedy"); row.put("notes", null);
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID), eq(14))).thenReturn(List.of(row));

        List<DiaperLog> logs = diaperService.getLogs(USER_ID, 14);

        assertEquals(1, logs.size());
        assertEquals("poop", logs.get(0).category());
        assertEquals("normal", logs.get(0).type());
        assertEquals("yellow", logs.get(0).color());
    }

    // ── addLog ────────────────────────────────────────────────────────────────

    @Test
    void addLog_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        var req = new DiaperRequest("2026-04-16T10:00:00Z", "poop", "normal", null, null, null);
        assertThrows(IllegalStateException.class, () -> diaperService.addLog(USER_ID, req));
    }

    @Test
    void addLog_throwsIllegalArgument_forInvalidCategory() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new DiaperRequest("2026-04-16T10:00:00Z", "other", null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> diaperService.addLog(USER_ID, req));
    }

    @Test
    void addLog_throwsIllegalArgument_forInvalidType() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new DiaperRequest("2026-04-16T10:00:00Z", "poop", "runny", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> diaperService.addLog(USER_ID, req));
    }

    @Test
    void addLog_throwsIllegalArgument_forInvalidColor() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new DiaperRequest("2026-04-16T10:00:00Z", "poop", "normal", "purple", null, null);
        assertThrows(IllegalArgumentException.class, () -> diaperService.addLog(USER_ID, req));
    }

    @Test
    void addLog_throwsIllegalArgument_forInvalidConsistency() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new DiaperRequest("2026-04-16T10:00:00Z", "poop", "normal", null, "slimy", null);
        assertThrows(IllegalArgumentException.class, () -> diaperService.addLog(USER_ID, req));
    }

    @Test
    void addLog_defaultsType_toNormal_whenTypeIsNull() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        Map<String, Object> row = new HashMap<>();
        row.put("id", LOG_ID); row.put("logged_at", "2026-04-16T10:00:00Z");
        row.put("category", "poop");
        row.put("type", "normal"); row.put("color", null);
        row.put("consistency", null); row.put("notes", null);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), any(), eq("poop"), eq("normal"), isNull(), isNull(), isNull()))
            .thenReturn(row);

        var req = new DiaperRequest(null, null, null, null, null, null);
        DiaperLog log = diaperService.addLog(USER_ID, req);

        assertEquals("normal", log.type());
    }

    @Test
    void addLog_insertsAndReturnsMappedLog_forValidPoopRequest() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        Map<String, Object> row = new HashMap<>();
        row.put("id", LOG_ID); row.put("logged_at", "2026-04-16T10:00:00Z");
        row.put("category", "poop");
        row.put("type", "loose"); row.put("color", "green");
        row.put("consistency", "watery"); row.put("notes", "monitor");
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), any(), eq("poop"), eq("loose"), eq("green"), eq("watery"), eq("monitor")))
            .thenReturn(row);

        var req = new DiaperRequest("2026-04-16T10:00:00Z", "poop", "loose", "green", "watery", "monitor");
        DiaperLog log = diaperService.addLog(USER_ID, req);

        assertEquals("poop", log.category());
        assertEquals("loose", log.type());
        assertEquals("green", log.color());
        assertEquals("watery", log.consistency());
    }

    @Test
    void addLog_insertsAndReturnsMappedLog_forPeeRequest() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        Map<String, Object> row = new HashMap<>();
        row.put("id", LOG_ID); row.put("logged_at", "2026-04-16T10:00:00Z");
        row.put("category", "pee");
        row.put("type", null); row.put("color", null);
        row.put("consistency", null); row.put("notes", null);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), any(), eq("pee"), isNull(), isNull(), isNull(), isNull()))
            .thenReturn(row);

        var req = new DiaperRequest("2026-04-16T10:00:00Z", "pee", null, null, null, null);
        DiaperLog log = diaperService.addLog(USER_ID, req);

        assertEquals("pee", log.category());
        assertNull(log.type());
        assertNull(log.color());
    }

    // ── deleteLog ─────────────────────────────────────────────────────────────

    @Test
    void deleteLog_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertFalse(diaperService.deleteLog(USER_ID, LOG_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void deleteLog_returnsFalse_whenLogNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(LOG_ID), eq(PROFILE_ID))).thenReturn(0);
        assertFalse(diaperService.deleteLog(USER_ID, LOG_ID));
    }

    @Test
    void deleteLog_returnsTrue_whenLogDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(LOG_ID), eq(PROFILE_ID))).thenReturn(1);
        assertTrue(diaperService.deleteLog(USER_ID, LOG_ID));
    }
}
