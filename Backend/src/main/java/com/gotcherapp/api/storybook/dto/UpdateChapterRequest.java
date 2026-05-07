package com.gotcherapp.api.storybook.dto;

public record UpdateChapterRequest(
    String body,
    String status,
    Integer sortOrder
) {}
