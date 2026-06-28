package com.gotcherapp.api.firsttimes;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.firsttimes.dto.AddFirstTimePhotoRequest;
import com.gotcherapp.api.firsttimes.dto.CreateFirstTimeRequest;
import com.gotcherapp.api.firsttimes.dto.ReorderPhotosRequest;
import com.gotcherapp.api.firsttimes.dto.UpdateFirstTimePhotoRequest;
import com.gotcherapp.api.firsttimes.dto.UpdateFirstTimeRequest;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/first-times")
public class FirstTimeController {

    private final FirstTimeService firstTimeService;

    public FirstTimeController(FirstTimeService firstTimeService) {
        this.firstTimeService = firstTimeService;
    }

    @GetMapping
    public ResponseEntity<List<FirstTime>> getAll(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(firstTimeService.findAll(principal.userId()));
    }

    @PostMapping
    public ResponseEntity<?> create(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody CreateFirstTimeRequest req
    ) {
        try {
            FirstTime created = firstTimeService.create(principal.userId(), req);
            return ResponseEntity.status(201).body(created);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody UpdateFirstTimeRequest req
    ) {
        Optional<FirstTime> updated = firstTimeService.update(principal.userId(), id, req);
        if (updated.isEmpty()) return ApiError.notFound("First time entry not found");
        return ResponseEntity.ok(updated.get());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        boolean deleted = firstTimeService.delete(principal.userId(), id);
        if (!deleted) return ApiError.notFound("First time entry not found");
        return ResponseEntity.noContent().build();
    }

    // ── Additional photos (sv2-s4) ───────────────────────────────────────────────
    // The image is uploaded first via POST /upload?context=first_times (returns a URL); the
    // client then records that URL here. No multipart on these endpoints.

    @PostMapping("/{id}/photos")
    public ResponseEntity<?> addPhoto(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody AddFirstTimePhotoRequest req
    ) {
        try {
            Optional<FirstTimePhoto> created = firstTimeService.addPhoto(principal.userId(), id, req);
            if (created.isEmpty()) return ApiError.notFound("First time entry not found");
            return ResponseEntity.status(201).body(created.get());
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PatchMapping("/{id}/photos/{photoId}")
    public ResponseEntity<?> updatePhoto(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @PathVariable Long photoId,
        @RequestBody UpdateFirstTimePhotoRequest req
    ) {
        Optional<FirstTimePhoto> updated =
            firstTimeService.updatePhotoCaption(principal.userId(), id, photoId, req.caption());
        if (updated.isEmpty()) return ApiError.notFound("Photo not found");
        return ResponseEntity.ok(updated.get());
    }

    @DeleteMapping("/{id}/photos/{photoId}")
    public ResponseEntity<?> deletePhoto(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @PathVariable Long photoId
    ) {
        boolean removed = firstTimeService.removePhoto(principal.userId(), id, photoId);
        if (!removed) return ApiError.notFound("Photo not found");
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/photos/order")
    public ResponseEntity<?> reorderPhotos(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody ReorderPhotosRequest req
    ) {
        Optional<List<FirstTimePhoto>> reordered =
            firstTimeService.reorderPhotos(principal.userId(), id, req.orderedIds());
        if (reordered.isEmpty()) return ApiError.notFound("First time entry not found");
        return ResponseEntity.ok(reordered.get());
    }
}
