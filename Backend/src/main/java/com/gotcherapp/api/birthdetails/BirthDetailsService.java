package com.gotcherapp.api.birthdetails;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.birthdetails.dto.BirthDetailsRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class BirthDetailsService {

    private static final String COLS =
        "id, baby_profile_id, to_char(birth_time, 'HH24:MI') AS birth_time, hospital, " +
        "weight_lbs, height_in, head_in, birth_type, birth_story, birth_photo_url";

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public BirthDetailsService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    /** Returns the profile's birth details, or BirthDetails.empty() if none recorded yet. */
    public BirthDetails getOrEmpty(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return BirthDetails.empty();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " + COLS + " FROM birth_details WHERE baby_profile_id = ?",
            profileId.get()
        );
        return rows.isEmpty() ? BirthDetails.empty() : mapRow(rows.get(0));
    }

    /** Upserts the single birth_details row for this profile (one per baby). */
    public BirthDetails upsert(Long userId, BirthDetailsRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO birth_details
                (baby_profile_id, birth_time, hospital, weight_lbs, height_in, head_in, birth_type, birth_story, birth_photo_url)
            VALUES (?, ?::time, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (baby_profile_id) DO UPDATE SET
                birth_time      = EXCLUDED.birth_time,
                hospital        = EXCLUDED.hospital,
                weight_lbs      = EXCLUDED.weight_lbs,
                height_in       = EXCLUDED.height_in,
                head_in         = EXCLUDED.head_in,
                birth_type      = EXCLUDED.birth_type,
                birth_story     = EXCLUDED.birth_story,
                birth_photo_url = EXCLUDED.birth_photo_url,
                updated_at      = NOW()
            """ + "RETURNING " + COLS,
            profileId,
            blankToNull(req.birthTime()),
            req.hospital(),
            req.weightLbs(),
            req.heightIn(),
            req.headIn(),
            blankToNull(req.birthType()),
            req.birthStory(),
            blankToNull(req.birthPhotoUrl())
        );
        return mapRow(row);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private BirthDetails mapRow(Map<String, Object> row) {
        return new BirthDetails(
            row.get("id") != null ? ((Number) row.get("id")).longValue() : null,
            row.get("baby_profile_id") != null ? ((Number) row.get("baby_profile_id")).longValue() : null,
            (String) row.get("birth_time"),
            (String) row.get("hospital"),
            toDouble(row.get("weight_lbs")),
            toDouble(row.get("height_in")),
            toDouble(row.get("head_in")),
            (String) row.get("birth_type"),
            (String) row.get("birth_story"),
            (String) row.get("birth_photo_url")
        );
    }

    private static Double toDouble(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }
}
