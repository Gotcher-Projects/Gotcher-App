package com.gotcherapp.api.journal.dto;

public record JournalEntryRequest(int week, String title, String story, String imageUrl) {}
