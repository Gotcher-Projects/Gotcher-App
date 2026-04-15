package com.gotcherapp.api.feeding;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/feeding")
public class FeedingController {

    private final FeedingService feedingService;

    public FeedingController(FeedingService feedingService) {
        this.feedingService = feedingService;
    }

    @GetMapping
    public ResponseEntity<List<FeedingLog>> getLogs(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestParam(defaultValue = "7") int days
    ) {
        return ResponseEntity.ok(feedingService.getLogs(principal.userId(), days));
    }

    @PostMapping
    public ResponseEntity<?> startFeed(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody StartFeedRequest req
    ) {
        try {
            FeedingLog log = feedingService.startFeed(principal.userId(), req);
            return ResponseEntity.status(201).body(log);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> stopFeed(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody StopFeedRequest req
    ) {
        return feedingService.stopFeed(principal.userId(), id, req)
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElseGet(() -> ApiError.notFound("Feed log not found"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFeed(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        boolean deleted = feedingService.deleteFeed(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Feed log not found");
        return ResponseEntity.noContent().build();
    }
}
