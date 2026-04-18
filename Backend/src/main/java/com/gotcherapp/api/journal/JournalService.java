package com.gotcherapp.api.journal;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.journal.dto.JournalEntryRequest;
import com.gotcherapp.api.journal.dto.JournalEntryResponse;
import com.gotcherapp.api.journal.dto.JournalEntryUpdateRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class JournalService {

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public JournalService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<JournalEntryResponse> getAll(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT id, week, title, story, entry_date, image_url, image_orientation FROM journal_entries WHERE baby_profile_id = ? ORDER BY entry_date DESC",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    public JournalEntryResponse create(Long userId, JournalEntryRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO journal_entries (baby_profile_id, week, title, story, image_url, image_orientation) " +
            "VALUES (?, ?, ?, ?, ?, COALESCE(?, 'landscape')) " +
            "RETURNING id, week, title, story, entry_date, image_url, image_orientation",
            profileId, req.week(), req.title(), req.story(), req.imageUrl(), req.imageOrientation()
        );
        return mapRow(row);
    }

    public Optional<JournalEntryResponse> update(Long userId, Long entryId, JournalEntryUpdateRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (req.title() != null)            { setClauses.add("title = ?");             params.add(req.title()); }
        if (req.story() != null)            { setClauses.add("story = ?");             params.add(req.story()); }
        if (req.imageOrientation() != null) { setClauses.add("image_orientation = ?"); params.add(req.imageOrientation()); }

        if (setClauses.isEmpty()) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, week, title, story, entry_date, image_url, image_orientation FROM journal_entries WHERE id = ? AND baby_profile_id = ?",
                entryId, profileId.get()
            );
            return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
        }

        params.add(entryId);
        params.add(profileId.get());

        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE journal_entries SET " + String.join(", ", setClauses) +
            " WHERE id = ? AND baby_profile_id = ?" +
            " RETURNING id, week, title, story, entry_date, image_url, image_orientation",
            params.toArray()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public Optional<JournalEntryResponse> updateImage(Long userId, Long entryId, String imageUrl) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE journal_entries SET image_url = ? WHERE id = ? AND baby_profile_id = ? RETURNING id, week, title, story, entry_date, image_url, image_orientation",
            imageUrl, entryId, profileId.get()
        );
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(mapRow(rows.get(0)));
    }

    public boolean delete(Long userId, Long entryId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM journal_entries WHERE id = ? AND baby_profile_id = ?",
            entryId, profileId.get()
        );
        return rows > 0;
    }

    private JournalEntryResponse mapRow(Map<String, Object> row) {
        Object ed = row.get("entry_date");
        String entryDate = ed != null ? ed.toString() : null;
        return new JournalEntryResponse(
            ((Number) row.get("id")).longValue(),
            ((Number) row.get("week")).intValue(),
            (String) row.get("title"),
            (String) row.get("story"),
            entryDate,
            (String) row.get("image_url"),
            (String) row.get("image_orientation")
        );
    }
}
