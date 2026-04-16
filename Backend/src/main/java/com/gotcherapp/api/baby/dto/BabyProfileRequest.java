package com.gotcherapp.api.baby.dto;

public record BabyProfileRequest(
    String babyName,
    String birthdate,
    String parentName,
    String phone,
    String sex
) {}
