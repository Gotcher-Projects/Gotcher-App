package com.gotcherapp.api.firsttimes;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.firsttimes.dto.CreateFirstTimeRequest;
import com.gotcherapp.api.firsttimes.dto.UpdateFirstTimeRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class FirstTimeService {

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public FirstTimeService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<FirstTime> findAll(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT id, baby_profile_id, label, occurred_date, image_url, notes, created_at " +
            "FROM first_times WHERE baby_profile_id = ? ORDER BY occurred_date DESC",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    public FirstTime create(Long userId, CreateFirstTimeRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new IllegalStateException("No baby profile found. Save a baby profile first.");
        if (req.label() == null || req.label().isBlank()) {
            throw new IllegalArgumentException("label is required");
        }
        if (req.occurredDate() == null || req.occurredDate().isBlank()) {
            throw new IllegalArgumentException("occurredDate is required");
        }
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO first_times (baby_profile_id, label, occurred_date, image_url, notes)
            VALUES (?, ?, ?::date, ?, ?)
            RETURNING id, baby_profile_id, label, occurred_date, image_url, notes, created_at
            """,
            profileId.get(),
            req.label(),
            req.occurredDate(),
            req.imageUrl(),
            req.notes()
        );
        return mapRow(row);
    }

    public Optional<FirstTime> update(Long userId, Long id, UpdateFirstTimeRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (req.label() != null)        { setClauses.add("label = ?");               params.add(req.label()); }
        if (req.occurredDate() != null) { setClauses.add("occurred_date = ?::date"); params.add(req.occurredDate()); }
        if (req.notes() != null)        { setClauses.add("notes = ?");               params.add(req.notes()); }
        if (req.imageUrl() != null)     { setClauses.add("image_url = ?");           params.add(req.imageUrl()); }

        if (setClauses.isEmpty()) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, baby_profile_id, label, occurred_date, image_url, notes, created_at " +
                "FROM first_times WHERE id = ? AND baby_profile_id = ?",
                id, profileId.get()
            );
            return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
        }

        params.add(id);
        params.add(profileId.get());

        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE first_times SET " + String.join(", ", setClauses) +
            " WHERE id = ? AND baby_profile_id = ?" +
            " RETURNING id, baby_profile_id, label, occurred_date, image_url, notes, created_at",
            params.toArray()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public boolean delete(Long userId, Long id) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM first_times WHERE id = ? AND baby_profile_id = ?",
            id, profileId.get()
        );
        return rows > 0;
    }

    private FirstTime mapRow(Map<String, Object> row) {
        Object od = row.get("occurred_date");
        Object ca = row.get("created_at");
        return new FirstTime(
            ((Number) row.get("id")).longValue(),
            ((Number) row.get("baby_profile_id")).longValue(),
            (String) row.get("label"),
            od != null ? od.toString() : null,
            (String) row.get("image_url"),
            (String) row.get("notes"),
            ca != null ? ca.toString() : null
        );
    }
}
