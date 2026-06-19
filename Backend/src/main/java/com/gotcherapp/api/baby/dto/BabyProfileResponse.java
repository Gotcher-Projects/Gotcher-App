package com.gotcherapp.api.baby.dto;

public record BabyProfileResponse(
    Long id,
    String babyName,
    String birthdate,
    String parentName,
    String phone,
    String sex,
    String bookTheme,
    String coverPhotoUrl,
    String coverSubtitle,
    String dueDate,
    String phase
) {}
