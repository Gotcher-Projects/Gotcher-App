package com.gotcherapp.api.bump.dto;

public record CreateBumpPhotoRequest(
    Integer week,
    String imageUrl,
    String note,
    String takenDate,
    String imageOrientation
) {}
