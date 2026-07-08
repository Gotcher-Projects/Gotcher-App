package com.gotcherapp.api.book;

/** A memory book owned by a baby profile (sv2-s7a). Doubles as the API response shape. */
public record Book(
    Long id,
    Long babyProfileId,
    String type,
    String title,
    String theme,
    String coverPhotoUrl,
    String coverSubtitle,
    Integer sortOrder,
    String createdAt,
    String updatedAt
) {}
