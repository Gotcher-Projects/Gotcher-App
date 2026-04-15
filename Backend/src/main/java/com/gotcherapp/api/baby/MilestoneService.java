package com.gotcherapp.api.baby;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MilestoneService {

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public MilestoneService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<String> getKeys(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT milestone_key FROM milestones WHERE baby_profile_id = ? ORDER BY achieved_at",
            String.class,
            profileId.get()
        );
    }

    public void achieve(Long userId, String key) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new IllegalStateException("No baby profile found. Save a baby profile first.");
        jdbc.update("""
            INSERT INTO milestones (baby_profile_id, milestone_key)
            VALUES (?, ?)
            ON CONFLICT (baby_profile_id, milestone_key) DO NOTHING
            """,
            profileId.get(), key
        );
    }

    public void unachieve(Long userId, String key) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return;
        jdbc.update(
            "DELETE FROM milestones WHERE baby_profile_id = ? AND milestone_key = ?",
            profileId.get(), key
        );
    }
}
