package com.gotcherapp.api.appointments;

import com.gotcherapp.api.appointments.dto.AppointmentRequest;
import com.gotcherapp.api.appointments.dto.AppointmentResponse;
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
class AppointmentServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @InjectMocks AppointmentService appointmentService;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID = 99L;
    private static final Long APPT_ID   = 10L;

    private Map<String, Object> sampleRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", APPT_ID);
        row.put("appointment_date", "2026-05-10");
        row.put("doctor_name", "Dr. Smith");
        row.put("appointment_type", "Well visit");
        row.put("notes", null);
        row.put("is_completed", false);
        row.put("created_at", "2026-04-01T00:00:00Z");
        return row;
    }

    // ── findAll ───────────────────────────────────────────────────────────────

    @Test
    void findAll_returnsEmptyList_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(List.of(), appointmentService.findAll(USER_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void findAll_returnsMappedList_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID))).thenReturn(List.of(sampleRow()));

        List<AppointmentResponse> result = appointmentService.findAll(USER_ID);

        assertEquals(1, result.size());
        assertEquals("Dr. Smith", result.get(0).doctorName());
        assertFalse(result.get(0).isCompleted());
    }

    // ── create ────────────────────────────────────────────────────────────────

    @Test
    void create_throwsIllegalState_whenNoProfile() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenThrow(IllegalStateException.class);
        var req = new AppointmentRequest("2026-05-10", null, "Dr. Smith", "Well visit", null, false);
        assertThrows(IllegalStateException.class, () -> appointmentService.create(USER_ID, req));
    }

    @Test
    void create_throwsIllegalArgument_whenDateIsBlank() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new AppointmentRequest("", null, "Dr. Smith", "Well visit", null, false);
        assertThrows(IllegalArgumentException.class, () -> appointmentService.create(USER_ID, req));
    }

    @Test
    void create_throwsIllegalArgument_whenDateIsNull() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        var req = new AppointmentRequest(null, null, "Dr. Smith", "Well visit", null, false);
        assertThrows(IllegalArgumentException.class, () -> appointmentService.create(USER_ID, req));
    }

    @Test
    void create_returnsAppointment_forValidRequest() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("2026-05-10"),
                isNull(), eq("Dr. Smith"), eq("Well visit"), isNull(), eq(false)))
            .thenReturn(sampleRow());

        var req = new AppointmentRequest("2026-05-10", null, "Dr. Smith", "Well visit", null, false);
        AppointmentResponse result = appointmentService.create(USER_ID, req);

        assertEquals("Well visit", result.appointmentType());
        assertEquals("2026-05-10", result.appointmentDate());
    }

    @Test
    void create_defaultsIsCompleted_toFalse_whenNull() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("2026-05-10"),
                isNull(), isNull(), isNull(), isNull(), eq(false)))
            .thenReturn(sampleRow());

        var req = new AppointmentRequest("2026-05-10", null, null, null, null, null);
        assertDoesNotThrow(() -> appointmentService.create(USER_ID, req));
    }

    // ── update ────────────────────────────────────────────────────────────────

    @Test
    void update_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        var req = new AppointmentRequest(null, null, "Dr. Jones", null, null, null);
        assertEquals(Optional.empty(), appointmentService.update(USER_ID, APPT_ID, req));
    }

    @Test
    void update_performsSelectOnly_whenPatchIsEmpty() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("SELECT"), eq(APPT_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(sampleRow()));

        var req = new AppointmentRequest(null, null, null, null, null, null);
        Optional<AppointmentResponse> result = appointmentService.update(USER_ID, APPT_ID, req);

        assertTrue(result.isPresent());
    }

    @Test
    void update_updatesFields_forPartialPatch() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> updated = new HashMap<>(sampleRow());
        updated.put("is_completed", true);
        when(jdbc.queryForList(contains("UPDATE appointments SET is_completed"), eq(true), eq(APPT_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(updated));

        var req = new AppointmentRequest(null, null, null, null, null, true);
        Optional<AppointmentResponse> result = appointmentService.update(USER_ID, APPT_ID, req);

        assertTrue(result.isPresent());
        assertTrue(result.get().isCompleted());
    }

    @Test
    void update_returnsEmpty_whenAppointmentNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("UPDATE appointments"), eq("Dr. Jones"), eq(APPT_ID), eq(PROFILE_ID))).thenReturn(List.of());

        var req = new AppointmentRequest(null, null, "Dr. Jones", null, null, null);
        assertEquals(Optional.empty(), appointmentService.update(USER_ID, APPT_ID, req));
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Test
    void delete_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertFalse(appointmentService.delete(USER_ID, APPT_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void delete_returnsFalse_whenAppointmentNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(APPT_ID), eq(PROFILE_ID))).thenReturn(0);
        assertFalse(appointmentService.delete(USER_ID, APPT_ID));
    }

    @Test
    void delete_returnsTrue_whenDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(APPT_ID), eq(PROFILE_ID))).thenReturn(1);
        assertTrue(appointmentService.delete(USER_ID, APPT_ID));
    }
}
