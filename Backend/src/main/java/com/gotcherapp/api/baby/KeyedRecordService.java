package com.gotcherapp.api.baby;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public abstract class KeyedRecordService {

    protected final JdbcTemplate jdbc;
    protected final BabyProfileRepository repo;
    private final String tableName;
    private final String keyColumn;
    private final String orderByColumn;

    protected KeyedRecordService(JdbcTemplate jdbc, BabyProfileRepository repo,
                                  String tableName, String keyColumn, String orderByColumn) {
        this.jdbc = jdbc;
        this.repo = repo;
        this.tableName = tableName;
        this.keyColumn = keyColumn;
        this.orderByColumn = orderByColumn;
    }

    public List<String> getKeys(Long userId) {
        Optional<Long> profileId = repo.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT " + keyColumn + " FROM " + tableName +
            " WHERE baby_profile_id = ? ORDER BY " + orderByColumn,
            String.class, profileId.get()
        );
    }

    /**
     * Achieved records with the date they were marked, as `[{ key, achievedAt }]` (achievedAt is a
     * noon-anchorable `YYYY-MM-DD` string). The order column is a timestamp for every subclass
     * (milestones.achieved_at, vaccine_records.administered_at), so to_char is safe.
     */
    public List<Map<String, Object>> getAchieved(Long userId) {
        Optional<Long> profileId = repo.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT " + keyColumn + " AS key, to_char(" + orderByColumn + ", 'YYYY-MM-DD') AS \"achievedAt\"" +
            " FROM " + tableName +
            " WHERE baby_profile_id = ? ORDER BY " + orderByColumn,
            profileId.get()
        );
    }

    protected void doMark(Long userId, String key) {
        Long profileId = repo.requireProfileId(userId);
        jdbc.update(
            "INSERT INTO " + tableName + " (baby_profile_id, " + keyColumn + ") VALUES (?, ?)" +
            " ON CONFLICT (baby_profile_id, " + keyColumn + ") DO NOTHING",
            profileId, key
        );
    }

    protected void doUnmark(Long userId, String key) {
        Optional<Long> profileId = repo.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return;
        jdbc.update(
            "DELETE FROM " + tableName + " WHERE baby_profile_id = ? AND " + keyColumn + " = ?",
            profileId.get(), key
        );
    }
}
