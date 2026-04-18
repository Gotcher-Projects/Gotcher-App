package com.gotcherapp.api.sleep;

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
class SleepServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks SleepService sleepService;

    private static final Long USER_ID = 1L;
    private static final Long PROFILE_ID = 99L;
    private static final Long LOG_ID = 10L;

    // ── getLogs ───────────────────────────────────────────────────────────────

    @Test
    void getLogs_returnsEmptyList_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(List.of(), sleepService.getLogs(USER_ID, 7));
        verifyNoInteractions(jdbc);
    }

    @Test
    void getLogs_capsLimitDays_at3650() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID), eq(3650))).thenReturn(List.of());

        sleepService.getLogs(USER_ID, 99999);

        verify(jdbc).queryForList(anyString(), eq(PROFILE_ID), eq(3650));
    }

    @Test
    void getLogs_returnsMappedLogs_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> row = new HashMap<>();
        row.put("id", LOG_ID); row.put("type", "nap");
        row.put("started_at", "2026-04-16T10:00:00Z");
        row.put("ended_at",   "2026-04-16T11:00:00Z");
        row.put("notes", null);
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID), eq(30))).thenReturn(List.of(row));

        List<SleepLog> logs = sleepService.getLogs(USER_ID, 30);

        assertEquals(1, logs.size());
        assertEquals("nap", logs.get(0).type());
    }

    // ── addLog ────────────────────────────────────────────────────────────────

    @Test
    void addLog_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        var req = new SleepRequest("nap", "2026-04-16T10:00:00Z", "2026-04-16T11:00:00Z", null);
        assertThrows(IllegalStateException.class, () -> sleepService.addLog(USER_ID, req));
    }

    @Test
    void addLog_throwsIllegalArgument_forInvalidType() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new SleepRequest("snooze", "2026-04-16T10:00:00Z", "2026-04-16T11:00:00Z", null);
        assertThrows(IllegalArgumentException.class, () -> sleepService.addLog(USER_ID, req));
    }

    @Test
    void addLog_throwsIllegalArgument_whenStartedAtIsNull() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new SleepRequest("nap", null, "2026-04-16T11:00:00Z", null);
        assertThrows(IllegalArgumentException.class, () -> sleepService.addLog(USER_ID, req));
    }

    @Test
    void addLog_throwsIllegalArgument_whenEndedAtIsNull() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new SleepRequest("nap", "2026-04-16T10:00:00Z", null, null);
        assertThrows(IllegalArgumentException.class, () -> sleepService.addLog(USER_ID, req));
    }

    @Test
    void addLog_insertsAndReturnsMappedLog_forValidRequest() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        Map<String, Object> row = new HashMap<>();
        row.put("id", LOG_ID); row.put("type", "night");
        row.put("started_at", "2026-04-15T22:00:00Z");
        row.put("ended_at",   "2026-04-16T06:00:00Z");
        row.put("notes", "slept well");
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("night"),
                eq("2026-04-15T22:00:00Z"), eq("2026-04-16T06:00:00Z"), eq("slept well")))
            .thenReturn(row);

        var req = new SleepRequest("night", "2026-04-15T22:00:00Z", "2026-04-16T06:00:00Z", "slept well");
        SleepLog log = sleepService.addLog(USER_ID, req);

        assertEquals("night", log.type());
        assertEquals(LOG_ID, log.id());
    }

    // ── deleteLog ─────────────────────────────────────────────────────────────

    @Test
    void deleteLog_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertFalse(sleepService.deleteLog(USER_ID, LOG_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void deleteLog_returnsFalse_whenLogNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(LOG_ID), eq(PROFILE_ID))).thenReturn(0);
        assertFalse(sleepService.deleteLog(USER_ID, LOG_ID));
    }

    @Test
    void deleteLog_returnsTrue_whenLogDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(LOG_ID), eq(PROFILE_ID))).thenReturn(1);
        assertTrue(sleepService.deleteLog(USER_ID, LOG_ID));
    }
}
