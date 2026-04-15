package com.gotcherapp.api.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RegisterRequest(
        String email,
        String password,
        @JsonProperty("display_name") String displayName) {}
