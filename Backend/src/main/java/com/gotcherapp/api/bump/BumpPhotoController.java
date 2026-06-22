package com.gotcherapp.api.bump;

import com.gotcherapp.api.bump.dto.CreateBumpPhotoRequest;
import com.gotcherapp.api.bump.dto.UpdateBumpPhotoRequest;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/bump-photos")
public class BumpPhotoController {

    private final BumpPhotoService bumpPhotoService;

    public BumpPhotoController(BumpPhotoService bumpPhotoService) {
        this.bumpPhotoService = bumpPhotoService;
    }

    @GetMapping
    public ResponseEntity<List<BumpPhoto>> getAll(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(bumpPhotoService.findAll(principal.userId()));
    }

    @PostMapping
    public ResponseEntity<?> create(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody CreateBumpPhotoRequest req
    ) {
        try {
            BumpPhoto created = bumpPhotoService.create(principal.userId(), req);
            return ResponseEntity.status(201).body(created);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody UpdateBumpPhotoRequest req
    ) {
        Optional<BumpPhoto> updated = bumpPhotoService.update(principal.userId(), id, req);
        if (updated.isEmpty()) return ApiError.notFound("Bump photo not found");
        return ResponseEntity.ok(updated.get());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        boolean deleted = bumpPhotoService.delete(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Bump photo not found");
        return ResponseEntity.noContent().build();
    }
}
