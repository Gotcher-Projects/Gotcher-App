package com.gotcherapp.api.baby;

import com.gotcherapp.api.baby.dto.BabyProfileRequest;
import com.gotcherapp.api.baby.dto.BabyProfileResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BabyProfileServiceTest {

    @Mock JdbcTemplate jdbc;
    @InjectMocks BabyProfileService babyProfileService;

    private static final Long USER_ID  = 1L;
    private static final Long PROFILE_ID = 42L;

    // ── getProfile ────────────────────────────────────────────────────────────

    @Test
    void getProfile_returnsEmpty_whenNoProfile() {
        when(jdbc.queryForList(anyString(), eq(USER_ID))).thenReturn(List.of());

        assertEquals(Optional.empty(), babyProfileService.getProfile(USER_ID));
    }

    @Test
    void getProfile_returnsMappedDto_whenProfileExists() {
        Map<String, Object> row = Map.of(
            "id",          PROFILE_ID,
            "baby_name",   "Lily",
            "birthdate",   "2025-06-01",
            "parent_name", "Jane",
            "phone",       "555-0100"
        );
        when(jdbc.queryForList(anyString(), eq(USER_ID))).thenReturn(List.of(row));

        Optional<BabyProfileResponse> result = babyProfileService.getProfile(USER_ID);

        assertTrue(result.isPresent());
        BabyProfileResponse dto = result.get();
        assertEquals(PROFILE_ID, dto.id());
        assertEquals("Lily",       dto.babyName());
        assertEquals("2025-06-01", dto.birthdate());
        assertEquals("Jane",       dto.parentName());
        assertEquals("555-0100",   dto.phone());
    }

    @Test
    void getProfile_handlesNullBirthdate() {
        Map<String, Object> row = new java.util.HashMap<>();
        row.put("id",          PROFILE_ID);
        row.put("baby_name",   "Lily");
        row.put("birthdate",   null);
        row.put("parent_name", "Jane");
        row.put("phone",       null);
        when(jdbc.queryForList(anyString(), eq(USER_ID))).thenReturn(List.of(row));

        Optional<BabyProfileResponse> result = babyProfileService.getProfile(USER_ID);

        assertTrue(result.isPresent());
        assertNull(result.get().birthdate());
    }

    // ── upsert ────────────────────────────────────────────────────────────────

    @Test
    void upsert_returnsProfile_onSuccess() {
        Map<String, Object> row = Map.of(
            "id",          PROFILE_ID,
            "baby_name",   "Lily",
            "birthdate",   "2025-06-01",
            "parent_name", "Jane",
            "phone",       "555-0100"
        );
        when(jdbc.queryForMap(anyString(), eq(USER_ID), eq("Lily"), eq("2025-06-01"), eq("Jane"), eq("555-0100"), isNull()))
            .thenReturn(row);

        var req = new BabyProfileRequest("Lily", "2025-06-01", "Jane", "555-0100", null);
        BabyProfileResponse result = babyProfileService.upsert(USER_ID, req);

        assertEquals("Lily", result.babyName());
        assertEquals(PROFILE_ID, result.id());
    }

    @Test
    void upsert_passesNullBirthdate_whenBlank() {
        Map<String, Object> row = new java.util.HashMap<>();
        row.put("id",          PROFILE_ID);
        row.put("baby_name",   "Lily");
        row.put("birthdate",   null);
        row.put("parent_name", "Jane");
        row.put("phone",       null);
        when(jdbc.queryForMap(anyString(), eq(USER_ID), eq("Lily"), isNull(), eq("Jane"), isNull(), isNull()))
            .thenReturn(row);

        var req = new BabyProfileRequest("Lily", "", "Jane", null, null);
        BabyProfileResponse result = babyProfileService.upsert(USER_ID, req);

        assertNotNull(result);
        assertNull(result.birthdate());
    }
}
