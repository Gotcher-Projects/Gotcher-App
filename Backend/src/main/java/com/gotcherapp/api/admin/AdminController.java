package com.gotcherapp.api.admin;

import com.gotcherapp.api.common.ApiError;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    @Value("${app.admin.secret:}")
    private String adminSecret;

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(
            @RequestBody Map<String, String> body,
            @RequestHeader("X-Admin-Secret") String secret) {

        if (adminSecret.isBlank() || !adminSecret.equals(secret)) {
            return ApiError.unauthorized("Invalid admin secret");
        }

        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ApiError.badRequest("email is required");
        }

        try {
            DeletionReport report = adminService.deleteAccount(email);
            return ResponseEntity.ok(report);
        } catch (AdminService.UserNotFoundException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError("Deletion failed: " + e.getMessage());
        }
    }
}
