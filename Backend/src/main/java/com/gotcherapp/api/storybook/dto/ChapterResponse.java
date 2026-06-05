package com.gotcherapp.api.storybook.dto;

import java.util.List;
import java.util.Map;

public record ChapterResponse(
    Long id,
    String anchorType,
    String anchorKey,
    String anchorLabel,
    Integer periodStartWeeks,
    Integer periodEndWeeks,
    Integer sortOrder,
    String body,
    String status,
    String imageUrl,
    String generatedAt,
    String publishedAt,
    String createdAt,
    String updatedAt,
    List<Long> selectedJournalIds,
    List<Long> selectedFirstTimeIds,
    String supplementaryNotes,
    Map<String, String> photoOverrides,
    Map<String, String> entryNotes,
    Map<String, Object> layoutData,
    List<Map<String, Object>> chapterPhotos,
    Map<String, GeneratedPageContent> generatedContent
) {}
