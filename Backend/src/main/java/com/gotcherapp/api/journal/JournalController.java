package com.gotcherapp.api.journal;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.journal.dto.JournalEntryRequest;
import com.gotcherapp.api.journal.dto.JournalEntryResponse;
import com.gotcherapp.api.journal.dto.JournalEntryUpdateRequest;
import com.gotcherapp.api.security.AuthPrincipal;
import com.gotcherapp.api.upload.ImageUploadService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/journal")
public class JournalController {

    private final JournalService journalService;
    private final ImageUploadService imageUploadService;

    public JournalController(JournalService journalService, ImageUploadService imageUploadService) {
        this.journalService = journalService;
        this.imageUploadService = imageUploadService;
    }

    @GetMapping
    public ResponseEntity<List<JournalEntryResponse>> getAll(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(journalService.getAll(principal.userId()));
    }

    @PostMapping
    public ResponseEntity<?> create(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody JournalEntryRequest req) {
        try {
            JournalEntryResponse entry = journalService.create(principal.userId(), req);
            return ResponseEntity.status(HttpStatus.CREATED).body(entry);
        } catch (IllegalStateException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id,
            @RequestBody JournalEntryUpdateRequest req) {
        return journalService.update(principal.userId(), id, req)
                .map(entry -> ResponseEntity.ok((Object) entry))
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/image")
    public ResponseEntity<?> updateImage(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ApiError.badRequest("No file provided");
        }
        try {
            String url = imageUploadService.upload(file, "journal", principal.userId());
            return journalService.updateImage(principal.userId(), id, url)
                    .map(entry -> ResponseEntity.ok((Object) entry))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ApiError.serverError("Upload failed: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id) {
        boolean deleted = journalService.delete(principal.userId(), id);
        return deleted ? ResponseEntity.noContent().build()
                       : ResponseEntity.notFound().build();
    }
}
