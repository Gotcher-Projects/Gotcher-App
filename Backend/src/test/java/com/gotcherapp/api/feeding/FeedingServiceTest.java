package com.gotcherapp.api.feeding;

import com.gotcherapp.api.baby.BabyProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FeedingServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks FeedingService feedingService;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID = 42L;
    private static final Long LOG_ID     = 7L;

    // ── getLogs ───────────────────────────────────────────────────────────────

    @Test
    void getLogs_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());

        assertEquals(List.of(), feedingService.getLogs(USER_ID, 7));
        verifyNoInteractions(jdbc);
    }

    @Test
    void getLogs_returnsLogs_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID), eq(7))).thenReturn(List.of(buildRow(true)));

        List<FeedingLog> logs = feedingService.getLogs(USER_ID, 7);

        assertEquals(1, logs.size());
        assertEquals("breast_left", logs.get(0).type());
    }

    // ── startFeed ─────────────────────────────────────────────────────────────

    @Test
    void startFeed_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        var req = new StartFeedRequest("breast_left", null);

        assertThrows(IllegalStateException.class, () -> feedingService.startFeed(USER_ID, req));
        verifyNoInteractions(jdbc);
    }

    @Test
    void startFeed_throwsIllegalArgument_whenInvalidType() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new StartFeedRequest("coffee", null);

        assertThrows(IllegalArgumentException.class, () -> feedingService.startFeed(USER_ID, req));
        verifyNoInteractions(jdbc);
    }

    @Test
    void startFeed_returnsLog_onSuccess() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("bottle"), any())).thenReturn(buildRow(false));

        var req = new StartFeedRequest("bottle", "2026-03-27T10:00:00Z");
        FeedingLog log = feedingService.startFeed(USER_ID, req);

        assertEquals("breast_left", log.type()); // buildRow always returns breast_left
        assertNotNull(log.startedAt());
    }

    // ── stopFeed ──────────────────────────────────────────────────────────────

    @Test
    void stopFeed_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        var req = new StopFeedRequest("2026-03-27T10:30:00Z", null, null);

        assertEquals(Optional.empty(), feedingService.stopFeed(USER_ID, LOG_ID, req));
        verifyNoInteractions(jdbc);
    }

    @Test
    void stopFeed_returnsEmpty_whenLogNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        // Mockito returns empty List by default for queryForList; no stub needed — empty == not found
        var req = new StopFeedRequest(null, null, null);

        assertEquals(Optional.empty(), feedingService.stopFeed(USER_ID, LOG_ID, req));
    }

    @Test
    void stopFeed_returnsUpdatedLog_onSuccess() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> completedRow = buildRow(true);
        // Use explicit endedAt so the service passes it directly, and we can match with eq()
        var req = new StopFeedRequest("2026-01-15T10:20:00Z", null, null);
        when(jdbc.queryForList(anyString(), eq("2026-01-15T10:20:00Z"), isNull(), isNull(), eq(LOG_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(completedRow));

        Optional<FeedingLog> result = feedingService.stopFeed(USER_ID, LOG_ID, req);

        assertTrue(result.isPresent());
        assertNotNull(result.get().endedAt());
    }

    // ── deleteFeed ────────────────────────────────────────────────────────────

    @Test
    void deleteFeed_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());

        assertFalse(feedingService.deleteFeed(USER_ID, LOG_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void deleteFeed_returnsFalse_whenLogNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(LOG_ID), eq(PROFILE_ID))).thenReturn(0);

        assertFalse(feedingService.deleteFeed(USER_ID, LOG_ID));
    }

    @Test
    void deleteFeed_returnsTrue_whenDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(LOG_ID), eq(PROFILE_ID))).thenReturn(1);

        assertTrue(feedingService.deleteFeed(USER_ID, LOG_ID));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> buildRow(boolean withEndedAt) {
        Map<String, Object> row = new HashMap<>();
        row.put("id",         LOG_ID);
        row.put("type",       "breast_left");
        row.put("started_at", "2026-03-27T10:00:00Z");
        row.put("ended_at",   withEndedAt ? "2026-03-27T10:20:00Z" : null);
        row.put("amount_ml",  null);
        row.put("notes",      null);
        return row;
    }
}
