package com.gotcherapp.api.auth;

import com.gotcherapp.api.auth.AuthService.*;
import com.gotcherapp.api.auth.dto.*;
import com.gotcherapp.api.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import jakarta.servlet.http.Cookie;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock AuthService authService;
    @Mock EmailVerificationService emailVerificationService;
    @Mock CookieUtil cookieUtil;
    @InjectMocks AuthController authController;

    private static final Long USER_ID = 1L;
    private static final String EMAIL = "test@example.com";
    private static final String REFRESH_TOKEN = "refresh.token.here";
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(USER_ID, EMAIL);

    private final AuthResponse AUTH_RESPONSE = new AuthResponse(
            "access.token", REFRESH_TOKEN,
            new UserDto(USER_ID, EMAIL, "Test User", false)
    );

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authController, "frontendUrl", "http://localhost:3000");
    }

    // ── POST /auth/register ───────────────────────────────────────────────────

    @Test
    void register_returns201_onSuccess() {
        when(authService.register(any())).thenReturn(AUTH_RESPONSE);
        var req = new RegisterRequest(EMAIL, "password123", null);
        var response = new MockHttpServletResponse();

        var result = authController.register(req, response);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
    }

    @Test
    void register_setsCookies_onSuccess() {
        when(authService.register(any())).thenReturn(AUTH_RESPONSE);
        var req = new RegisterRequest(EMAIL, "password123", null);
        var response = new MockHttpServletResponse();

        authController.register(req, response);

        verify(cookieUtil).setAccessTokenCookie(same(response), eq("access.token"), anyInt());
        verify(cookieUtil).setRefreshTokenCookie(same(response), eq(REFRESH_TOKEN), anyInt());
    }

    @Test
    void register_returns400_onIllegalArgument() {
        when(authService.register(any())).thenThrow(new IllegalArgumentException("Password too short"));
        var response = new MockHttpServletResponse();

        var result = authController.register(new RegisterRequest(EMAIL, "short", null), response);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
    }

    @Test
    void register_returns409_onDuplicateEmail() {
        when(authService.register(any())).thenThrow(new EmailAlreadyExistsException());
        var response = new MockHttpServletResponse();

        var result = authController.register(new RegisterRequest(EMAIL, "password123", null), response);

        assertEquals(HttpStatus.CONFLICT, result.getStatusCode());
    }

    // ── POST /auth/login ──────────────────────────────────────────────────────

    @Test
    void login_returns200_onSuccess() {
        when(authService.login(any())).thenReturn(AUTH_RESPONSE);
        var response = new MockHttpServletResponse();

        var result = authController.login(new LoginRequest(EMAIL, "password123"), response);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(AUTH_RESPONSE, result.getBody());
    }

    @Test
    void login_setsCookies_onSuccess() {
        when(authService.login(any())).thenReturn(AUTH_RESPONSE);
        var response = new MockHttpServletResponse();

        authController.login(new LoginRequest(EMAIL, "password123"), response);

        verify(cookieUtil).setAccessTokenCookie(same(response), eq("access.token"), anyInt());
        verify(cookieUtil).setRefreshTokenCookie(same(response), eq(REFRESH_TOKEN), anyInt());
    }

    @Test
    void login_returns400_onIllegalArgument() {
        when(authService.login(any())).thenThrow(new IllegalArgumentException("Required"));
        var response = new MockHttpServletResponse();

        var result = authController.login(new LoginRequest(null, null), response);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
    }

    @Test
    void login_returns401_onInvalidCredentials() {
        when(authService.login(any())).thenThrow(new InvalidCredentialsException());
        var response = new MockHttpServletResponse();

        var result = authController.login(new LoginRequest(EMAIL, "wrongpass"), response);

        assertEquals(HttpStatus.UNAUTHORIZED, result.getStatusCode());
    }

    @Test
    void login_returns403_onDisabledAccount() {
        when(authService.login(any())).thenThrow(new AccountDisabledException());
        var response = new MockHttpServletResponse();

        var result = authController.login(new LoginRequest(EMAIL, "password123"), response);

        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
    }

    // ── POST /auth/refresh ────────────────────────────────────────────────────

    @Test
    void refresh_returns200_withCookieToken() {
        when(authService.refresh(REFRESH_TOKEN)).thenReturn(AUTH_RESPONSE);
        var request = requestWithCookie("refresh_token", REFRESH_TOKEN);
        var response = new MockHttpServletResponse();

        var result = authController.refresh(request, response);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void refresh_setsCookies_onSuccess() {
        when(authService.refresh(REFRESH_TOKEN)).thenReturn(AUTH_RESPONSE);
        var request = requestWithCookie("refresh_token", REFRESH_TOKEN);
        var response = new MockHttpServletResponse();

        authController.refresh(request, response);

        verify(cookieUtil).setAccessTokenCookie(same(response), eq("access.token"), anyInt());
        verify(cookieUtil).setRefreshTokenCookie(same(response), eq(REFRESH_TOKEN), anyInt());
    }

    @Test
    void refresh_returns401_onInvalidToken() {
        when(authService.refresh(REFRESH_TOKEN)).thenThrow(new InvalidTokenException());
        var request = requestWithCookie("refresh_token", REFRESH_TOKEN);
        var response = new MockHttpServletResponse();

        var result = authController.refresh(request, response);

        assertEquals(HttpStatus.UNAUTHORIZED, result.getStatusCode());
    }

    @Test
    void refresh_clearsCookies_onInvalidToken() {
        when(authService.refresh(any())).thenThrow(new InvalidTokenException());
        var request = requestWithCookie("refresh_token", REFRESH_TOKEN);
        var response = new MockHttpServletResponse();

        authController.refresh(request, response);

        Cookie accessCookie = response.getCookie("access_token");
        assertNotNull(accessCookie);
        assertEquals(0, accessCookie.getMaxAge());
    }

    // ── POST /auth/logout ─────────────────────────────────────────────────────

    @Test
    void logout_returns200_always() {
        var request = requestWithCookie("refresh_token", REFRESH_TOKEN);
        var response = new MockHttpServletResponse();

        var result = authController.logout(request, response);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void logout_clearsCookies() {
        var request = requestWithCookie("refresh_token", REFRESH_TOKEN);
        var response = new MockHttpServletResponse();

        authController.logout(request, response);

        Cookie accessCookie = response.getCookie("access_token");
        assertNotNull(accessCookie);
        assertEquals(0, accessCookie.getMaxAge());
    }

    @Test
    void logout_returns200_evenWithoutCookie() {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        var result = authController.logout(request, response);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        verifyNoInteractions(authService);
    }

    // ── GET /auth/me ──────────────────────────────────────────────────────────

    @Test
    void me_returns200_withUserInfo() {
        var result = authController.me(PRINCIPAL);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        @SuppressWarnings("unchecked")
        var body = (java.util.Map<String, Object>) result.getBody();
        assertNotNull(body);
        assertNotNull(body.get("user"));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private MockHttpServletRequest requestWithCookie(String name, String value) {
        var request = new MockHttpServletRequest();
        request.setCookies(new Cookie(name, value));
        return request;
    }
}
