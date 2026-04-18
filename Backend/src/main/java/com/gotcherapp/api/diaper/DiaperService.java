package com.gotcherapp.api.diaper;

import com.gotcherapp.api.baby.BabyProfileRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class DiaperService {

    private static final Set<String> VALID_CATEGORIES  = Set.of("pee", "poop");
    private static final Set<String> VALID_TYPES       = Set.of("normal", "loose", "hard");
    private static final Set<String> VALID_COLORS      = Set.of("yellow", "brown", "green", "black", "red", "white", "orange");
    private static final Set<String> VALID_CONSISTENCY = Set.of("normal", "watery", "seedy", "mucusy", "hard");

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public DiaperService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<DiaperLog> getLogs(Long userId, int limitDays) {
        limitDays = Math.min(limitDays, 3650);
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList("""
            SELECT id, logged_at, category, type, color, consistency, notes
            FROM diaper_logs
            WHERE baby_profile_id = ?
              AND logged_at >= NOW() - (? || ' days')::INTERVAL
            ORDER BY logged_at DESC
            """,
            profileId.get(), limitDays
        ).stream().map(this::mapRow).toList();
    }

    public DiaperLog addLog(Long userId, DiaperRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);

        String category = req.category() != null ? req.category() : "poop";
        if (!VALID_CATEGORIES.contains(category)) throw new IllegalArgumentException("Invalid category: " + category);

        String type = null;
        String color = null;
        String consistency = null;

        if ("poop".equals(category)) {
            type = req.type() != null ? req.type() : "normal";
            if (!VALID_TYPES.contains(type)) throw new IllegalArgumentException("Invalid type: " + type);
            color = req.color();
            if (color != null && !VALID_COLORS.contains(color))
                throw new IllegalArgumentException("Invalid color: " + color);
            consistency = req.consistency();
            if (consistency != null && !VALID_CONSISTENCY.contains(consistency))
                throw new IllegalArgumentException("Invalid consistency: " + consistency);
        }

        String loggedAt = req.loggedAt() != null ? req.loggedAt() : OffsetDateTime.now().toString();

        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO diaper_logs (baby_profile_id, logged_at, category, type, color, consistency, notes)
            VALUES (?, ?::timestamptz, ?, ?, ?, ?, ?)
            RETURNING id, logged_at, category, type, color, consistency, notes
            """,
            profileId, loggedAt, category, type, color, consistency, req.notes()
        );
        return mapRow(row);
    }

    public boolean deleteLog(Long userId, Long id) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM diaper_logs WHERE id = ? AND baby_profile_id = ?",
            id, profileId.get()
        );
        return rows > 0;
    }

    private DiaperLog mapRow(Map<String, Object> row) {
        Object loggedAt = row.get("logged_at");
        return new DiaperLog(
            ((Number) row.get("id")).longValue(),
            loggedAt != null ? loggedAt.toString() : null,
            (String) row.get("category"),
            (String) row.get("type"),
            (String) row.get("color"),
            (String) row.get("consistency"),
            (String) row.get("notes")
        );
    }
}
