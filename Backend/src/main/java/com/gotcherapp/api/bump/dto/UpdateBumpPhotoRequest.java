package com.gotcherapp.api.bump.dto;

public record UpdateBumpPhotoRequest(
    Integer week,
    String note,
    String takenDate,
    String imageUrl,
    String imageOrientation
) {}
