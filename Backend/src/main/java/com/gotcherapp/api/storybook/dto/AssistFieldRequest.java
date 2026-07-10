package com.gotcherapp.api.storybook.dto;

import java.util.Map;

// Per-field AI assist request (sv2-s10). The client sends only a promptType + structured context;
// the server owns the actual prompt template resolved from promptType (no free-form client prompts).
public record AssistFieldRequest(String promptType, Map<String, String> context) {}
