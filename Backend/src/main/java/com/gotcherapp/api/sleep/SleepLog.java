package com.gotcherapp.api.sleep;

public record SleepLog(
    Long id,
    String type,
    String startedAt,
    String endedAt,
    String notes
) {}
