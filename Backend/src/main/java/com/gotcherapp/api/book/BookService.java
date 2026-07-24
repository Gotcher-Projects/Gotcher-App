package com.gotcherapp.api.book;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.book.dto.CreateBookRequest;
import com.gotcherapp.api.book.dto.GuidedChapterSeed;
import com.gotcherapp.api.book.dto.UpdateBookRequest;
import com.gotcherapp.api.upload.ImageUploadService;
import com.gotcherapp.api.upload.UploadFolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class BookService {

    // Every SELECT / RETURNING uses this list so mapRow() stays in sync. Concatenated (not a text
    // block) to avoid the trailing-whitespace RETURNING gotcha (reference_java_textblock_returning_gotcha).
    private static final String COLS =
        "id, baby_profile_id, type, title, theme, cover_photo_url, cover_subtitle, sort_order, created_at, updated_at, share_unlocked_at, finished_at";

    private static final Set<String> VALID_TYPES  = Set.of("guided", "freeform");
    private static final Set<String> VALID_THEMES = Set.of("classic", "coral", "midnight", "meadow");

    // Both locked arcs are <= 35 pages (sv2-s7b); this is a generous guard against a pathological
    // guided-create payload, not a real product limit.
    private static final int MAX_GUIDED_CHAPTERS = 60;

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;
    private final ImageUploadService imageUploadService;
    private final ObjectMapper objectMapper;

    public BookService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository,
                       ImageUploadService imageUploadService, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
        this.imageUploadService = imageUploadService;
        this.objectMapper = objectMapper;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public List<Book> list(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT " + COLS + " FROM books WHERE baby_profile_id = ? ORDER BY sort_order, id",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    // ── Create ────────────────────────────────────────────────────────────────

    // @Transactional so a guided book and its materialised arc pages either all land or none do —
    // a half-instantiated guided book (rows missing) would be unrecoverable from the UI.
    @Transactional
    public Book create(Long userId, CreateBookRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        String type = (req.type() != null && VALID_TYPES.contains(req.type())) ? req.type() : "freeform";
        String theme = (req.theme() != null && VALID_THEMES.contains(req.theme())) ? req.theme() : "classic";
        String title = (req.title() != null && !req.title().isBlank()) ? req.title().trim() : null;

        Map<String, Object> row = jdbc.queryForMap(
            "INSERT INTO books (baby_profile_id, type, title, theme, sort_order) " +
            "VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM books WHERE baby_profile_id = ?)) " +
            "RETURNING " + COLS,
            profileId, type, title, theme, profileId
        );
        Book book = mapRow(row);

        // Guided books materialise their locked arc now (Model A, sv2-s7b). Freeform books (sv2-s8.5)
        // are a single flat page sequence — one chapter per book — so we seed one empty chapter here
        // and the builder opens straight onto it (no period wizard).
        if ("guided".equals(type) && req.chapters() != null && !req.chapters().isEmpty()) {
            seedGuidedChapters(profileId, book.id(), req.chapters());
        } else if ("freeform".equals(type)) {
            seedFreeformChapter(profileId, book.id());
        }
        return book;
    }

    // sv2-s8.5: one storybook_chapters row per freeform book, holding all pages in layout_data.pages.
    // anchor_key is fixed ('main'); the (book_id, anchor_type, anchor_key) constraint keeps it unique
    // per book. Seeds a single empty page so the builder + renderer read a real v2 layout from the start.
    private void seedFreeformChapter(Long profileId, Long bookId) {
        jdbc.update(
            "INSERT INTO storybook_chapters " +
            "(baby_profile_id, book_id, anchor_type, anchor_key, anchor_label, sort_order, status, layout_data) " +
            "VALUES (?, ?, 'freeform', 'main', 'Pages', 0, 'unlocked', ?)",
            profileId, bookId, emptyFreeformLayout()
        );
    }

    private String emptyFreeformLayout() {
        Map<String, Object> page = new HashMap<>();
        page.put("id", "p-" + UUID.randomUUID().toString().substring(0, 8));
        page.put("sourceKeys", List.of());
        page.put("templateId", null);
        page.put("backgroundColor", null);
        page.put("blocks", List.of());
        Map<String, Object> layout = new HashMap<>();
        layout.put("version", 2);
        layout.put("pages", List.of(page));
        return serializeLayoutData(layout);
    }

    // Bulk-inserts one storybook_chapters row per arc entry, in order, inside create()'s transaction.
    // anchor_type is fixed to 'guided'; anchor_key is the arc entry id (unique within the book, so the
    // (book_id, anchor_type, anchor_key) constraint holds). All guided metadata rides inside layout_data.
    private void seedGuidedChapters(Long profileId, Long bookId, List<GuidedChapterSeed> seeds) {
        if (seeds.size() > MAX_GUIDED_CHAPTERS) {
            throw new IllegalArgumentException("Too many chapters for a guided book");
        }
        List<Object[]> batch = new ArrayList<>(seeds.size());
        for (int i = 0; i < seeds.size(); i++) {
            GuidedChapterSeed s = seeds.get(i);
            if (s.anchorKey() == null || s.anchorKey().isBlank()) {
                throw new IllegalArgumentException("Each guided chapter needs an anchorKey");
            }
            String anchorKey = s.anchorKey().trim();
            String label = (s.anchorLabel() != null && !s.anchorLabel().isBlank())
                ? s.anchorLabel().trim() : anchorKey;
            int order = s.sortOrder() != null ? s.sortOrder() : i;
            batch.add(new Object[]{ profileId, bookId, anchorKey, label, order, serializeLayoutData(s.layoutData()) });
        }
        jdbc.batchUpdate(
            "INSERT INTO storybook_chapters " +
            "(baby_profile_id, book_id, anchor_type, anchor_key, anchor_label, sort_order, status, layout_data) " +
            "VALUES (?, ?, 'guided', ?, ?, ?, 'unlocked', ?)",
            batch
        );
    }

    // layout_data is a TEXT column holding JSON (see V30) — store the serialized string, no jsonb cast.
    private String serializeLayoutData(Object layoutData) {
        if (layoutData == null) return null;
        try {
            return objectMapper.writeValueAsString(layoutData);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid chapter layout data");
        }
    }

    // ── Update (partial: title / theme / coverSubtitle) ─────────────────────────

    public Optional<Book> update(Long userId, Long bookId, UpdateBookRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (req.title() != null) {
            String t = req.title().isBlank() ? null : req.title().trim();
            setClauses.add("title = ?");
            params.add(t);
        }
        if (req.theme() != null) {
            if (!VALID_THEMES.contains(req.theme())) throw new IllegalArgumentException("Invalid theme: " + req.theme());
            setClauses.add("theme = ?");
            params.add(req.theme());
        }
        if (req.coverSubtitle() != null) {
            String s = req.coverSubtitle().isBlank() ? null : req.coverSubtitle().trim();
            setClauses.add("cover_subtitle = ?");
            params.add(s);
        }
        if (req.finished() != null) {
            // Owner "Mark as finished" (s13e-2): set/clear the timestamp; no param (NOW()/NULL are literals).
            setClauses.add(req.finished() ? "finished_at = NOW()" : "finished_at = NULL");
        }

        if (setClauses.isEmpty()) {
            return getOwned(bookId, profileId.get());
        }

        setClauses.add("updated_at = NOW()");
        params.add(bookId);
        params.add(profileId.get());

        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE books SET " + String.join(", ", setClauses) +
            " WHERE id = ? AND baby_profile_id = ? RETURNING " + COLS,
            params.toArray()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    // ── Cover photo ─────────────────────────────────────────────────────────────

    public String uploadCoverPhoto(Long userId, Long bookId, MultipartFile file) throws IOException {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        if (getOwned(bookId, profileId).isEmpty()) {
            throw new NoSuchElementException("Book not found");
        }
        String url = imageUploadService.upload(file, UploadFolder.STORYBOOK.folderName(), userId);
        jdbc.update(
            "UPDATE books SET cover_photo_url = ?, updated_at = NOW() WHERE id = ? AND baby_profile_id = ?",
            url, bookId, profileId
        );
        return url;
    }

    // ── Duplicate (book row + all its chapters) ─────────────────────────────────

    public Optional<Book> duplicate(Long userId, Long bookId) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        Optional<Book> source = getOwned(bookId, profileId);
        if (source.isEmpty()) return Optional.empty();
        Book src = source.get();

        String newTitle = (src.title() != null ? src.title() : "Untitled book") + " (Copy)";
        Map<String, Object> newRow = jdbc.queryForMap(
            "INSERT INTO books (baby_profile_id, type, title, theme, cover_photo_url, cover_subtitle, sort_order) " +
            "VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM books WHERE baby_profile_id = ?)) " +
            "RETURNING " + COLS,
            profileId, src.type(), newTitle, src.theme(), src.coverPhotoUrl(), src.coverSubtitle(), profileId
        );
        Book copy = mapRow(newRow);

        // Copy every chapter into the new book. id/created_at/updated_at default; book_id is the new id.
        jdbc.update(
            "INSERT INTO storybook_chapters " +
            "(baby_profile_id, book_id, anchor_type, anchor_key, anchor_label, period_start_weeks, " +
            " period_end_weeks, sort_order, body, status, image_url, wizard_journal_ids, " +
            " wizard_first_time_ids, supplementary_notes, photo_overrides, wizard_entry_notes, " +
            " layout_data, chapter_photos, generated_content, generated_at, published_at) " +
            "SELECT baby_profile_id, ?, anchor_type, anchor_key, anchor_label, period_start_weeks, " +
            " period_end_weeks, sort_order, body, status, image_url, wizard_journal_ids, " +
            " wizard_first_time_ids, supplementary_notes, photo_overrides, wizard_entry_notes, " +
            " layout_data, chapter_photos, generated_content, generated_at, published_at " +
            "FROM storybook_chapters WHERE book_id = ?",
            copy.id(), bookId
        );
        return Optional.of(copy);
    }

    // ── Delete (cascade removes its chapters) ───────────────────────────────────

    public boolean delete(Long userId, Long bookId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        int rows = jdbc.update(
            "DELETE FROM books WHERE id = ? AND baby_profile_id = ?",
            bookId, profileId.get()
        );
        return rows > 0;
    }

    // ── Reorder ─────────────────────────────────────────────────────────────────

    public void reorder(Long userId, List<Long> orderedIds) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        for (int i = 0; i < orderedIds.size(); i++) {
            jdbc.update(
                "UPDATE books SET sort_order = ?, updated_at = NOW() WHERE id = ? AND baby_profile_id = ?",
                i, orderedIds.get(i), profileId
            );
        }
    }

    // ── Ownership helper ────────────────────────────────────────────────────────

    /** Returns the book only if it belongs to the given profile (IDOR boundary). */
    private Optional<Book> getOwned(Long bookId, Long profileId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " + COLS + " FROM books WHERE id = ? AND baby_profile_id = ?",
            bookId, profileId
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    // ── Row mapping ─────────────────────────────────────────────────────────────

    private Book mapRow(Map<String, Object> row) {
        return new Book(
            ((Number) row.get("id")).longValue(),
            ((Number) row.get("baby_profile_id")).longValue(),
            (String) row.get("type"),
            (String) row.get("title"),
            (String) row.get("theme"),
            (String) row.get("cover_photo_url"),
            (String) row.get("cover_subtitle"),
            row.get("sort_order") != null ? ((Number) row.get("sort_order")).intValue() : null,
            row.get("created_at") != null ? row.get("created_at").toString() : null,
            row.get("updated_at") != null ? row.get("updated_at").toString() : null,
            // Derived boolean, not the timestamp. A duplicated book returns null here (its INSERT omits
            // the column) → not unlocked, which is correct: the entitlement is per-book and paid-for.
            row.get("share_unlocked_at") != null,
            // Same: a duplicated book is not "finished" (its INSERT omits the column).
            row.get("finished_at") != null
        );
    }
}
