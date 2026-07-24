package com.gotcherapp.api.birthdetails;

import com.gotcherapp.api.birthdetails.dto.BirthDetailsRequest;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/birth-details")
public class BirthDetailsController {

    private final BirthDetailsService birthDetailsService;

    public BirthDetailsController(BirthDetailsService birthDetailsService) {
        this.birthDetailsService = birthDetailsService;
    }

    // Always 200 with a BirthDetails shape (empty record when nothing recorded yet) so the
    // frontend gets a consistent object.
    @GetMapping
    public ResponseEntity<BirthDetails> get(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(birthDetailsService.getOrEmpty(principal.userId()));
    }

    @PutMapping
    public ResponseEntity<?> upsert(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody BirthDetailsRequest req
    ) {
        try {
            return ResponseEntity.ok(birthDetailsService.upsert(principal.userId(), req));
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }
}
