package com.gotcherapp.api.bump;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.bump.dto.CreateBumpPhotoRequest;
import com.gotcherapp.api.bump.dto.UpdateBumpPhotoRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class BumpPhotoService {

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public BumpPhotoService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<BumpPhoto> findAll(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT id, baby_profile_id, week, image_url, note, taken_date, image_orientation, created_at " +
            "FROM bump_photos WHERE baby_profile_id = ? ORDER BY week ASC, created_at ASC",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    public BumpPhoto create(Long userId, CreateBumpPhotoRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        if (req.week() == null) {
            throw new IllegalArgumentException("week is required");
        }
        // S5: the bump diary is also the pregnancy journal, so a photo is optional — but an entry
        // must carry at least a photo OR a note (mirrors the journal's "title or story" guard).
        boolean hasImage = req.imageUrl() != null && !req.imageUrl().isBlank();
        boolean hasNote = req.note() != null && !req.note().isBlank();
        if (!hasImage && !hasNote) {
            throw new IllegalArgumentException("a photo or a note is required");
        }
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO bump_photos (baby_profile_id, week, image_url, note, taken_date, image_orientation)
            VALUES (?, ?, ?, ?, ?::date, COALESCE(?, 'portrait'))
            RETURNING id, baby_profile_id, week, image_url, note, taken_date, image_orientation, created_at
            """,
            profileId,
            req.week(),
            req.imageUrl(),
            req.note(),
            req.takenDate(),
            req.imageOrientation()
        );
        return mapRow(row);
    }

    public Optional<BumpPhoto> update(Long userId, Long id, UpdateBumpPhotoRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (req.week() != null)             { setClauses.add("week = ?");              params.add(req.week()); }
        if (req.note() != null)             { setClauses.add("note = ?");              params.add(req.note()); }
        if (req.takenDate() != null)        { setClauses.add("taken_date = ?::date");  params.add(req.takenDate()); }
        if (req.imageUrl() != null)         { setClauses.add("image_url = ?");         params.add(req.imageUrl()); }
        if (req.imageOrientation() != null) { setClauses.add("image_orientation = ?"); params.add(req.imageOrientation()); }

        if (setClauses.isEmpty()) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, baby_profile_id, week, image_url, note, taken_date, image_orientation, created_at " +
                "FROM bump_photos WHERE id = ? AND baby_profile_id = ?",
                id, profileId.get()
            );
            return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
        }

        params.add(id);
        params.add(profileId.get());

        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE bump_photos SET " + String.join(", ", setClauses) +
            " WHERE id = ? AND baby_profile_id = ?" +
            " RETURNING id, baby_profile_id, week, image_url, note, taken_date, image_orientation, created_at",
            params.toArray()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public boolean delete(Long userId, Long id) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM bump_photos WHERE id = ? AND baby_profile_id = ?",
            id, profileId.get()
        );
        return rows > 0;
    }

    private BumpPhoto mapRow(Map<String, Object> row) {
        Object td = row.get("taken_date");
        Object ca = row.get("created_at");
        return new BumpPhoto(
            ((Number) row.get("id")).longValue(),
            ((Number) row.get("baby_profile_id")).longValue(),
            ((Number) row.get("week")).intValue(),
            (String) row.get("image_url"),
            (String) row.get("note"),
            td != null ? td.toString() : null,
            (String) row.get("image_orientation"),
            ca != null ? ca.toString() : null
        );
    }
}
