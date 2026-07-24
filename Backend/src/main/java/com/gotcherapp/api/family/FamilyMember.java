package com.gotcherapp.api.family;

// A baby's family member (sv2-s3 + sv2-s9.0b). `role` is the DISPLAY TITLE (what the book prints,
// e.g. "Nana"); roleCategory is the user-set relationship tier ('parent' | 'sibling' | 'grandparent'
// | 'other') the family tree uses for placement. linkedMemberId ties a grandparent to the parent
// they belong to, so the tree places them on the correct side.
public record FamilyMember(
    Long id,
    Long babyProfileId,
    String name,
    String role,
    String roleCategory,
    String photoUrl,
    String bio,
    Integer sortOrder,
    Long linkedMemberId
) {}
