package com.gotcherapp.api.birthdetails;

// Birth-day details (sv2-s2). Measurements are imperial (lbs / inches) to match growth_records.
// All fields optional — a profile may have only some filled in. birthTime is an "HH:mm" string.
public record BirthDetails(
    Long id,
    Long babyProfileId,
    String birthTime,
    String hospital,
    Double weightLbs,
    Double heightIn,
    Double headIn,
    String birthType,
    String birthStory,
    String birthPhotoUrl
) {
    public static BirthDetails empty() {
        return new BirthDetails(null, null, null, null, null, null, null, null, null, null);
    }
}
