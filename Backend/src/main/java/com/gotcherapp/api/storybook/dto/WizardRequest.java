package com.gotcherapp.api.storybook.dto;

import java.util.List;
import java.util.Map;

public record WizardRequest(
    String anchorKey,
    String anchorLabel,
    Integer periodStartWeeks,
    Integer periodEndWeeks,
    List<Long> selectedJournalIds,
    List<Long> selectedFirstTimeIds,
    String supplementaryNotes,
    Map<String, String> photoOverrides,
    Map<String, String> entryNotes,
    Boolean skipGeneration
) {}
