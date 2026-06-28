package com.gotcherapp.api.baby;

import com.gotcherapp.api.baby.dto.BabyProfileRequest;
import com.gotcherapp.api.baby.dto.BabyProfileResponse;
import com.gotcherapp.api.upload.ImageUploadService;
import com.gotcherapp.api.upload.UploadFolder;
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

    private static final java.util.Set<String> VALID_PHASES =
        java.util.Set.of("pregnancy", "baby");

    private static final java.util.Set<String> VALID_SEXES =
        java.util.Set.of("boy", "girl");

    public Optional<BabyProfileResponse> getProfile(Long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, baby_name, birthdate, parent_name, phone, sex, book_theme, cover_photo_url, cover_subtitle, due_date, phase, photo_url FROM baby_profiles WHERE user_id = ?",
            userId
        );
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(mapRow(rows.get(0)));
    }

    public BabyProfileResponse upsert(Long userId, BabyProfileRequest req) {
        String birthdate = (req.birthdate() != null && !req.birthdate().isBlank()) ? req.birthdate() : null;
        String dueDate = (req.dueDate() != null && !req.dueDate().isBlank()) ? req.dueDate() : null;
        String phase = req.phase();
        if (phase == null || !VALID_PHASES.contains(phase)) {
            throw new IllegalArgumentException("Invalid phase: " + phase);
        }
        // phase is in the INSERT (NOT NULL, no default) but deliberately omitted from the UPDATE:
        // a normal profile-form save can never change phase. Both dates are COALESCE-protected so a
        // save in one mode never wipes the other mode's date.
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO baby_profiles (user_id, baby_name, birthdate, parent_name, phone, sex, due_date, phase)
            VALUES (?, ?, ?::date, ?, ?, ?, ?::date, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                baby_name   = EXCLUDED.baby_name,
                birthdate   = COALESCE(EXCLUDED.birthdate, baby_profiles.birthdate),
                due_date    = COALESCE(EXCLUDED.due_date,  baby_profiles.due_date),
                parent_name = EXCLUDED.parent_name,
                phone       = EXCLUDED.phone,
                sex         = EXCLUDED.sex,
                updated_at  = NOW()
            RETURNING id, baby_name, birthdate, parent_name, phone, sex, book_theme, cover_photo_url, cover_subtitle, due_date, phase, photo_url
            """,
            userId,
            req.babyName(),
            birthdate,
            req.parentName(),
            req.phone(),
            req.sex(),
            dueDate,
            phase
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

    // Dedicated narrow writer for the guarded settings-only phase reversal. Not wired to any casual
    // toggle — phase never flows through the upsert's UPDATE path.
    public boolean updatePhase(Long userId, String phase) {
        if (phase == null || !VALID_PHASES.contains(phase)) {
            throw new IllegalArgumentException("Invalid phase: " + phase);
        }
        int rows = jdbc.update(
            "UPDATE baby_profiles SET phase = ?, updated_at = NOW() WHERE user_id = ?",
            phase, userId
        );
        return rows > 0;
    }

    // Deliberate milestone: sets birthdate + swaps to baby in one write, preserves due_date.
    // sex is optional: null means "leave sex untouched"; a present value updates it in the same
    // write (the pregnancy "not sure yet" → reveal-at-birth flow). Empty/blank clears it to null
    // ("prefer not to say"); a non-blank value must be a recognized sex.
    public boolean markAsBorn(Long userId, String birthdate, String sex) {
        if (birthdate == null || birthdate.isBlank()) {
            throw new IllegalArgumentException("birthdate is required");
        }
        if (sex == null) {
            int rows = jdbc.update(
                "UPDATE baby_profiles SET birthdate = ?::date, phase = 'baby', updated_at = NOW() WHERE user_id = ?",
                birthdate, userId
            );
            return rows > 0;
        }
        String sexVal = sex.isBlank() ? null : sex;
        if (sexVal != null && !VALID_SEXES.contains(sexVal)) {
            throw new IllegalArgumentException("Invalid sex: " + sex);
        }
        int rows = jdbc.update(
            "UPDATE baby_profiles SET birthdate = ?::date, phase = 'baby', sex = ?, updated_at = NOW() WHERE user_id = ?",
            birthdate, sexVal, userId
        );
        return rows > 0;
    }

    public String uploadCoverPhoto(Long userId, MultipartFile file) throws IOException {
        String url = imageUploadService.upload(file, UploadFolder.BABIES.folderName(), userId);
        jdbc.update(
            "UPDATE baby_profiles SET cover_photo_url = ?, updated_at = NOW() WHERE user_id = ?",
            url, userId
        );
        return url;
    }

    // Square avatar for the profile summary card — distinct from the book cover photo above.
    public String uploadPhoto(Long userId, MultipartFile file) throws IOException {
        String url = imageUploadService.upload(file, UploadFolder.BABIES.folderName(), userId);
        jdbc.update(
            "UPDATE baby_profiles SET photo_url = ?, updated_at = NOW() WHERE user_id = ?",
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
        Object dd = row.get("due_date");
        String dueDate = dd != null ? dd.toString() : null;
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
            (String) row.get("cover_subtitle"),
            dueDate,
            (String) row.get("phase"),
            (String) row.get("photo_url")
        );
    }
}
