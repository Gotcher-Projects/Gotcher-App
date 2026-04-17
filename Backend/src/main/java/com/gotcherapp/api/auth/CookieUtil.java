package com.gotcherapp.api.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class CookieUtil {

    private final boolean secure;

    public CookieUtil(@Value("${app.cookies.secure:false}") boolean secure) {
        this.secure = secure;
    }

    public void setAccessTokenCookie(HttpServletResponse response, String token, int maxAgeSeconds) {
        Cookie c = new Cookie("access_token", token);
        c.setHttpOnly(true);
        c.setPath("/");
        c.setMaxAge(maxAgeSeconds);
        c.setSecure(secure);
        response.addCookie(c);
    }

    public void setRefreshTokenCookie(HttpServletResponse response, String token, int maxAgeSeconds) {
        Cookie c = new Cookie("refresh_token", token);
        c.setHttpOnly(true);
        c.setPath("/auth");
        c.setMaxAge(maxAgeSeconds);
        c.setSecure(secure);
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
