package com.gotcherapp.api.sleep;

import com.gotcherapp.api.baby.BabyProfileRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class SleepService {

    private static final Set<String> VALID_TYPES = Set.of("nap", "night");

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public SleepService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<SleepLog> getLogs(Long userId, int limitDays) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList("""
            SELECT id, type, started_at, ended_at, notes
            FROM sleep_logs
            WHERE baby_profile_id = ?
              AND started_at >= NOW() - (? || ' days')::INTERVAL
            ORDER BY started_at DESC
            """,
            profileId.get(), limitDays
        ).stream().map(this::mapRow).toList();
    }

    public SleepLog addLog(Long userId, SleepRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new IllegalStateException("No baby profile found. Save a baby profile first.");
        if (!VALID_TYPES.contains(req.type())) {
            throw new IllegalArgumentException("Invalid sleep type: " + req.type());
        }
        if (req.startedAt() == null || req.endedAt() == null) {
            throw new IllegalArgumentException("startedAt and endedAt are required.");
        }
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO sleep_logs (baby_profile_id, type, started_at, ended_at, notes)
            VALUES (?, ?, ?::timestamptz, ?::timestamptz, ?)
            RETURNING id, type, started_at, ended_at, notes
            """,
            profileId.get(), req.type(), req.startedAt(), req.endedAt(), req.notes()
        );
        return mapRow(row);
    }

    public boolean deleteLog(Long userId, Long id) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM sleep_logs WHERE id = ? AND baby_profile_id = ?",
            id, profileId.get()
        );
        return rows > 0;
    }

    private SleepLog mapRow(Map<String, Object> row) {
        Object startedAt = row.get("started_at");
        Object endedAt   = row.get("ended_at");
        return new SleepLog(
            ((Number) row.get("id")).longValue(),
            (String) row.get("type"),
            startedAt != null ? startedAt.toString() : null,
            endedAt   != null ? endedAt.toString()   : null,
            (String) row.get("notes")
        );
    }
}
