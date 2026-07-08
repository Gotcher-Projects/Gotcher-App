package com.gotcherapp.api.baby;

import com.gotcherapp.api.baby.dto.BabyProfileRequest;
import com.gotcherapp.api.baby.dto.BabyProfileResponse;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/baby-profile")
public class BabyProfileController {

    private final BabyProfileService babyProfileService;

    public BabyProfileController(BabyProfileService babyProfileService) {
        this.babyProfileService = babyProfileService;
    }

    @GetMapping
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal AuthPrincipal principal) {
        Optional<BabyProfileResponse> profile = babyProfileService.getProfile(principal.userId());
        return profile.<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping
    public ResponseEntity<?> upsertProfile(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody BabyProfileRequest req
    ) {
        try {
            BabyProfileResponse profile = babyProfileService.upsert(principal.userId(), req);
            return ResponseEntity.ok(profile);
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PostMapping("/mark-born")
    public ResponseEntity<?> markBorn(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody Map<String, String> body
    ) {
        String birthdate = body.get("birthdate");
        if (birthdate == null || birthdate.isBlank()) return ApiError.badRequest("birthdate is required");
        // sex is optional: absent key → null → leave sex untouched (key present, even "", updates it).
        String sex = body.containsKey("sex") ? body.getOrDefault("sex", "") : null;
        try {
            babyProfileService.markAsBorn(principal.userId(), birthdate, sex);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PostMapping("/phase")
    public ResponseEntity<?> updatePhase(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody Map<String, String> body
    ) {
        String phase = body.get("phase");
        if (phase == null || phase.isBlank()) return ApiError.badRequest("phase is required");
        try {
            babyProfileService.updatePhase(principal.userId(), phase);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PostMapping("/photo")
    public ResponseEntity<?> uploadPhoto(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestParam("file") MultipartFile file
    ) {
        try {
            String url = babyProfileService.uploadPhoto(principal.userId(), file);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

}
