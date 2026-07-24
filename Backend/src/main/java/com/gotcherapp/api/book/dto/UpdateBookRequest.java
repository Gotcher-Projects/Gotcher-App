package com.gotcherapp.api.book.dto;

/** Partial book update (PATCH /books/{id}): any non-null field is applied. */
public record UpdateBookRequest(
    String title,
    String theme,
    String coverSubtitle,
    // Share s13e-2: owner "Mark as finished". true → finished_at = NOW(); false → NULL. null → unchanged.
    Boolean finished
) {}
