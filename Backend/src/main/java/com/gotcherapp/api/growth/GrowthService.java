package com.gotcherapp.api.growth;

import com.gotcherapp.api.baby.BabyProfileRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class GrowthService {

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public GrowthService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<GrowthRecord> getRecords(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT id, recorded_date, weight_lbs, height_in, head_in, notes FROM growth_records WHERE baby_profile_id = ? ORDER BY recorded_date DESC",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    public GrowthRecord addRecord(Long userId, GrowthRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new IllegalStateException("No baby profile found. Save a baby profile first.");
        if (req.recordedDate() == null || req.recordedDate().isBlank()) {
            throw new IllegalArgumentException("recordedDate is required");
        }
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO growth_records (baby_profile_id, recorded_date, weight_lbs, height_in, head_in, notes)
            VALUES (?, ?::date, ?, ?, ?, ?)
            RETURNING id, recorded_date, weight_lbs, height_in, head_in, notes
            """,
            profileId.get(),
            req.recordedDate(),
            req.weightLbs(),
            req.heightIn(),
            req.headIn(),
            req.notes()
        );
        return mapRow(row);
    }

    public boolean deleteRecord(Long userId, Long recordId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM growth_records WHERE id = ? AND baby_profile_id = ?",
            recordId, profileId.get()
        );
        return rows > 0;
    }

    private GrowthRecord mapRow(Map<String, Object> row) {
        Object rd = row.get("recorded_date");
        return new GrowthRecord(
            ((Number) row.get("id")).longValue(),
            rd != null ? rd.toString() : null,
            toBigDecimal(row.get("weight_lbs")),
            toBigDecimal(row.get("height_in")),
            toBigDecimal(row.get("head_in")),
            (String) row.get("notes")
        );
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd;
        return new BigDecimal(value.toString());
    }
}
