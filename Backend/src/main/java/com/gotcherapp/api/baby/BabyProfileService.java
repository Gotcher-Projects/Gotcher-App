package com.gotcherapp.api.baby;

import com.gotcherapp.api.baby.dto.BabyProfileRequest;
import com.gotcherapp.api.baby.dto.BabyProfileResponse;
import com.gotcherapp.api.upload.ImageUploadService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class BabyProfileService {

    private final JdbcTemplate jdbc;
    private final ImageUploadService imageUploadService;

    public BabyProfileService(JdbcTemplate jdbc, ImageUploadService imageUploadService) {
        this.jdbc = jdbc;
        this.imageUploadService = imageUploadService;
    }

    private static final java.util.Set<String> VALID_THEMES =
        java.util.Set.of("classic", "coral", "midnight", "meadow");

    public Optional<BabyProfileResponse> getProfile(Long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, baby_name, birthdate, parent_name, phone, sex, book_theme, cover_photo_url, cover_subtitle FROM baby_profiles WHERE user_id = ?",
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
            RETURNING id, baby_name, birthdate, parent_name, phone, sex, book_theme, cover_photo_url, cover_subtitle
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

    public boolean updateBookTheme(Long userId, String theme) {
        if (!VALID_THEMES.contains(theme)) {
            throw new IllegalArgumentException("Invalid theme: " + theme);
        }
        int rows = jdbc.update(
            "UPDATE baby_profiles SET book_theme = ?, updated_at = NOW() WHERE user_id = ?",
            theme, userId
        );
        return rows > 0;
    }

    public String uploadCoverPhoto(Long userId, MultipartFile file) throws IOException {
        String url = imageUploadService.upload(file, "babies", userId);
        jdbc.update(
            "UPDATE baby_profiles SET cover_photo_url = ?, updated_at = NOW() WHERE user_id = ?",
            url, userId
        );
        return url;
    }

    public void updateCoverSubtitle(Long userId, String subtitle) {
        jdbc.update(
            "UPDATE baby_profiles SET cover_subtitle = ?, updated_at = NOW() WHERE user_id = ?",
            subtitle, userId
        );
    }

    private BabyProfileResponse mapRow(Map<String, Object> row) {
        Object bd = row.get("birthdate");
        String birthdate = bd != null ? bd.toString() : null;
        String bookTheme = row.get("book_theme") != null ? (String) row.get("book_theme") : "classic";
        return new BabyProfileResponse(
            ((Number) row.get("id")).longValue(),
            (String) row.get("baby_name"),
            birthdate,
            (String) row.get("parent_name"),
            (String) row.get("phone"),
            (String) row.get("sex"),
            bookTheme,
            (String) row.get("cover_photo_url"),
            (String) row.get("cover_subtitle")
        );
    }
}
