package com.gotcherapp.api.journal.dto;

public record JournalEntryUpdateRequest(
    String title,
    String story
) {}
