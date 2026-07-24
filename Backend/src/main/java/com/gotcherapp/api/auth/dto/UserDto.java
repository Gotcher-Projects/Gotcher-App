package com.gotcherapp.api.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UserDto(
        Long id,
        String email,
        @JsonProperty("display_name") String displayName,
        @JsonProperty("email_verified") boolean emailVerified,
        @JsonProperty("tier") String tier,
        @JsonProperty("ai_credits_remaining") Integer aiCreditsRemaining,
        // Print pr8 — the global print kill switch (app.print.enabled) surfaced to the frontend so the
        // "Order a printed book" entry point renders only when print is on. UX only; the real guards are
        // pr7's checkout gate + pr5's Lulu-client backstop. Rides UserDto to avoid a second fetch.
        @JsonProperty("print_enabled") boolean printEnabled) {}
