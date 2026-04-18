package com.gotcherapp.api.diaper;

public record DiaperLog(
    Long id,
    String loggedAt,
    String category,
    String type,
    String color,
    String consistency,
    String notes
) {}
