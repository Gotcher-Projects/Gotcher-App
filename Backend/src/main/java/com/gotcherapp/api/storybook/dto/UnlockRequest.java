package com.gotcherapp.api.storybook.dto;

public record UnlockRequest(
    String anchorType,
    String anchorKey,
    String anchorLabel,
    Integer periodStartWeeks,
    Integer periodEndWeeks,
    String imageUrl
) {}
