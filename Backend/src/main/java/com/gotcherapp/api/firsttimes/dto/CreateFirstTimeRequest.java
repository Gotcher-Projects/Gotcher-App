package com.gotcherapp.api.firsttimes.dto;

public record CreateFirstTimeRequest(
    String label,
    String occurredDate,
    String imageUrl,
    String notes,
    String imageOrientation
) {}
