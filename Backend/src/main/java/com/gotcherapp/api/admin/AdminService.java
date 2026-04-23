package com.gotcherapp.api.admin;

import com.gotcherapp.api.upload.ImageUploadService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminService {

    private final JdbcTemplate jdbc;
    private final ImageUploadService imageUploadService;

    public AdminService(JdbcTemplate jdbc, ImageUploadService imageUploadService) {
        this.jdbc = jdbc;
        this.imageUploadService = imageUploadService;
    }

    @Transactional
    public DeletionReport deleteAccount(String email) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM users WHERE email = ?", email.toLowerCase());
        if (rows.isEmpty()) throw new UserNotFoundException("No account found for: " + email);

        Long userId = ((Number) rows.get(0).get("id")).longValue();

        // Cloudinary is best-effort — run before DB deletes, never throws
        Map<String, Object> cloudinary = imageUploadService.deleteAllForUser(userId);

        Map<String, Integer> deleted = new LinkedHashMap<>();
        deleted.put("email_verification_tokens",
            jdbc.update("DELETE FROM email_verification_tokens WHERE user_id = ?", userId));
        deleted.put("refresh_tokens",
            jdbc.update("DELETE FROM refresh_tokens WHERE user_id = ?", userId));

        List<Long> profileIds = jdbc.queryForList(
            "SELECT id FROM baby_profiles WHERE user_id = ?", Long.class, userId);

        String[] profileTables = {
            "feeding_logs", "sleep_logs", "diaper_logs", "milestones",
            "growth_records", "vaccine_records", "appointments", "journal_entries", "first_times"
        };
        for (String table : profileTables) {
            int count = 0;
            for (Long profileId : profileIds) {
                count += jdbc.update("DELETE FROM " + table + " WHERE baby_profile_id = ?", profileId);
            }
            deleted.put(table, count);
        }

        deleted.put("baby_profiles",
            jdbc.update("DELETE FROM baby_profiles WHERE user_id = ?", userId));
        deleted.put("users",
            jdbc.update("DELETE FROM users WHERE id = ?", userId));

        return new DeletionReport(email, userId, deleted, cloudinary);
    }

    public static class UserNotFoundException extends RuntimeException {
        public UserNotFoundException(String msg) { super(msg); }
    }
}
