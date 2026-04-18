package com.gotcherapp.api.feeding;

public record StartFeedRequest(
    String type,
    String startedAt
) {}
