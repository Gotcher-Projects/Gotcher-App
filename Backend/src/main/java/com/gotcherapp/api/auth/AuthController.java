package com.gotcherapp.api.auth;

import com.gotcherapp.api.auth.AuthService.*;
import com.gotcherapp.api.auth.dto.*;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    // Access token TTL in seconds (matches application.properties 900000ms)
    private static final int ACCESS_MAX_AGE  = 900;
    // Refresh token TTL in seconds (7 days)
    private static final int REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

    private final AuthService authService;
    private final EmailVerificationService emailVerificationService;
    private final PasswordResetService passwordResetService;
    private final CookieUtil cookieUtil;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public AuthController(AuthService authService, EmailVerificationService emailVerificationService,
                          PasswordResetService passwordResetService, CookieUtil cookieUtil) {
        this.authService = authService;
        this.emailVerificationService = emailVerificationService;
        this.passwordResetService = passwordResetService;
        this.cookieUtil = cookieUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req, HttpServletResponse response) {
        try {
            AuthResponse data = authService.register(req);
            cookieUtil.setAccessTokenCookie(response, data.accessToken(), ACCESS_MAX_AGE);
            cookieUtil.setRefreshTokenCookie(response, data.refreshToken(), REFRESH_MAX_AGE);
            return ResponseEntity.status(HttpStatus.CREATED).body(data);
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        } catch (EmailAlreadyExistsException e) {
            return ApiError.conflict("Email already registered");
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req, HttpServletResponse response) {
        try {
            AuthResponse data = authService.login(req);
            cookieUtil.setAccessTokenCookie(response, data.accessToken(), ACCESS_MAX_AGE);
            int refreshMaxAge = req.rememberMe() ? (30 * 24 * 60 * 60) : -1;
            cookieUtil.setRefreshTokenCookie(response, data.refreshToken(), refreshMaxAge);
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        } catch (InvalidCredentialsException e) {
            return ApiError.unauthorized("Invalid email or password");
        } catch (AccountDisabledException e) {
            return ApiError.forbidden("Account is disabled");
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = CookieUtil.getCookieValue(request, "refresh_token");
        try {
            AuthResponse data = authService.refresh(refreshToken);
            cookieUtil.setAccessTokenCookie(response, data.accessToken(), ACCESS_MAX_AGE);
            cookieUtil.setRefreshTokenCookie(response, data.refreshToken(), REFRESH_MAX_AGE);
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException e) {
            CookieUtil.clearAuthCookies(response);
            return ApiError.badRequest(e.getMessage());
        } catch (InvalidTokenException e) {
            CookieUtil.clearAuthCookies(response);
            return ApiError.unauthorized("Invalid or expired refresh token");
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = CookieUtil.getCookieValue(request, "refresh_token");
        try {
            if (refreshToken != null) authService.logout(refreshToken);
        } catch (IllegalArgumentException ignored) {}
        CookieUtil.clearAuthCookies(response);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(Map.of("user", Map.of(
            "userId", principal.userId(),
            "email", principal.email()
        )));
    }

    @GetMapping("/verify-email")
    public void verifyEmail(@RequestParam String token, HttpServletResponse response) throws IOException {
        boolean success = emailVerificationService.verify(token);
        String redirect = frontendUrl + (success ? "?email_verified=true" : "?email_verified=error");
        response.sendRedirect(redirect);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        try {
            passwordResetService.sendResetEmail(body.get("email"));
        } catch (Exception e) {
            // logged but swallowed — never reveal whether email exists
        }
        return ResponseEntity.ok(Map.of("message", "If that email is registered, a reset link has been sent."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        boolean ok = passwordResetService.resetPassword(body.get("token"), body.get("newPassword"));
        if (!ok) return ResponseEntity.status(400).body(Map.of("error", "Invalid or expired reset link."));
        return ResponseEntity.ok(Map.of("message", "Password updated."));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerification(@AuthenticationPrincipal AuthPrincipal principal) {
        try {
            emailVerificationService.sendVerificationEmail(principal.userId(), principal.email());
            return ResponseEntity.ok(Map.of("message", "Verification email sent"));
        } catch (Exception e) {
            return ApiError.serverError("Failed to send verification email");
        }
    }
}
