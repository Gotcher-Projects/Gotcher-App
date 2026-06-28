package com.gotcherapp.api.family.dto;

// Create/update payload. name + role required on create; on PATCH, non-null fields are applied.
public record FamilyMemberRequest(
    String name,
    String role,
    String roleCategory,
    String photoUrl,
    String bio
) {}
