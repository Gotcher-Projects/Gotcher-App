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
    String updatedAt,
    // Share s13c: derived boolean (books.share_unlocked_at != null), NOT the raw timestamp. Drives the
    // StorybookTab share section (upsell when false, manage controls when true). Set by the Payments webhook.
    Boolean shareUnlocked
) {}
