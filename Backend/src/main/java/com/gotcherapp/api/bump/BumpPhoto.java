package com.gotcherapp.api.bump;

public record BumpPhoto(
    Long id,
    Long babyProfileId,
    Integer week,
    String imageUrl,
    String note,
    String takenDate,
    String imageOrientation,
    String createdAt
) {}
