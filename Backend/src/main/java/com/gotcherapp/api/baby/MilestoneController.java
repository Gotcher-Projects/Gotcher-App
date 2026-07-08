package com.gotcherapp.api.baby;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/milestones")
public class MilestoneController {

    private final MilestoneService milestoneService;

    public MilestoneController(MilestoneService milestoneService) {
        this.milestoneService = milestoneService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll(@AuthenticationPrincipal AuthPrincipal principal) {
        List<String> keys = milestoneService.getKeys(principal.userId());
        // `achieved` adds the date each milestone was marked (for the Storybook "How You Grew" page);
        // `keys` is kept for the existing milestone checklist consumer.
        return ResponseEntity.ok(Map.of(
            "keys", keys,
            "achieved", milestoneService.getAchieved(principal.userId())
        ));
    }

    @PostMapping("/{key}")
    public ResponseEntity<?> achieve(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable String key
    ) {
        try {
            milestoneService.achieve(principal.userId(), key);
            return ResponseEntity.ok(Map.of("key", key));
        } catch (IllegalStateException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @DeleteMapping("/{key}")
    public ResponseEntity<?> unachieve(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable String key
    ) {
        milestoneService.unachieve(principal.userId(), key);
        return ResponseEntity.noContent().build();
    }
}
