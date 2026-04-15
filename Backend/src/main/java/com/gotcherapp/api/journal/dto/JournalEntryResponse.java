package com.gotcherapp.api.journal.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record JournalEntryResponse(
        Long id,
        int week,
        String title,
        String story,
        @JsonProperty("entry_date") String entryDate,
        @JsonProperty("image_url") String imageUrl) {}
