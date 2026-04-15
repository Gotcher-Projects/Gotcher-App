package com.gotcherapp.api.baby;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class VaccineService {

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public VaccineService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<String> getKeys(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT vaccine_key FROM vaccine_records WHERE baby_profile_id = ? ORDER BY administered_at",
            String.class,
            profileId.get()
        );
    }

    public void achieve(Long userId, String key) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new IllegalStateException("No baby profile found. Save a baby profile first.");
        jdbc.update("""
            INSERT INTO vaccine_records (baby_profile_id, vaccine_key)
            VALUES (?, ?)
            ON CONFLICT (baby_profile_id, vaccine_key) DO NOTHING
            """,
            profileId.get(), key
        );
    }

    public void unachieve(Long userId, String key) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return;
        jdbc.update(
            "DELETE FROM vaccine_records WHERE baby_profile_id = ? AND vaccine_key = ?",
            profileId.get(), key
        );
    }
}
