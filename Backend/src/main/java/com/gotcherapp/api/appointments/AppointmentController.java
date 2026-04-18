package com.gotcherapp.api.appointments;

import com.gotcherapp.api.appointments.dto.AppointmentRequest;
import com.gotcherapp.api.appointments.dto.AppointmentResponse;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping
    public ResponseEntity<List<AppointmentResponse>> getAll(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(appointmentService.findAll(principal.userId()));
    }

    @PostMapping
    public ResponseEntity<?> create(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody AppointmentRequest req
    ) {
        try {
            AppointmentResponse created = appointmentService.create(principal.userId(), req);
            return ResponseEntity.status(201).body(created);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody AppointmentRequest req
    ) {
        Optional<AppointmentResponse> updated = appointmentService.update(principal.userId(), id, req);
        if (updated.isEmpty()) return ApiError.notFound("Appointment not found");
        return ResponseEntity.ok(updated.get());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        boolean deleted = appointmentService.delete(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Appointment not found");
        return ResponseEntity.noContent().build();
    }
}
