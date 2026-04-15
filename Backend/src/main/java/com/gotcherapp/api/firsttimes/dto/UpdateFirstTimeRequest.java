package com.gotcherapp.api.firsttimes.dto;

public record UpdateFirstTimeRequest(
    String label,
    String occurredDate,
    String notes,
    String imageUrl
) {}
