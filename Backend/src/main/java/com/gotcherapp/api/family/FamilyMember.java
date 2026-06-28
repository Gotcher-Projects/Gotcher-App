package com.gotcherapp.api.family;

// A baby's family member (sv2-s3). role is free text; roleCategory is the structured bucket
// ('parent' | 'sibling' | 'grandparent' | 'other') the future family-tree renderer uses.
public record FamilyMember(
    Long id,
    Long babyProfileId,
    String name,
    String role,
    String roleCategory,
    String photoUrl,
    String bio,
    Integer sortOrder
) {}
