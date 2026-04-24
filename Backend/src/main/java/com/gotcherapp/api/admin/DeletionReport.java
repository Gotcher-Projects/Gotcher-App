package com.gotcherapp.api.admin;

import java.util.Map;

public record DeletionReport(
    String email,
    Long userId,
    Map<String, Integer> deleted,
    Map<String, Object> cloudinary
) {}
