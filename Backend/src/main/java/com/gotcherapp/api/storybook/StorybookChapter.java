package com.gotcherapp.api.storybook;

public record StorybookChapter(
    Long id,
    Long babyProfileId,
    String anchorType,
    String anchorKey,
    String anchorLabel,
    Integer periodStartWeeks,
    Integer periodEndWeeks,
    Integer sortOrder,
    String body,
    String status,
    String generatedAt,
    String publishedAt,
    String createdAt,
    String updatedAt
) {}
