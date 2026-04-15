package com.gotcherapp.api.sleep;

public record SleepRequest(
    String type,
    String startedAt,
    String endedAt,
    String notes
) {}
