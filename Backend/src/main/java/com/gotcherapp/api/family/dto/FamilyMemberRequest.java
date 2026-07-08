package com.gotcherapp.api.family.dto;

// Create/update payload. name + role required on create; on PATCH, non-null fields are applied.
// role = display title; roleCategory = relationship tier; linkedMemberId = a grandparent's parent.
public record FamilyMemberRequest(
    String name,
    String role,
    String roleCategory,
    String photoUrl,
    String bio,
    Long linkedMemberId
) {}
