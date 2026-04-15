package com.gotcherapp.api.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record LogoutRequest(@JsonProperty("refreshToken") String refreshToken) {}
