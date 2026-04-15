package com.gotcherapp.api.poop;

public record PoopLog(
    Long id,
    String loggedAt,
    String type,
    String color,
    String consistency,
    String notes
) {}
