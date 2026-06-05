package com.gotcherapp.api.storybook;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import com.gotcherapp.api.storybook.dto.ChapterResponse;
import com.gotcherapp.api.storybook.dto.GenerateGroupsRequest;
import com.gotcherapp.api.storybook.dto.GeneratedPageResponse;
import com.gotcherapp.api.storybook.dto.UnlockRequest;
import com.gotcherapp.api.storybook.dto.UpdateChapterRequest;
import com.gotcherapp.api.storybook.dto.WizardRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

@RestController
public class StorybookController {

    private final StorybookService storybookService;

    public StorybookController(StorybookService storybookService) {
        this.storybookService = storybookService;
    }

    // ── Authenticated endpoints ───────────────────────────────────────────────

    @GetMapping("/storybook")
    public ResponseEntity<List<ChapterResponse>> getAll(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(storybookService.findAll(principal.userId()));
    }

    @PutMapping("/storybook/order")
    public ResponseEntity<?> reorder(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        List<Number> rawIds = (List<Number>) body.get("orderedIds");
        if (rawIds == null || rawIds.isEmpty()) return ApiError.badRequest("orderedIds is required");
        List<Long> orderedIds = rawIds.stream().map(Number::longValue).toList();
        storybookService.reorderChapters(principal.userId(), orderedIds);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/storybook/unlock")
    public ResponseEntity<?> unlock(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody UnlockRequest req
    ) {
        try {
            ChapterResponse chapter = storybookService.unlock(principal.userId(), req);
            return ResponseEntity.status(201).body(chapter);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PostMapping("/storybook/wizard")
    public ResponseEntity<?> wizard(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody WizardRequest req
    ) {
        try {
            ChapterResponse chapter = storybookService.wizard(principal.userId(), req);
            return ResponseEntity.ok(chapter);
        } catch (StorybookService.ForbiddenException e) {
            return ApiError.forbidden(e.getMessage());
        } catch (StorybookService.InsufficientCreditsException e) {
            return ResponseEntity.status(402).body(new ApiError(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    @PostMapping("/storybook/generate-pages/{id}")
    public ResponseEntity<?> generatePages(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody(required = false) GenerateGroupsRequest groupsReq
    ) {
        try {
            List<GeneratedPageResponse> pages = storybookService.generatePages(principal.userId(), id, groupsReq);
            return ResponseEntity.ok(pages);
        } catch (StorybookService.ForbiddenException e) {
            return ApiError.forbidden(e.getMessage());
        } catch (StorybookService.InsufficientCreditsException e) {
            return ResponseEntity.status(402).body(new ApiError(e.getMessage()));
        } catch (NoSuchElementException e) {
            return ApiError.notFound(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    @PatchMapping("/storybook/{id}")
    public ResponseEntity<?> update(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody UpdateChapterRequest req
    ) {
        Optional<ChapterResponse> updated = storybookService.update(principal.userId(), id, req);
        if (updated.isEmpty()) return ApiError.notFound("Chapter not found");
        return ResponseEntity.ok(updated.get());
    }

    @PostMapping("/storybook/{id}/chapter-photos")
    public ResponseEntity<?> uploadChapterPhoto(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file
    ) {
        try {
            Map<String, Object> entry = storybookService.uploadChapterPhoto(id, file, principal.userId());
            return ResponseEntity.status(201).body(entry);
        } catch (StorybookService.ForbiddenException e) {
            return ApiError.forbidden(e.getMessage());
        } catch (NoSuchElementException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    @DeleteMapping("/storybook/{id}")
    public ResponseEntity<?> delete(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        boolean deleted = storybookService.delete(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Chapter not found");
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/storybook/share")
    public ResponseEntity<?> getShareToken(@AuthenticationPrincipal AuthPrincipal principal) {
        try {
            String token = storybookService.getOrCreateShareToken(principal.userId());
            return ResponseEntity.ok(Map.of("token", token));
        } catch (StorybookService.ForbiddenException e) {
            return ApiError.forbidden(e.getMessage());
        } catch (IllegalStateException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @DeleteMapping("/storybook/share")
    public ResponseEntity<?> revokeShareToken(@AuthenticationPrincipal AuthPrincipal principal) {
        storybookService.revokeShareToken(principal.userId());
        return ResponseEntity.noContent().build();
    }

    // ── Public endpoint (no auth) ─────────────────────────────────────────────

    @GetMapping("/book/public/{token}")
    public ResponseEntity<?> getPublicBook(@PathVariable String token) {
        Optional<StorybookService.PublicBookResponse> book = storybookService.getPublicBook(token);
        if (book.isEmpty()) return ApiError.notFound("Book not found");
        return ResponseEntity.ok(book.get());
    }
}
