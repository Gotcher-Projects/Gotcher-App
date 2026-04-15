package com.gotcherapp.api.growth;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/growth")
public class GrowthController {

    private final GrowthService growthService;

    public GrowthController(GrowthService growthService) {
        this.growthService = growthService;
    }

    @GetMapping
    public ResponseEntity<List<GrowthRecord>> getRecords(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(growthService.getRecords(principal.userId()));
    }

    @PostMapping
    public ResponseEntity<?> addRecord(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody GrowthRequest req
    ) {
        try {
            GrowthRecord record = growthService.addRecord(principal.userId(), req);
            return ResponseEntity.status(201).body(record);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRecord(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        boolean deleted = growthService.deleteRecord(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Record not found");
        return ResponseEntity.noContent().build();
    }
}
