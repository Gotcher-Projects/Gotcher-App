package com.gotcherapp.api.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class CookieUtil {

    private final boolean secure;

    public CookieUtil(@Value("${app.cookies.secure:false}") boolean secure) {
        this.secure = secure;
    }

    public void setAccessTokenCookie(HttpServletResponse response, String token, int maxAgeSeconds) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("access_token", token)
            .httpOnly(true)
            .path("/")
            .maxAge(maxAgeSeconds)
            .secure(secure)
            .sameSite("Lax")
            .build().toString());
    }

    public void setRefreshTokenCookie(HttpServletResponse response, String token, int maxAgeSeconds) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("refresh_token", token)
            .httpOnly(true)
            .path("/auth")
            .secure(secure)
            .sameSite("Lax");
        if (maxAgeSeconds >= 0) {
            builder = builder.maxAge(maxAgeSeconds);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }

    public void clearAuthCookies(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("access_token", "")
            .httpOnly(true).path("/").maxAge(0).secure(secure).sameSite("Lax")
            .build().toString());
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("refresh_token", "")
            .httpOnly(true).path("/auth").maxAge(0).secure(secure).sameSite("Lax")
            .build().toString());
    }

    public static String getCookieValue(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
