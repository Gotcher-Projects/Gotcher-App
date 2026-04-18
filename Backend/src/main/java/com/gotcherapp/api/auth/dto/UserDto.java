package com.gotcherapp.api.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UserDto(
        Long id,
        String email,
        @JsonProperty("display_name") String displayName,
        @JsonProperty("email_verified") boolean emailVerified) {}
