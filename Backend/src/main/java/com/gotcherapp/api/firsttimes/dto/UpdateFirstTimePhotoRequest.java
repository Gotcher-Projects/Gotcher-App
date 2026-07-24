package com.gotcherapp.api.firsttimes.dto;

// Caption-only edit for an existing additional photo. Null leaves the caption unchanged.
public record UpdateFirstTimePhotoRequest(
    String caption
) {}
