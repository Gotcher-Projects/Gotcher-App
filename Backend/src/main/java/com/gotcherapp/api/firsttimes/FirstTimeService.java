package com.gotcherapp.api.firsttimes;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.firsttimes.dto.AddFirstTimePhotoRequest;
import com.gotcherapp.api.firsttimes.dto.CreateFirstTimeRequest;
import com.gotcherapp.api.firsttimes.dto.UpdateFirstTimeRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class FirstTimeService {

    // Cap on additional (non-hero) photos per first time. Keeps gallery pages bounded and
    // upload volume reasonable. The hero (first_times.image_url) is separate and not counted.
    private static final int MAX_ADDITIONAL_PHOTOS = 8;

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public FirstTimeService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<FirstTime> findAll(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();

        List<FirstTime> firsts = jdbc.queryForList(
            "SELECT id, baby_profile_id, label, occurred_date, image_url, notes, created_at, image_orientation " +
            "FROM first_times WHERE baby_profile_id = ? ORDER BY occurred_date DESC",
            profileId.get()
        ).stream().map(row -> mapRow(row, List.of())).toList();

        if (firsts.isEmpty()) return firsts;

        // One query for all additional photos belonging to this profile's first times, grouped in Java.
        Map<Long, List<FirstTimePhoto>> byFirstTime = new LinkedHashMap<>();
        jdbc.queryForList(
            "SELECT p.id, p.first_time_id, p.image_url, p.caption, p.sort_order, p.created_at " +
            "FROM first_time_photos p " +
            "JOIN first_times f ON f.id = p.first_time_id " +
            "WHERE f.baby_profile_id = ? " +
            "ORDER BY p.first_time_id, p.sort_order, p.id",
            profileId.get()
        ).forEach(row -> {
            FirstTimePhoto photo = mapPhoto(row);
            byFirstTime.computeIfAbsent(photo.firstTimeId(), k -> new ArrayList<>()).add(photo);
        });

        return firsts.stream()
            .map(ft -> withPhotos(ft, byFirstTime.getOrDefault(ft.id(), List.of())))
            .toList();
    }

    public FirstTime create(Long userId, CreateFirstTimeRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        if (req.label() == null || req.label().isBlank()) {
            throw new IllegalArgumentException("label is required");
        }
        if (req.occurredDate() == null || req.occurredDate().isBlank()) {
            throw new IllegalArgumentException("occurredDate is required");
        }
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO first_times (baby_profile_id, label, occurred_date, image_url, notes, image_orientation)
            VALUES (?, ?, ?::date, ?, ?, COALESCE(?, 'landscape'))
            RETURNING id, baby_profile_id, label, occurred_date, image_url, notes, created_at, image_orientation
            """,
            profileId,
            req.label(),
            req.occurredDate(),
            req.imageUrl(),
            req.notes(),
            req.imageOrientation()
        );
        return mapRow(row, List.of());
    }

    public Optional<FirstTime> update(Long userId, Long id, UpdateFirstTimeRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (req.label() != null)            { setClauses.add("label = ?");               params.add(req.label()); }
        if (req.occurredDate() != null)     { setClauses.add("occurred_date = ?::date"); params.add(req.occurredDate()); }
        if (req.notes() != null)            { setClauses.add("notes = ?");               params.add(req.notes()); }
        if (req.imageUrl() != null)         { setClauses.add("image_url = ?");           params.add(req.imageUrl()); }
        if (req.imageOrientation() != null) { setClauses.add("image_orientation = ?");   params.add(req.imageOrientation()); }

        if (setClauses.isEmpty()) {
            return getOwned(id, profileId.get());
        }

        params.add(id);
        params.add(profileId.get());

        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE first_times SET " + String.join(", ", setClauses) +
            " WHERE id = ? AND baby_profile_id = ?" +
            " RETURNING id, baby_profile_id, label, occurred_date, image_url, notes, created_at, image_orientation",
            params.toArray()
        );
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(withPhotos(mapRow(rows.get(0), List.of()), loadPhotos(id)));
    }

    public boolean delete(Long userId, Long id) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM first_times WHERE id = ? AND baby_profile_id = ?",
            id, profileId.get()
        );
        return rows > 0;
    }

    // ── Additional photos ──────────────────────────────────────────────────────

    /** Adds an additional photo to a first time the caller owns. Returns empty if not owned. */
    public Optional<FirstTimePhoto> addPhoto(Long userId, Long firstTimeId, AddFirstTimePhotoRequest req) {
        if (req.imageUrl() == null || req.imageUrl().isBlank()) {
            throw new IllegalArgumentException("imageUrl is required");
        }
        if (!ownsFirstTime(userId, firstTimeId)) return Optional.empty();

        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM first_time_photos WHERE first_time_id = ?", Integer.class, firstTimeId);
        if (count != null && count >= MAX_ADDITIONAL_PHOTOS) {
            throw new IllegalStateException("A first time can have at most " + MAX_ADDITIONAL_PHOTOS + " extra photos");
        }

        Integer nextOrder = jdbc.queryForObject(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM first_time_photos WHERE first_time_id = ?",
            Integer.class, firstTimeId);

        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO first_time_photos (first_time_id, image_url, caption, sort_order)
            VALUES (?, ?, ?, ?)
            RETURNING id, first_time_id, image_url, caption, sort_order, created_at
            """,
            firstTimeId, req.imageUrl(), req.caption(), nextOrder);
        return Optional.of(mapPhoto(row));
    }

    /** Updates a photo's caption. Returns empty if the photo / first time isn't owned. */
    public Optional<FirstTimePhoto> updatePhotoCaption(Long userId, Long firstTimeId, Long photoId, String caption) {
        if (!ownsFirstTime(userId, firstTimeId)) return Optional.empty();
        List<Map<String, Object>> rows = jdbc.queryForList("""
            UPDATE first_time_photos SET caption = ?
            WHERE id = ? AND first_time_id = ?
            RETURNING id, first_time_id, image_url, caption, sort_order, created_at
            """,
            caption, photoId, firstTimeId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapPhoto(rows.get(0)));
    }

    /** Removes an additional photo. Returns false if not found / not owned. */
    public boolean removePhoto(Long userId, Long firstTimeId, Long photoId) {
        if (!ownsFirstTime(userId, firstTimeId)) return false;
        int rows = jdbc.update(
            "DELETE FROM first_time_photos WHERE id = ? AND first_time_id = ?",
            photoId, firstTimeId);
        return rows > 0;
    }

    /** Renumbers sort_order to match orderedIds. Returns the resulting photo list, or empty if not owned. */
    public Optional<List<FirstTimePhoto>> reorderPhotos(Long userId, Long firstTimeId, List<Long> orderedIds) {
        if (!ownsFirstTime(userId, firstTimeId)) return Optional.empty();
        if (orderedIds != null) {
            int order = 0;
            for (Long photoId : orderedIds) {
                jdbc.update(
                    "UPDATE first_time_photos SET sort_order = ? WHERE id = ? AND first_time_id = ?",
                    order++, photoId, firstTimeId);
            }
        }
        return Optional.of(loadPhotos(firstTimeId));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private boolean ownsFirstTime(Long userId, Long firstTimeId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        Integer found = jdbc.queryForObject(
            "SELECT COUNT(*) FROM first_times WHERE id = ? AND baby_profile_id = ?",
            Integer.class, firstTimeId, profileId.get());
        return found != null && found > 0;
    }

    private Optional<FirstTime> getOwned(Long id, Long profileId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, baby_profile_id, label, occurred_date, image_url, notes, created_at, image_orientation " +
            "FROM first_times WHERE id = ? AND baby_profile_id = ?",
            id, profileId);
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(withPhotos(mapRow(rows.get(0), List.of()), loadPhotos(id)));
    }

    private List<FirstTimePhoto> loadPhotos(Long firstTimeId) {
        return jdbc.queryForList(
            "SELECT id, first_time_id, image_url, caption, sort_order, created_at " +
            "FROM first_time_photos WHERE first_time_id = ? ORDER BY sort_order, id",
            firstTimeId
        ).stream().map(this::mapPhoto).toList();
    }

    private FirstTime withPhotos(FirstTime ft, List<FirstTimePhoto> photos) {
        return new FirstTime(
            ft.id(), ft.babyProfileId(), ft.label(), ft.occurredDate(), ft.imageUrl(),
            ft.notes(), ft.createdAt(), ft.imageOrientation(), photos);
    }

    private FirstTime mapRow(Map<String, Object> row, List<FirstTimePhoto> photos) {
        Object od = row.get("occurred_date");
        Object ca = row.get("created_at");
        return new FirstTime(
            ((Number) row.get("id")).longValue(),
            ((Number) row.get("baby_profile_id")).longValue(),
            (String) row.get("label"),
            od != null ? od.toString() : null,
            (String) row.get("image_url"),
            (String) row.get("notes"),
            ca != null ? ca.toString() : null,
            (String) row.get("image_orientation"),
            photos
        );
    }

    private FirstTimePhoto mapPhoto(Map<String, Object> row) {
        Object ca = row.get("created_at");
        Object so = row.get("sort_order");
        return new FirstTimePhoto(
            ((Number) row.get("id")).longValue(),
            ((Number) row.get("first_time_id")).longValue(),
            (String) row.get("image_url"),
            (String) row.get("caption"),
            so != null ? ((Number) so).intValue() : 0,
            ca != null ? ca.toString() : null
        );
    }
}
