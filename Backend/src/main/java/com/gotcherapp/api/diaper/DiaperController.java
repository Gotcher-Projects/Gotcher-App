package com.gotcherapp.api.diaper;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/diaper")
public class DiaperController {

    private final DiaperService diaperService;

    public DiaperController(DiaperService diaperService) {
        this.diaperService = diaperService;
    }

    @GetMapping
    public ResponseEntity<List<DiaperLog>> getLogs(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestParam(defaultValue = "14") int days
    ) {
        return ResponseEntity.ok(diaperService.getLogs(principal.userId(), days));
    }

    @PostMapping
    public ResponseEntity<?> addLog(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody DiaperRequest req
    ) {
        try {
            DiaperLog log = diaperService.addLog(principal.userId(), req);
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
        boolean deleted = diaperService.deleteLog(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Diaper log not found");
        return ResponseEntity.noContent().build();
    }
}
