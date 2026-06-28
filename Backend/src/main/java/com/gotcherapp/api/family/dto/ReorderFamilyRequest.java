package com.gotcherapp.api.family.dto;

import java.util.List;

public record ReorderFamilyRequest(List<Long> orderedIds) {}
