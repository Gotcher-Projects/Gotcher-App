package com.gotcherapp.api.firsttimes;

public record FirstTimePhoto(
    Long id,
    Long firstTimeId,
    String imageUrl,
    String caption,
    Integer sortOrder,
    String createdAt
) {}
