package com.gotcherapp.api.journal;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.journal.dto.JournalEntryRequest;
import com.gotcherapp.api.journal.dto.JournalEntryResponse;
import com.gotcherapp.api.journal.dto.JournalEntryUpdateRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

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
            "SELECT id, week, title, story, entry_date, image_url FROM journal_entries WHERE baby_profile_id = ? ORDER BY entry_date DESC",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    public JournalEntryResponse create(Long userId, JournalEntryRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) throw new IllegalStateException("No baby profile found. Save a baby profile first.");
        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO journal_entries (baby_profile_id, week, title, story, image_url) VALUES (?, ?, ?, ?, ?) RETURNING id, week, title, story, entry_date, image_url",
            profileId.get(), req.week(), req.title(), req.story(), req.imageUrl()
        );
        return mapRow(row);
    }

    public Optional<JournalEntryResponse> update(Long userId, Long entryId, JournalEntryUpdateRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE journal_entries SET title = ?, story = ? WHERE id = ? AND baby_profile_id = ? RETURNING id, week, title, story, entry_date, image_url",
            req.title(), req.story(), entryId, profileId.get()
        );
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(mapRow(rows.get(0)));
    }

    public Optional<JournalEntryResponse> updateImage(Long userId, Long entryId, String imageUrl) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE journal_entries SET image_url = ? WHERE id = ? AND baby_profile_id = ? RETURNING id, week, title, story, entry_date, image_url",
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
            (String) row.get("image_url")
        );
    }
}
