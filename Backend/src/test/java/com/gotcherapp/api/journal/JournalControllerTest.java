package com.gotcherapp.api.journal;

import com.gotcherapp.api.journal.dto.JournalEntryRequest;
import com.gotcherapp.api.journal.dto.JournalEntryResponse;
import com.gotcherapp.api.security.AuthPrincipal;
import com.gotcherapp.api.upload.ImageUploadService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JournalControllerTest {

    @Mock JournalService journalService;
    @Mock ImageUploadService imageUploadService;
    @InjectMocks JournalController journalController;

    private final AuthPrincipal principal = new AuthPrincipal(1L, "test@example.com");

    // ── GET /journal ──────────────────────────────────────────────────────────

    @Test
    void getAll_returns200_withEntries() {
        when(journalService.getAll(1L)).thenReturn(List.of());
        var response = journalController.getAll(principal);
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    // ── POST /journal ─────────────────────────────────────────────────────────

    @Test
    void create_returns201_onSuccess() {
        var req = new JournalEntryRequest(4, "First smile", "So cute", null, null);
        var entry = new JournalEntryResponse(1L, 4, "First smile", "So cute", "2026-01-01", null, null);
        when(journalService.create(1L, req)).thenReturn(entry);

        var response = journalController.create(principal, req);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(entry, response.getBody());
    }

    @Test
    void create_returns400_whenNoProfile() {
        var req = new JournalEntryRequest(4, "Title", "Story", null, null);
        when(journalService.create(1L, req)).thenThrow(new IllegalStateException("No baby profile found"));

        var response = journalController.create(principal, req);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    // ── PATCH /journal/{id}/image ─────────────────────────────────────────────

    @Test
    void updateImage_returns400_whenFileIsEmpty() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", new byte[]{});
        var response = journalController.updateImage(principal, 1L, emptyFile);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verifyNoInteractions(imageUploadService, journalService);
    }

    @Test
    void updateImage_returns404_whenEntryNotFound() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "img.jpg", "image/jpeg", new byte[]{1});
        when(imageUploadService.upload(file, "journal", 1L)).thenReturn("https://url");
        when(journalService.updateImage(1L, 5L, "https://url")).thenReturn(Optional.empty());

        var response = journalController.updateImage(principal, 5L, file);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void updateImage_returns200_withUpdatedEntry() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "img.jpg", "image/jpeg", new byte[]{1});
        var updatedEntry = new JournalEntryResponse(5L, 4, "Title", "Story", "2026-01-01", "https://url", null);
        when(imageUploadService.upload(file, "journal", 1L)).thenReturn("https://url");
        when(journalService.updateImage(1L, 5L, "https://url")).thenReturn(Optional.of(updatedEntry));

        var response = journalController.updateImage(principal, 5L, file);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(updatedEntry, response.getBody());
    }

    @Test
    void updateImage_returns500_whenUploadFails() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "img.jpg", "image/jpeg", new byte[]{1});
        when(imageUploadService.upload(file, "journal", 1L)).thenThrow(new java.io.IOException("Network error"));

        var response = journalController.updateImage(principal, 5L, file);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    // ── DELETE /journal/{id} ──────────────────────────────────────────────────

    @Test
    void delete_returns204_onSuccess() {
        when(journalService.delete(1L, 5L)).thenReturn(true);
        var response = journalController.delete(principal, 5L);
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
    }

    @Test
    void delete_returns404_whenEntryNotFound() {
        when(journalService.delete(1L, 5L)).thenReturn(false);
        var response = journalController.delete(principal, 5L);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }
}
