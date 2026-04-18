package com.gotcherapp.api.baby;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class BabyProfileRepository {

    private final JdbcTemplate jdbc;

    public BabyProfileRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Returns the baby_profile id for the given user, or empty if none exists. */
    public Optional<Long> findProfileIdByUserId(Long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM baby_profiles WHERE user_id = ?", userId
        );
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(((Number) rows.get(0).get("id")).longValue());
    }

    /** Returns the baby_profile id, or throws IllegalStateException if the user has no profile. */
    public Long requireProfileId(Long userId) {
        return findProfileIdByUserId(userId)
            .orElseThrow(() -> new IllegalStateException("No baby profile found. Save a baby profile first."));
    }
}
