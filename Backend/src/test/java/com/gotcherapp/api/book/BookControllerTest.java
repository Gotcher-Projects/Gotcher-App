package com.gotcherapp.api.book;

import com.gotcherapp.api.book.dto.CreateBookRequest;
import com.gotcherapp.api.book.dto.UpdateBookRequest;
import com.gotcherapp.api.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookControllerTest {

    @Mock BookService bookService;
    @InjectMocks BookController controller;

    private static final Long USER_ID = 1L;
    private static final Long BOOK_ID = 10L;
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(USER_ID, "test@example.com");

    private static Book sampleBook() {
        return new Book(BOOK_ID, 99L, "freeform", "Lily's Book", "classic", null, null, 0, "2026-06-28T00:00:00Z", null, false);
    }

    // ── GET /books ──────────────────────────────────────────────────────────────

    @Test
    void list_returns200() {
        when(bookService.list(USER_ID)).thenReturn(List.of(sampleBook()));
        var r = controller.list(PRINCIPAL);
        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertEquals(1, r.getBody().size());
    }

    // ── POST /books ───────────────────────────────────────────────────────────────

    @Test
    void create_returns201_onSuccess() {
        when(bookService.create(eq(USER_ID), any())).thenReturn(sampleBook());
        var r = controller.create(PRINCIPAL, new CreateBookRequest("freeform", null, null, null));
        assertEquals(HttpStatus.CREATED, r.getStatusCode());
    }

    @Test
    void create_returns400_onIllegalState() {
        when(bookService.create(eq(USER_ID), any())).thenThrow(new IllegalStateException("no profile"));
        var r = controller.create(PRINCIPAL, new CreateBookRequest("freeform", null, null, null));
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
    }

    // ── PATCH /books/{id} ───────────────────────────────────────────────────────────

    @Test
    void update_returns200_whenPresent() {
        when(bookService.update(eq(USER_ID), eq(BOOK_ID), any())).thenReturn(Optional.of(sampleBook()));
        var r = controller.update(PRINCIPAL, BOOK_ID, new UpdateBookRequest("New", null, null));
        assertEquals(HttpStatus.OK, r.getStatusCode());
    }

    @Test
    void update_returns404_whenEmpty() {
        when(bookService.update(eq(USER_ID), eq(BOOK_ID), any())).thenReturn(Optional.empty());
        var r = controller.update(PRINCIPAL, BOOK_ID, new UpdateBookRequest("New", null, null));
        assertEquals(HttpStatus.NOT_FOUND, r.getStatusCode());
    }

    @Test
    void update_returns400_onInvalidTheme() {
        when(bookService.update(eq(USER_ID), eq(BOOK_ID), any())).thenThrow(new IllegalArgumentException("bad theme"));
        var r = controller.update(PRINCIPAL, BOOK_ID, new UpdateBookRequest(null, "neon", null));
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
    }

    // ── POST /books/{id}/duplicate ──────────────────────────────────────────────────

    @Test
    void duplicate_returns201_whenPresent() {
        when(bookService.duplicate(USER_ID, BOOK_ID)).thenReturn(Optional.of(sampleBook()));
        var r = controller.duplicate(PRINCIPAL, BOOK_ID);
        assertEquals(HttpStatus.CREATED, r.getStatusCode());
    }

    @Test
    void duplicate_returns404_whenEmpty() {
        when(bookService.duplicate(USER_ID, BOOK_ID)).thenReturn(Optional.empty());
        var r = controller.duplicate(PRINCIPAL, BOOK_ID);
        assertEquals(HttpStatus.NOT_FOUND, r.getStatusCode());
    }

    // ── DELETE /books/{id} ──────────────────────────────────────────────────────────

    @Test
    void delete_returns204_whenDeleted() {
        when(bookService.delete(USER_ID, BOOK_ID)).thenReturn(true);
        assertEquals(HttpStatus.NO_CONTENT, controller.delete(PRINCIPAL, BOOK_ID).getStatusCode());
    }

    @Test
    void delete_returns404_whenNotFound() {
        when(bookService.delete(USER_ID, BOOK_ID)).thenReturn(false);
        assertEquals(HttpStatus.NOT_FOUND, controller.delete(PRINCIPAL, BOOK_ID).getStatusCode());
    }

    // ── PUT /books/order ────────────────────────────────────────────────────────────

    @Test
    void reorder_returns204_onSuccess() {
        var r = controller.reorder(PRINCIPAL, Map.of("orderedIds", List.of(3, 1, 2)));
        assertEquals(HttpStatus.NO_CONTENT, r.getStatusCode());
        verify(bookService).reorder(eq(USER_ID), eq(List.of(3L, 1L, 2L)));
    }

    @Test
    void reorder_returns400_whenOrderedIdsMissing() {
        var r = controller.reorder(PRINCIPAL, Map.of());
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        verify(bookService, never()).reorder(any(), any());
    }

    // ── POST /books/{id}/cover-photo ────────────────────────────────────────────────

    @Test
    void uploadCoverPhoto_returns200_onSuccess() throws IOException {
        var file = new MockMultipartFile("file", "c.jpg", "image/jpeg", new byte[]{1});
        when(bookService.uploadCoverPhoto(eq(USER_ID), eq(BOOK_ID), any())).thenReturn("https://img");
        var r = controller.uploadCoverPhoto(PRINCIPAL, BOOK_ID, file);
        assertEquals(HttpStatus.OK, r.getStatusCode());
    }

    @Test
    void uploadCoverPhoto_returns400_forNonImage() throws IOException {
        var file = new MockMultipartFile("file", "n.txt", "text/plain", new byte[]{1});
        var r = controller.uploadCoverPhoto(PRINCIPAL, BOOK_ID, file);
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        verify(bookService, never()).uploadCoverPhoto(anyLong(), anyLong(), any());
    }

    @Test
    void uploadCoverPhoto_returns404_whenBookMissing() throws IOException {
        var file = new MockMultipartFile("file", "c.jpg", "image/jpeg", new byte[]{1});
        when(bookService.uploadCoverPhoto(eq(USER_ID), eq(BOOK_ID), any()))
            .thenThrow(new NoSuchElementException("Book not found"));
        var r = controller.uploadCoverPhoto(PRINCIPAL, BOOK_ID, file);
        assertEquals(HttpStatus.NOT_FOUND, r.getStatusCode());
    }
}
