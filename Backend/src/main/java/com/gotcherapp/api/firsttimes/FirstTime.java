package com.gotcherapp.api.firsttimes;

public record FirstTime(
    Long id,
    Long babyProfileId,
    String label,
    String occurredDate,
    String imageUrl,
    String notes,
    String createdAt,
    String imageOrientation
) {}
