package com.gotcherapp.api.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class CookieUtil {

    private static final boolean SECURE = "true".equalsIgnoreCase(System.getenv("SECURE_COOKIES"));

    public static void setAccessTokenCookie(HttpServletResponse response, String token, int maxAgeSeconds) {
        Cookie c = new Cookie("access_token", token);
        c.setHttpOnly(true);
        c.setPath("/");
        c.setMaxAge(maxAgeSeconds);
        c.setSecure(SECURE);
        response.addCookie(c);
    }

    public static void setRefreshTokenCookie(HttpServletResponse response, String token, int maxAgeSeconds) {
        Cookie c = new Cookie("refresh_token", token);
        c.setHttpOnly(true);
        c.setPath("/auth");
        c.setMaxAge(maxAgeSeconds);
        c.setSecure(SECURE);
        response.addCookie(c);
    }

    public static void clearAuthCookies(HttpServletResponse response) {
        Cookie access = new Cookie("access_token", "");
        access.setHttpOnly(true);
        access.setPath("/");
        access.setMaxAge(0);
        response.addCookie(access);

        Cookie refresh = new Cookie("refresh_token", "");
        refresh.setHttpOnly(true);
        refresh.setPath("/auth");
        refresh.setMaxAge(0);
        response.addCookie(refresh);
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
