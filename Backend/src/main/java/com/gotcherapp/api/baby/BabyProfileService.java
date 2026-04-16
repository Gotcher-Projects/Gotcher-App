package com.gotcherapp.api.baby;

import com.gotcherapp.api.baby.dto.BabyProfileRequest;
import com.gotcherapp.api.baby.dto.BabyProfileResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class BabyProfileService {

    private final JdbcTemplate jdbc;

    public BabyProfileService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<BabyProfileResponse> getProfile(Long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, baby_name, birthdate, parent_name, phone, sex FROM baby_profiles WHERE user_id = ?",
            userId
        );
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(mapRow(rows.get(0)));
    }

    public BabyProfileResponse upsert(Long userId, BabyProfileRequest req) {
        String birthdate = (req.birthdate() != null && !req.birthdate().isBlank()) ? req.birthdate() : null;
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO baby_profiles (user_id, baby_name, birthdate, parent_name, phone, sex)
            VALUES (?, ?, ?::date, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                baby_name   = EXCLUDED.baby_name,
                birthdate   = EXCLUDED.birthdate,
                parent_name = EXCLUDED.parent_name,
                phone       = EXCLUDED.phone,
                sex         = EXCLUDED.sex,
                updated_at  = NOW()
            RETURNING id, baby_name, birthdate, parent_name, phone, sex
            """,
            userId,
            req.babyName(),
            birthdate,
            req.parentName(),
            req.phone(),
            req.sex()
        );
        return mapRow(row);
    }

    private BabyProfileResponse mapRow(Map<String, Object> row) {
        Object bd = row.get("birthdate");
        String birthdate = bd != null ? bd.toString() : null;
        return new BabyProfileResponse(
            ((Number) row.get("id")).longValue(),
            (String) row.get("baby_name"),
            birthdate,
            (String) row.get("parent_name"),
            (String) row.get("phone"),
            (String) row.get("sex")
        );
    }
}
