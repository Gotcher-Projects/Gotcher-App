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
class VaccineServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks VaccineService vaccineService;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID = 42L;
    private static final String KEY      = "dtap-1";

    // ── getKeys ───────────────────────────────────────────────────────────────

    @Test
    void getKeys_returnsEmptyList_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(List.of(), vaccineService.getKeys(USER_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void getKeys_returnsKeys_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(PROFILE_ID)))
            .thenReturn(List.of("dtap-1", "hepb-1"));

        List<String> keys = vaccineService.getKeys(USER_ID);

        assertEquals(2, keys.size());
        assertTrue(keys.contains("dtap-1"));
    }

    // ── markAdministered ──────────────────────────────────────────────────────

    @Test
    void markAdministered_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        assertThrows(IllegalStateException.class, () -> vaccineService.markAdministered(USER_ID, KEY));
        verifyNoInteractions(jdbc);
    }

    @Test
    void markAdministered_insertsRow_whenProfileExists() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);

        assertDoesNotThrow(() -> vaccineService.markAdministered(USER_ID, KEY));

        verify(jdbc).update(anyString(), eq(PROFILE_ID), eq(KEY));
    }

    @Test
    void markAdministered_isIdempotent_whenCalledTwice() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        // ON CONFLICT DO NOTHING — returns 0 rows for duplicate
        when(jdbc.update(anyString(), eq(PROFILE_ID), eq(KEY))).thenReturn(0);

        assertDoesNotThrow(() -> {
            vaccineService.markAdministered(USER_ID, KEY);
            vaccineService.markAdministered(USER_ID, KEY);
        });
        verify(jdbc, times(2)).update(anyString(), eq(PROFILE_ID), eq(KEY));
    }

    // ── markNotAdministered ───────────────────────────────────────────────────

    @Test
    void markNotAdministered_doesNothing_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> vaccineService.markNotAdministered(USER_ID, KEY));
        verifyNoInteractions(jdbc);
    }

    @Test
    void markNotAdministered_deletesRow_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));

        assertDoesNotThrow(() -> vaccineService.markNotAdministered(USER_ID, KEY));

        verify(jdbc).update(anyString(), eq(PROFILE_ID), eq(KEY));
    }

    @Test
    void markNotAdministered_isIdempotent_whenKeyNotPresent() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(PROFILE_ID), eq(KEY))).thenReturn(0);

        assertDoesNotThrow(() -> vaccineService.markNotAdministered(USER_ID, KEY));
    }
}
