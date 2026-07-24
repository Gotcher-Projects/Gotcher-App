package com.gotcherapp.api.book;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.book.dto.CreateBookRequest;
import com.gotcherapp.api.book.dto.GuidedChapterSeed;
import com.gotcherapp.api.book.dto.UpdateBookRequest;
import com.gotcherapp.api.upload.ImageUploadService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BabyProfileRepository babyProfileRepository;
    @Mock ImageUploadService imageUploadService;
    // Real ObjectMapper (spied so @InjectMocks wires it) — the guided seed serializes layout_data.
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks BookService bookService;

    private static final Long USER_ID    = 1L;
    private static final Long PROFILE_ID = 99L;
    private static final Long BOOK_ID    = 10L;

    private Map<String, Object> sampleRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", BOOK_ID);
        row.put("baby_profile_id", PROFILE_ID);
        row.put("type", "freeform");
        row.put("title", "Lily's First Year");
        row.put("theme", "classic");
        row.put("cover_photo_url", null);
        row.put("cover_subtitle", null);
        row.put("sort_order", 0);
        row.put("created_at", "2026-06-28T00:00:00Z");
        row.put("updated_at", null);
        return row;
    }

    // ── list ──────────────────────────────────────────────────────────────────

    @Test
    void list_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(List.of(), bookService.list(USER_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void list_returnsMappedBooks_whenProfileExists() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(anyString(), eq(PROFILE_ID))).thenReturn(List.of(sampleRow()));

        List<Book> result = bookService.list(USER_ID);

        assertEquals(1, result.size());
        assertEquals("Lily's First Year", result.get(0).title());
        assertEquals("freeform", result.get(0).type());
    }

    // ── create ────────────────────────────────────────────────────────────────

    @Test
    void create_defaultsTypeAndTheme_whenOmitted() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("freeform"), isNull(), eq("classic"), eq(PROFILE_ID)))
            .thenReturn(sampleRow());

        Book result = bookService.create(USER_ID, new CreateBookRequest(null, null, null, null));

        assertEquals("freeform", result.type());
        assertEquals(BOOK_ID, result.id());
    }

    @Test
    void create_usesGuidedType_whenRequested() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        Map<String, Object> guided = sampleRow();
        guided.put("type", "guided");
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("guided"), eq("My Book"), eq("coral"), eq(PROFILE_ID)))
            .thenReturn(guided);

        Book result = bookService.create(USER_ID, new CreateBookRequest("guided", "My Book", "coral", null));

        assertEquals("guided", result.type());
        verify(jdbc, never()).batchUpdate(anyString(), anyList());
    }

    // sv2-s8.5: a freeform book seeds exactly one flat-pages chapter (anchor_type 'freeform').
    @Test
    void create_freeform_seedsOneChapter() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForMap(anyString(), eq(PROFILE_ID), eq("freeform"), isNull(), eq("classic"), eq(PROFILE_ID)))
            .thenReturn(sampleRow());

        bookService.create(USER_ID, new CreateBookRequest("freeform", null, null, null));

        // one storybook_chapters row (profileId, bookId, layout_data json); no guided batch insert.
        verify(jdbc).update(contains("INSERT INTO storybook_chapters"), eq(PROFILE_ID), eq(BOOK_ID), anyString());
        verify(jdbc, never()).batchUpdate(anyString(), anyList());
    }

    // ── create: guided arc instantiation (sv2-s7b) ──────────────────────────────

    private void stubGuidedBookInsert() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        Map<String, Object> guided = sampleRow();
        guided.put("type", "guided");
        when(jdbc.queryForMap(contains("INSERT INTO books"), any(Object[].class))).thenReturn(guided);
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> captureChapterBatch() {
        ArgumentCaptor<List<Object[]>> captor = ArgumentCaptor.forClass(List.class);
        verify(jdbc).batchUpdate(contains("INSERT INTO storybook_chapters"), captor.capture());
        return captor.getValue();
    }

    @Test
    void create_guided_seedsChaptersInOrder() {
        stubGuidedBookInsert();
        Map<String, Object> layout = Map.of("templateId", "letter");
        List<GuidedChapterSeed> chapters = List.of(
            new GuidedChapterSeed("div-beginning", "The Beginning", 0, null),
            new GuidedChapterSeed("letter-to-you", "A Letter to You", 1, layout)
        );

        bookService.create(USER_ID, new CreateBookRequest("guided", null, null, chapters));

        List<Object[]> batch = captureChapterBatch();
        assertEquals(2, batch.size());
        // row 0 — divider, null layout
        assertArrayEquals(new Object[]{ PROFILE_ID, BOOK_ID, "div-beginning", "The Beginning", 0, null }, batch.get(0));
        // row 1 — layout serialized to a JSON string
        Object[] r1 = batch.get(1);
        assertEquals("letter-to-you", r1[2]);
        assertEquals("A Letter to You", r1[3]);
        assertEquals(1, r1[4]);
        assertEquals("{\"templateId\":\"letter\"}", r1[5]);
    }

    @Test
    void create_guided_defaultsLabelAndOrderWhenOmitted() {
        stubGuidedBookInsert();
        List<GuidedChapterSeed> chapters = List.of(
            new GuidedChapterSeed("first-page", null, null, null),
            new GuidedChapterSeed("second-page", "  ", null, null)
        );

        bookService.create(USER_ID, new CreateBookRequest("guided", null, null, chapters));

        List<Object[]> batch = captureChapterBatch();
        // label falls back to anchorKey; sort_order falls back to the list index
        assertArrayEquals(new Object[]{ PROFILE_ID, BOOK_ID, "first-page", "first-page", 0, null }, batch.get(0));
        assertArrayEquals(new Object[]{ PROFILE_ID, BOOK_ID, "second-page", "second-page", 1, null }, batch.get(1));
    }

    @Test
    void create_guided_nullChapters_noSeed() {
        stubGuidedBookInsert();
        bookService.create(USER_ID, new CreateBookRequest("guided", null, null, null));
        verify(jdbc, never()).batchUpdate(anyString(), anyList());
    }

    @Test
    void create_guided_emptyChapters_noSeed() {
        stubGuidedBookInsert();
        bookService.create(USER_ID, new CreateBookRequest("guided", null, null, List.of()));
        verify(jdbc, never()).batchUpdate(anyString(), anyList());
    }

    @Test
    void create_guided_missingAnchorKey_throws() {
        stubGuidedBookInsert();
        List<GuidedChapterSeed> chapters = List.of(new GuidedChapterSeed("  ", "No key", 0, null));

        assertThrows(IllegalArgumentException.class,
            () -> bookService.create(USER_ID, new CreateBookRequest("guided", null, null, chapters)));
        verify(jdbc, never()).batchUpdate(anyString(), anyList());
    }

    @Test
    void create_guided_overCap_throws() {
        stubGuidedBookInsert();
        List<GuidedChapterSeed> chapters = IntStream.range(0, 61)
            .mapToObj(i -> new GuidedChapterSeed("p" + i, "P" + i, i, null))
            .collect(Collectors.toList());

        assertThrows(IllegalArgumentException.class,
            () -> bookService.create(USER_ID, new CreateBookRequest("guided", null, null, chapters)));
        verify(jdbc, never()).batchUpdate(anyString(), anyList());
    }

    // ── update ────────────────────────────────────────────────────────────────

    @Test
    void update_returnsEmpty_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertEquals(Optional.empty(), bookService.update(USER_ID, BOOK_ID, new UpdateBookRequest("X", null, null, null)));
    }

    @Test
    void update_selectsOnly_whenPatchEmpty() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.queryForList(contains("SELECT"), eq(BOOK_ID), eq(PROFILE_ID))).thenReturn(List.of(sampleRow()));

        Optional<Book> result = bookService.update(USER_ID, BOOK_ID, new UpdateBookRequest(null, null, null, null));

        assertTrue(result.isPresent());
        assertEquals("Lily's First Year", result.get().title());
    }

    @Test
    void update_updatesTitle_forPartialPatch() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        Map<String, Object> updated = sampleRow();
        updated.put("title", "Renamed");
        when(jdbc.queryForList(contains("UPDATE books SET title"), eq("Renamed"), eq(BOOK_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(updated));

        Optional<Book> result = bookService.update(USER_ID, BOOK_ID, new UpdateBookRequest("Renamed", null, null, null));

        assertTrue(result.isPresent());
        assertEquals("Renamed", result.get().title());
    }

    @Test
    void update_throwsIllegalArgument_forInvalidTheme() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        assertThrows(IllegalArgumentException.class,
            () -> bookService.update(USER_ID, BOOK_ID, new UpdateBookRequest(null, "neon", null, null)));
    }

    // ── duplicate ───────────────────────────────────────────────────────────────

    @Test
    void duplicate_returnsEmpty_whenSourceNotOwned() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForList(contains("FROM books WHERE id = ?"), eq(BOOK_ID), eq(PROFILE_ID)))
            .thenReturn(List.of());

        assertEquals(Optional.empty(), bookService.duplicate(USER_ID, BOOK_ID));
        verify(jdbc, never()).update(contains("INSERT INTO storybook_chapters"), any(), any());
    }

    @Test
    void duplicate_copiesBookAndChapters() {
        Long newBookId = 11L;
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        when(jdbc.queryForList(contains("FROM books WHERE id = ?"), eq(BOOK_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(sampleRow()));
        Map<String, Object> copyRow = sampleRow();
        copyRow.put("id", newBookId);
        copyRow.put("title", "Lily's First Year (Copy)");
        when(jdbc.queryForMap(contains("INSERT INTO books"), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(copyRow);

        Optional<Book> result = bookService.duplicate(USER_ID, BOOK_ID);

        assertTrue(result.isPresent());
        assertEquals(newBookId, result.get().id());
        verify(jdbc).update(contains("INSERT INTO storybook_chapters"), eq(newBookId), eq(BOOK_ID));
    }

    // ── delete ────────────────────────────────────────────────────────────────

    @Test
    void delete_returnsFalse_whenNoProfile() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.empty());
        assertFalse(bookService.delete(USER_ID, BOOK_ID));
        verifyNoInteractions(jdbc);
    }

    @Test
    void delete_returnsFalse_whenNotFound() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(BOOK_ID), eq(PROFILE_ID))).thenReturn(0);
        assertFalse(bookService.delete(USER_ID, BOOK_ID));
    }

    @Test
    void delete_returnsTrue_whenDeleted() {
        when(babyProfileRepository.findProfileIdByUserId(USER_ID)).thenReturn(Optional.of(PROFILE_ID));
        when(jdbc.update(anyString(), eq(BOOK_ID), eq(PROFILE_ID))).thenReturn(1);
        assertTrue(bookService.delete(USER_ID, BOOK_ID));
    }

    // ── reorder ───────────────────────────────────────────────────────────────

    @Test
    void reorder_writesSortOrderPerId() {
        when(babyProfileRepository.requireProfileId(USER_ID)).thenReturn(PROFILE_ID);
        bookService.reorder(USER_ID, List.of(3L, 1L, 2L));
        verify(jdbc).update(anyString(), eq(0), eq(3L), eq(PROFILE_ID));
        verify(jdbc).update(anyString(), eq(1), eq(1L), eq(PROFILE_ID));
        verify(jdbc).update(anyString(), eq(2), eq(2L), eq(PROFILE_ID));
    }
}
