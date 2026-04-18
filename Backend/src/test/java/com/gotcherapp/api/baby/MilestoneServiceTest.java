package com.gotcherapp.api.baby;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MilestoneServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks MilestoneService milestoneService;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID = 42L;
    private static final String KEY      = "4-1";

    // ── getKeys ───────────────────────────────────────────────────────────────

    @Test
    void getKeys_returnsEmptyList_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());

        assertEquals(List.of(), milestoneService.getKeys(USER_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void getKeys_returnsKeys_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(PROFILE_ID)))
            .thenReturn(List.of("4-0", "4-1", "8-2"));

        List<String> keys = milestoneService.getKeys(USER_ID);

        assertEquals(3, keys.size());
        assertTrue(keys.contains("4-1"));
    }

    @Test
    void getKeys_returnsEmpty_whenNoMilestonesAchieved() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(PROFILE_ID)))
            .thenReturn(List.of());

        assertEquals(List.of(), milestoneService.getKeys(USER_ID));
    }

    // ── achieve ───────────────────────────────────────────────────────────────

    @Test
    void achieve_insertsRow_whenProfileExists() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);

        milestoneService.achieve(USER_ID, KEY);

        verify(jdbc).update(anyString(), eq(PROFILE_ID), eq(KEY));
    }

    @Test
    void achieve_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);

        assertThrows(IllegalStateException.class, () -> milestoneService.achieve(USER_ID, KEY));
        verifyNoInteractions(jdbc);
    }

    @Test
    void achieve_isIdempotent_onConflict() {
        // ON CONFLICT DO NOTHING means calling achieve twice should call update twice without error
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.update(anyString(), eq(PROFILE_ID), eq(KEY))).thenReturn(0); // 0 rows = conflict/no-op

        assertDoesNotThrow(() -> {
            milestoneService.achieve(USER_ID, KEY);
            milestoneService.achieve(USER_ID, KEY);
        });
        verify(jdbc, times(2)).update(anyString(), eq(PROFILE_ID), eq(KEY));
    }

    // ── unachieve ─────────────────────────────────────────────────────────────

    @Test
    void unachieve_deletesRow_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));

        milestoneService.unachieve(USER_ID, KEY);

        verify(jdbc).update(anyString(), eq(PROFILE_ID), eq(KEY));
    }

    @Test
    void unachieve_doesNothing_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> milestoneService.unachieve(USER_ID, KEY));
        verifyNoInteractions(jdbc);
    }
}
