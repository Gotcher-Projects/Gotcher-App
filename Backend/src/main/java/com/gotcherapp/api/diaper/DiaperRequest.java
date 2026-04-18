package com.gotcherapp.api.diaper;

public record DiaperRequest(
    String loggedAt,
    String category,
    String type,
    String color,
    String consistency,
    String notes
) {}
