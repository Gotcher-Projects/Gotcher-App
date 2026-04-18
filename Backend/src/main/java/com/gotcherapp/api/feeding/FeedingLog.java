package com.gotcherapp.api.feeding;

public record FeedingLog(
    Long id,
    String type,
    String startedAt,
    String endedAt,
    Integer amountMl,
    String notes
) {}
