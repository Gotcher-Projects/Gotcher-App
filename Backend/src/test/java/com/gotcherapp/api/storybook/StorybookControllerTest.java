package com.gotcherapp.api.storybook;

import com.gotcherapp.api.security.AuthPrincipal;
import com.gotcherapp.api.storybook.dto.ChapterResponse;
import com.gotcherapp.api.storybook.dto.UpdateChapterRequest;
import com.gotcherapp.api.storybook.dto.WizardRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Maps every StorybookService outcome (success + each thrown exception type) to the HTTP status the
 * controller is responsible for returning. Pure controller logic — the service is fully mocked.
 * Removed share/unlock endpoints (s2) are intentionally absent.
 */
@ExtendWith(MockitoExtension.class)
class StorybookControllerTest {

    @Mock StorybookService storybookService;
    @InjectMocks StorybookController controller;

    private static final Long USER_ID = 1L;
    private static final Long CHAPTER_ID = 50L;
    private static final Long BOOK_ID = 7L;
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(USER_ID, "test@example.com");

    private static ChapterResponse sampleChapter() {
        return new ChapterResponse(CHAPTER_ID, "period", "8-12", "Weeks 8–12", 8, 12, 0,
            null, "unlocked", null, null, null, null, null,
            null, null, null, null, null, null, null);
    }

    private static WizardRequest wizardReq() {
        return new WizardRequest(BOOK_ID, "8-12", "Weeks 8–12", 8, 12, List.of(5L), null, null, null, null);
    }

    // ── GET /storybook ──────────────────────────────────────────────────────────

    @Test
    void getAll_returns200_withList() {
        when(storybookService.findAll(USER_ID, BOOK_ID)).thenReturn(List.of(sampleChapter()));
        var r = controller.getAll(PRINCIPAL, BOOK_ID);
        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertEquals(1, r.getBody().size());
    }

    @Test
    void getAll_returns200_emptyList_whenNoBookId() {
        var r = controller.getAll(PRINCIPAL, null);
        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertEquals(0, r.getBody().size());
        verify(storybookService, never()).findAll(anyLong(), anyLong());
    }

    // ── PUT /storybook/order ──────────────────────────────────────────────────────

    @Test
    void reorder_returns204_onSuccess() {
        var r = controller.reorder(PRINCIPAL, Map.of("orderedIds", List.of(3, 1, 2)));
        assertEquals(HttpStatus.NO_CONTENT, r.getStatusCode());
        verify(storybookService).reorderChapters(eq(USER_ID), eq(List.of(3L, 1L, 2L)));
    }

    @Test
    void reorder_returns400_whenOrderedIdsMissing() {
        var r = controller.reorder(PRINCIPAL, Map.of());
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        verify(storybookService, never()).reorderChapters(any(), any());
    }

    // ── POST /storybook/wizard ────────────────────────────────────────────────────

    @Test
    void wizard_returns200_onSuccess() {
        when(storybookService.wizard(eq(USER_ID), any())).thenReturn(sampleChapter());
        assertEquals(HttpStatus.OK, controller.wizard(PRINCIPAL, wizardReq()).getStatusCode());
    }

    @Test
    void wizard_returns403_onForbidden() {
        when(storybookService.wizard(eq(USER_ID), any()))
            .thenThrow(new StorybookService.ForbiddenException("no"));
        assertEquals(HttpStatus.FORBIDDEN, controller.wizard(PRINCIPAL, wizardReq()).getStatusCode());
    }

    @Test
    void wizard_returns400_onIllegalArgument() {
        when(storybookService.wizard(eq(USER_ID), any()))
            .thenThrow(new IllegalArgumentException("bad selection"));
        assertEquals(HttpStatus.BAD_REQUEST, controller.wizard(PRINCIPAL, wizardReq()).getStatusCode());
    }

