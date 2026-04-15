package com.gotcherapp.api.poop;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/poop")
public class PoopController {

    private final PoopService poopService;

    public PoopController(PoopService poopService) {
        this.poopService = poopService;
    }

    @GetMapping
    public ResponseEntity<List<PoopLog>> getLogs(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestParam(defaultValue = "14") int days
    ) {
        return ResponseEntity.ok(poopService.getLogs(principal.userId(), days));
    }

    @PostMapping
    public ResponseEntity<?> addLog(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody PoopRequest req
    ) {
        try {
            PoopLog log = poopService.addLog(principal.userId(), req);
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
        boolean deleted = poopService.deleteLog(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Poop log not found");
        return ResponseEntity.noContent().build();
    }
}
