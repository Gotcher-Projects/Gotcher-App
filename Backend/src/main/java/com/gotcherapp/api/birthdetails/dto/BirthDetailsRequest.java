package com.gotcherapp.api.birthdetails.dto;

// All fields optional — PUT replaces the row's values with whatever is sent (nulls clear a field).
public record BirthDetailsRequest(
    String birthTime,
    String hospital,
    Double weightLbs,
    Double heightIn,
    Double headIn,
    String birthType,
    String birthStory,
    String birthPhotoUrl
) {}
