package com.gotcherapp.api.feeding;

import com.gotcherapp.api.baby.BabyProfileRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class FeedingService {

    private static final Set<String> VALID_TYPES = Set.of(
        "breast_left", "breast_right", "bottle", "formula", "solids"
    );

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public FeedingService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    /** Returns logs from the past {@code limitDays} days, newest first. */
    public List<FeedingLog> getLogs(Long userId, int limitDays) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList("""
            SELECT id, type, started_at, ended_at, amount_ml, notes
            FROM feeding_logs
            WHERE baby_profile_id = ?
              AND started_at >= NOW() - (? || ' days')::INTERVAL
            ORDER BY started_at DESC
            """,
            profileId.get(), limitDays
        ).stream().map(this::mapRow).toList();
    }

    public FeedingLog startFeed(Long userId, StartFeedRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new IllegalStateException("No baby profile found. Save a baby profile first.");
        if (!VALID_TYPES.contains(req.type())) {
            throw new IllegalArgumentException("Invalid feed type: " + req.type());
        }
        String startedAt = req.startedAt() != null ? req.startedAt() : OffsetDateTime.now().toString();
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO feeding_logs (baby_profile_id, type, started_at)
            VALUES (?, ?, ?::timestamptz)
            RETURNING id, type, started_at, ended_at, amount_ml, notes
            """,
            profileId.get(), req.type(), startedAt
        );
        return mapRow(row);
    }

    public Optional<FeedingLog> stopFeed(Long userId, Long id, StopFeedRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();
        String endedAt = req.endedAt() != null ? req.endedAt() : OffsetDateTime.now().toString();
        List<Map<String, Object>> rows = jdbc.queryForList("""
            UPDATE feeding_logs
               SET ended_at = ?::timestamptz, amount_ml = ?, notes = ?
             WHERE id = ? AND baby_profile_id = ?
            RETURNING id, type, started_at, ended_at, amount_ml, notes
            """,
            endedAt, req.amountMl(), req.notes(), id, profileId.get()
        );
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(mapRow(rows.get(0)));
    }

    public boolean deleteFeed(Long userId, Long id) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM feeding_logs WHERE id = ? AND baby_profile_id = ?",
            id, profileId.get()
        );
        return rows > 0;
    }

    private FeedingLog mapRow(Map<String, Object> row) {
        Object startedAt = row.get("started_at");
        Object endedAt   = row.get("ended_at");
        Object amountMl  = row.get("amount_ml");
        return new FeedingLog(
            ((Number) row.get("id")).longValue(),
            (String) row.get("type"),
            startedAt != null ? startedAt.toString() : null,
            endedAt   != null ? endedAt.toString()   : null,
            amountMl  != null ? ((Number) amountMl).intValue() : null,
            (String) row.get("notes")
        );
    }
}
