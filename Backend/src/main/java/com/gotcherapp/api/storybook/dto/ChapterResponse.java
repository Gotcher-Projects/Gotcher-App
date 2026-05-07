package com.gotcherapp.api.storybook.dto;

public record ChapterResponse(
    Long id,
    String anchorType,
    String anchorKey,
    String anchorLabel,
    Integer periodStartWeeks,
    Integer periodEndWeeks,
    Integer sortOrder,
    String body,
    String status,
    String imageUrl,
    String generatedAt,
    String publishedAt,
    String createdAt,
    String updatedAt
) {}
