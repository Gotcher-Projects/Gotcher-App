package com.gotcherapp.api.book.dto;

/** Partial book update (PATCH /books/{id}): any non-null field is applied. */
public record UpdateBookRequest(
    String title,
    String theme,
    String coverSubtitle
) {}
