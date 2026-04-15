package com.gotcherapp.api.poop;

public record PoopRequest(
    String loggedAt,
    String type,
    String color,
    String consistency,
    String notes
) {}
