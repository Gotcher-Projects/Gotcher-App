package com.gotcherapp.api.security;

/** Holds the authenticated user's identity, stored in the SecurityContext. */
public record AuthPrincipal(Long userId, String email) {}
