package com.gotcherapp.api.baby;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/vaccines")
public class VaccineController {

    private final VaccineService vaccineService;

    public VaccineController(VaccineService vaccineService) {
        this.vaccineService = vaccineService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll(@AuthenticationPrincipal AuthPrincipal principal) {
        List<String> keys = vaccineService.getKeys(principal.userId());
        return ResponseEntity.ok(Map.of("keys", keys));
    }

    @PostMapping("/{key}")
    public ResponseEntity<?> achieve(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable String key
    ) {
        try {
            vaccineService.achieve(principal.userId(), key);
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
        vaccineService.unachieve(principal.userId(), key);
        return ResponseEntity.noContent().build();
    }
}
