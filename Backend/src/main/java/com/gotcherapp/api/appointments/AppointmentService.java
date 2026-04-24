package com.gotcherapp.api.appointments;

import com.gotcherapp.api.appointments.dto.AppointmentRequest;
import com.gotcherapp.api.appointments.dto.AppointmentResponse;
import com.gotcherapp.api.baby.BabyProfileRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AppointmentService {

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public AppointmentService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<AppointmentResponse> findAll(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT id, appointment_date, appointment_time, doctor_name, appointment_type, notes, is_completed, created_at " +
            "FROM appointments WHERE baby_profile_id = ? ORDER BY appointment_date ASC",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    public AppointmentResponse create(Long userId, AppointmentRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        if (req.appointmentDate() == null || req.appointmentDate().isBlank()) {
            throw new IllegalArgumentException("appointmentDate is required");
        }
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO appointments (baby_profile_id, appointment_date, appointment_time, doctor_name, appointment_type, notes, is_completed)
            VALUES (?, ?::date, ?::time, ?, ?, ?, ?)
            RETURNING id, appointment_date, appointment_time, doctor_name, appointment_type, notes, is_completed, created_at
            """,
            profileId,
            req.appointmentDate(),
            req.appointmentTime(),
            req.doctorName(),
            req.appointmentType(),
            req.notes(),
            req.isCompleted() != null ? req.isCompleted() : false
        );
        return mapRow(row);
    }

    public Optional<AppointmentResponse> update(Long userId, Long id, AppointmentRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (req.appointmentDate() != null) { setClauses.add("appointment_date = ?::date"); params.add(req.appointmentDate()); }
        if (req.appointmentTime() != null) { setClauses.add("appointment_time = ?::time"); params.add(req.appointmentTime()); }
        if (req.doctorName() != null)      { setClauses.add("doctor_name = ?");            params.add(req.doctorName()); }
        if (req.appointmentType() != null) { setClauses.add("appointment_type = ?");       params.add(req.appointmentType()); }
        if (req.notes() != null)           { setClauses.add("notes = ?");                  params.add(req.notes()); }
        if (req.isCompleted() != null)     { setClauses.add("is_completed = ?");            params.add(req.isCompleted()); }

        if (setClauses.isEmpty()) {
            // Nothing to update — return the current row
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, appointment_date, appointment_time, doctor_name, appointment_type, notes, is_completed, created_at " +
                "FROM appointments WHERE id = ? AND baby_profile_id = ?",
                id, profileId.get()
            );
            return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
        }

        params.add(id);
        params.add(profileId.get());

        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE appointments SET " + String.join(", ", setClauses) +
            " WHERE id = ? AND baby_profile_id = ?" +
            " RETURNING id, appointment_date, appointment_time, doctor_name, appointment_type, notes, is_completed, created_at",
            params.toArray()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public boolean delete(Long userId, Long id) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM appointments WHERE id = ? AND baby_profile_id = ?",
            id, profileId.get()
        );
        return rows > 0;
    }

    private AppointmentResponse mapRow(Map<String, Object> row) {
        Object ad = row.get("appointment_date");
        Object at = row.get("appointment_time");
        Object ca = row.get("created_at");
        return new AppointmentResponse(
            ((Number) row.get("id")).longValue(),
            ad != null ? ad.toString() : null,
            at != null ? at.toString() : null,
            (String) row.get("doctor_name"),
            (String) row.get("appointment_type"),
            (String) row.get("notes"),
            (Boolean) row.get("is_completed"),
            ca != null ? ca.toString() : null
        );
    }
}
