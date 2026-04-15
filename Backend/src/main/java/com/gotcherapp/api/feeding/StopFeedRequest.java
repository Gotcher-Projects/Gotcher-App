package com.gotcherapp.api.feeding;

public record StopFeedRequest(
    String endedAt,
    Integer amountMl,
    String notes
) {}
