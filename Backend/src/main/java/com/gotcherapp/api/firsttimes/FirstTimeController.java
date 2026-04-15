package com.gotcherapp.api.firsttimes;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.firsttimes.dto.CreateFirstTimeRequest;
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
}