    @Test
    void wizard_returns500_onUnexpected() {
        when(storybookService.wizard(eq(USER_ID), any()))
            .thenThrow(new RuntimeException("db down"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, controller.wizard(PRINCIPAL, wizardReq()).getStatusCode());
    }

    // ── PATCH /storybook/{id} ───────────────────────────────────────────────────────

    @Test
    void update_returns200_whenPresent() {
        when(storybookService.update(eq(USER_ID), eq(CHAPTER_ID), any())).thenReturn(Optional.of(sampleChapter()));
        var r = controller.update(PRINCIPAL, CHAPTER_ID, new UpdateChapterRequest("b", null, null, null, null));
        assertEquals(HttpStatus.OK, r.getStatusCode());
    }

    @Test
    void update_returns404_whenEmpty() {
        when(storybookService.update(eq(USER_ID), eq(CHAPTER_ID), any())).thenReturn(Optional.empty());
        var r = controller.update(PRINCIPAL, CHAPTER_ID, new UpdateChapterRequest("b", null, null, null, null));
        assertEquals(HttpStatus.NOT_FOUND, r.getStatusCode());
    }

    // ── POST /storybook/{id}/chapter-photos ───────────────────────────────────────

    @Test
    void uploadChapterPhoto_returns201_onSuccess() throws Exception {
        var file = new MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[]{1});
        when(storybookService.uploadChapterPhoto(eq(CHAPTER_ID), any(), eq(USER_ID)))
            .thenReturn(Map.of("url", "https://img"));
        var r = controller.uploadChapterPhoto(PRINCIPAL, CHAPTER_ID, file);
        assertEquals(HttpStatus.CREATED, r.getStatusCode());
    }

    @Test
    void uploadChapterPhoto_returns400_forNonImage() throws Exception {
        var file = new MockMultipartFile("file", "n.txt", "text/plain", new byte[]{1});
        var r = controller.uploadChapterPhoto(PRINCIPAL, CHAPTER_ID, file);
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        verify(storybookService, never()).uploadChapterPhoto(anyLong(), any(), anyLong());
    }

    @Test
    void uploadChapterPhoto_returns403_onForbidden() throws Exception {
        var file = new MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[]{1});
        when(storybookService.uploadChapterPhoto(eq(CHAPTER_ID), any(), eq(USER_ID)))
            .thenThrow(new StorybookService.ForbiddenException("no profile"));
        var r = controller.uploadChapterPhoto(PRINCIPAL, CHAPTER_ID, file);
        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
    }

    @Test
    void uploadChapterPhoto_returns404_whenChapterMissing() throws Exception {
        var file = new MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[]{1});
        when(storybookService.uploadChapterPhoto(eq(CHAPTER_ID), any(), eq(USER_ID)))
            .thenThrow(new NoSuchElementException("Chapter not found"));
        var r = controller.uploadChapterPhoto(PRINCIPAL, CHAPTER_ID, file);
        assertEquals(HttpStatus.NOT_FOUND, r.getStatusCode());
    }

    @Test
    void uploadChapterPhoto_returns500_onUnexpected() throws Exception {
        var file = new MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[]{1});
        when(storybookService.uploadChapterPhoto(eq(CHAPTER_ID), any(), eq(USER_ID)))
            .thenThrow(new RuntimeException("cloudinary error"));
        var r = controller.uploadChapterPhoto(PRINCIPAL, CHAPTER_ID, file);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, r.getStatusCode());
    }

    // ── DELETE /storybook/{id} ────────────────────────────────────────────────────

    @Test
    void delete_returns204_whenDeleted() {
        when(storybookService.delete(USER_ID, CHAPTER_ID)).thenReturn(true);
        assertEquals(HttpStatus.NO_CONTENT, controller.delete(PRINCIPAL, CHAPTER_ID).getStatusCode());
    }

    @Test
    void delete_returns404_whenNotFound() {
        when(storybookService.delete(USER_ID, CHAPTER_ID)).thenReturn(false);
        assertEquals(HttpStatus.NOT_FOUND, controller.delete(PRINCIPAL, CHAPTER_ID).getStatusCode());
    }
}
