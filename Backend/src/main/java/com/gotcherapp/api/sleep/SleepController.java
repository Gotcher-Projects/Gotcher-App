package com.gotcherapp.api.sleep;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/sleep")
public class SleepController {

    private final SleepService sleepService;

    public SleepController(SleepService sleepService) {
        this.sleepService = sleepService;
    }

    @GetMapping
    public ResponseEntity<List<SleepLog>> getLogs(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestParam(defaultValue = "30") int days
    ) {
        return ResponseEntity.ok(sleepService.getLogs(principal.userId(), days));
    }

    @PostMapping
    public ResponseEntity<?> addLog(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody SleepRequest req
    ) {
        try {
            SleepLog log = sleepService.addLog(principal.userId(), req);
            return ResponseEntity.status(201).body(log);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLog(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        boolean deleted = sleepService.deleteLog(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Sleep log not found");
        return ResponseEntity.noContent().build();
    }
}
