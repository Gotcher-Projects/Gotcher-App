package com.gotcherapp.api.family;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.family.dto.FamilyMemberRequest;
import com.gotcherapp.api.family.dto.ReorderFamilyRequest;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/family-members")
public class FamilyMemberController {

    private final FamilyMemberService familyMemberService;

    public FamilyMemberController(FamilyMemberService familyMemberService) {
        this.familyMemberService = familyMemberService;
    }

    @GetMapping
    public ResponseEntity<List<FamilyMember>> getAll(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(familyMemberService.findAll(principal.userId()));
    }

    @PostMapping
    public ResponseEntity<?> create(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody FamilyMemberRequest req
    ) {
        try {
            return ResponseEntity.status(201).body(familyMemberService.create(principal.userId(), req));
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    // Reorder must precede /{id} mapping is unnecessary (distinct path), but keep it explicit.
    @PutMapping("/order")
    public ResponseEntity<List<FamilyMember>> reorder(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody ReorderFamilyRequest req
    ) {
        return ResponseEntity.ok(familyMemberService.reorder(principal.userId(), req.orderedIds()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody FamilyMemberRequest req
    ) {
        Optional<FamilyMember> updated = familyMemberService.update(principal.userId(), id, req);
        if (updated.isEmpty()) return ApiError.notFound("Family member not found");
        return ResponseEntity.ok(updated.get());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        if (!familyMemberService.delete(principal.userId(), id)) {
            return ApiError.notFound("Family member not found");
        }
        return ResponseEntity.noContent().build();
    }
}
