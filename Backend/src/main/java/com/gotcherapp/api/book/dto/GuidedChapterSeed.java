package com.gotcherapp.api.book.dto;

/**
 * One materialised page of a guided book's locked arc (sv2-s7b, Model A), sent inside
 * {@link CreateBookRequest#chapters()}. The guided metadata (templateId, kind, prompt, label,
 * section) rides inside {@code layoutData} — see Frontend/src/lib/guidedBookArc.js. The server fixes
 * {@code anchor_type} to 'guided'; {@code anchorKey} is the arc entry id, unique within the book so it
 * satisfies the (book_id, anchor_type, anchor_key) constraint.
 */
public record GuidedChapterSeed(
    String anchorKey,
    String anchorLabel,
    Integer sortOrder,
    Object layoutData
) {}
