package com.gotcherapp.api.book.dto;

import java.util.List;

/**
 * New-book chooser payload. type is 'guided' or 'freeform'; title/theme are optional.
 * For a guided book the frontend also sends {@code chapters} — the expanded locked arc
 * (sv2-s7b) — which is materialised into one storybook_chapters row each, in the same
 * transaction as the book insert. Ignored for freeform books.
 */
public record CreateBookRequest(
    String type,
    String title,
    String theme,
    List<GuidedChapterSeed> chapters
) {}
