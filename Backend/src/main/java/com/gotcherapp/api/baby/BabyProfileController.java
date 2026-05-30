package com.gotcherapp.api.baby;

import com.gotcherapp.api.baby.dto.BabyProfileRequest;
import com.gotcherapp.api.baby.dto.BabyProfileResponse;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<BabyProfileResponse> upsertProfile(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody BabyProfileRequest req
    ) {
        BabyProfileResponse profile = babyProfileService.upsert(principal.userId(), req);
        return ResponseEntity.ok(profile);
    }

    @PatchMapping("/book-theme")
    public ResponseEntity<?> updateBookTheme(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody Map<String, String> body
    ) {
        String theme = body.get("theme");
        if (theme == null || theme.isBlank()) return ApiError.badRequest("theme is required");
        try {
            babyProfileService.updateBookTheme(principal.userId(), theme);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }
}
