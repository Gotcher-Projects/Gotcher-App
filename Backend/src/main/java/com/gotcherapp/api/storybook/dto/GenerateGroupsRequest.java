package com.gotcherapp.api.storybook.dto;

import java.util.List;
import java.util.Map;

public record GenerateGroupsRequest(List<PageGroup> groups) {

    public record PageGroup(
        String pageId,
        List<String> sourceKeys,
        String templateId,
        Map<String, List<String>> photoAssignments
    ) {}
}
