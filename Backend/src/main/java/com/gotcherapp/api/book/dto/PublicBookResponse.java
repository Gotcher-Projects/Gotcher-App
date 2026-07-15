package com.gotcherapp.api.book.dto;

import com.gotcherapp.api.birthdetails.BirthDetails;
import com.gotcherapp.api.family.FamilyMember;

import java.util.List;
import java.util.Map;

/**
 * Public (no-auth) payload for a shared book — Share s13b. A PII-scoped projection of the book's
 * PUBLISHED, v2 pages: only what those pages render, never account-level data (no email, other
 * babies, unpublished pages, or parentName). See the "PII: scope, don't censor" decision in
 * plans/storybook-v2/share/s13b-public-page.md.
 */
public record PublicBookResponse(
    String babyName,            // FIRST name only
    String type,                // freeform | guided (drives content-selection meaning on the client)
    boolean finished,           // books.finished_at set — drives the visitor work-in-progress gate/badge (s13e-2)
    String theme,               // book theme key (canvas theming)
    Cover cover,
    List<Chapter> chapters,     // content-selected + v2 only, in order; empty => "still being written"
    PageData pageData
) {
    /** Cover fields. subtitle is RESOLVED server-side; the cover never carries a raw birthdate. */
    public record Cover(String title, String subtitle, String coverPhotoUrl) {}

    /** A published chapter. `pages` is the raw layout_data v2 pages array (curated content, unfiltered). */
    public record Chapter(String anchorType, String anchorLabel, List<Map<String, Object>> pages) {}

    /**
     * Data-driven-canvas inputs, each included ONLY when a page that needs it is present:
     * birthDetails + birthdate iff a birth_day page; familyMembers iff a people/family_tree page;
     * milestonesAchieved (RAW [{key,achievedAt}], transformed client-side) iff a milestones page.
     */
    public record PageData(
        String babyName,                             // first name (mirrors top-level)
        String coverPhotoUrl,
        String birthdate,                            // null unless a birth_day page is present
        BirthDetails birthDetails,                   // null unless a birth_day page is present
        List<FamilyMember> familyMembers,            // null unless a people/family_tree page is present
        List<Map<String, Object>> milestonesAchieved // null unless a milestones page is present
    ) {}
}
