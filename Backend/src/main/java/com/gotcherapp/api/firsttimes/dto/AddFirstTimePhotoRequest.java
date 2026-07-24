package com.gotcherapp.api.firsttimes.dto;

// The image is uploaded first via POST /upload (returns a URL); this just records the URL
// plus an optional caption against the first time. Mirrors how the hero image_url is handled.
public record AddFirstTimePhotoRequest(
    String imageUrl,
    String caption
) {}
