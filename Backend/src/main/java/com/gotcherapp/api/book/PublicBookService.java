package com.gotcherapp.api.book;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.MilestoneService;
import com.gotcherapp.api.birthdetails.BirthDetails;
import com.gotcherapp.api.birthdetails.BirthDetailsService;
import com.gotcherapp.api.book.dto.PublicBookResponse;
import com.gotcherapp.api.family.FamilyMember;
import com.gotcherapp.api.family.FamilyMemberService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Share s13b — assembles the public (no-auth) payload for a shared book from its revocable token.
 *
 * <p>The response is a PII-scoped projection: only the book's PUBLISHED, v2 pages plus the
 * data-driven-canvas inputs those pages actually use. Account-level data (email, other babies,
 * unpublished pages, parentName) is never included. See s13b-public-page.md.
 */
@Service
public class PublicBookService {

    // "March 2, 2026" — matches the frontend formatDate default (toLocaleDateString 'en-US',
    // { month:'long', day:'numeric', year:'numeric' }) so the baked cover subtitle is identical.
    private static final DateTimeFormatter LONG_DATE = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US);

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final BirthDetailsService birthDetailsService;
    private final FamilyMemberService familyMemberService;
    private final MilestoneService milestoneService;

    public PublicBookService(JdbcTemplate jdbc, ObjectMapper objectMapper,
                             BirthDetailsService birthDetailsService,
                             FamilyMemberService familyMemberService,
                             MilestoneService milestoneService) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.birthDetailsService = birthDetailsService;
        this.familyMemberService = familyMemberService;
        this.milestoneService = milestoneService;
    }

    /**
     * @throws NotFoundException no such token, or the resolved book is not unlocked (defensive — the
     *         s13a mint gate means only unlocked books have tokens). Mapped to 404.
     */
    public PublicBookResponse getByToken(String token) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT b.id AS book_id, b.baby_profile_id, b.theme, b.cover_photo_url, b.cover_subtitle, " +
            "       bp.baby_name, bp.birthdate::text AS birthdate " +
            "FROM book_share_tokens t " +
            "JOIN books b ON t.book_id = b.id " +
            "JOIN baby_profiles bp ON b.baby_profile_id = bp.id " +
            "WHERE t.token = ? AND b.share_unlocked_at IS NOT NULL",
            token
        );
        if (rows.isEmpty()) {
            throw new NotFoundException("Shared book not found");
        }
        Map<String, Object> book = rows.get(0);

        Long bookId = ((Number) book.get("book_id")).longValue();
        Long profileId = ((Number) book.get("baby_profile_id")).longValue();
        String theme = (String) book.get("theme");
        String coverPhotoUrl = (String) book.get("cover_photo_url");
        String coverSubtitle = (String) book.get("cover_subtitle");
        String birthdate = (String) book.get("birthdate");
        String firstName = firstName((String) book.get("baby_name"));

        // Published, v2-only chapters in order. Classic (pre-v2) chapters are skipped (decision 5).
        List<PublicBookResponse.Chapter> chapters = new ArrayList<>();
        Set<String> templateIds = new HashSet<>();
        for (Map<String, Object> row : jdbc.queryForList(
            "SELECT anchor_type, anchor_label, layout_data FROM storybook_chapters " +
            "WHERE book_id = ? AND baby_profile_id = ? AND status = 'published' " +
            "ORDER BY COALESCE(sort_order, 999999), created_at",
            bookId, profileId
        )) {
            Map<String, Object> layout = parseJsonObject(row.get("layout_data"));
            if (layout == null || !isVersion2(layout.get("version"))) continue;
            List<Map<String, Object>> pages = asPages(layout.get("pages"));
            for (Map<String, Object> page : pages) {
                Object t = page.get("templateId");
                if (t != null) templateIds.add(t.toString());
            }
            chapters.add(new PublicBookResponse.Chapter(
                (String) row.get("anchor_type"), (String) row.get("anchor_label"), pages));
        }

        // pageData: include each sub-object ONLY if a page that renders it is present (scope, don't censor).
        boolean hasBirthDay = templateIds.contains("birth_day");
        boolean hasFamily = templateIds.contains("people") || templateIds.contains("family_tree");
        boolean hasMilestones = templateIds.contains("milestones");

        BirthDetails birthDetails = hasBirthDay ? birthDetailsService.getByProfileId(profileId) : null;
        List<FamilyMember> familyMembers = hasFamily ? familyMemberService.findByProfileId(profileId) : null;
        List<Map<String, Object>> milestonesAchieved =
            hasMilestones ? milestoneService.getAchievedByProfileId(profileId) : null;

        PublicBookResponse.PageData pageData = new PublicBookResponse.PageData(
            firstName,
            coverPhotoUrl,
            hasBirthDay ? birthdate : null,   // birth_day canvas formats the date itself; cover never needs it
            birthDetails,
            familyMembers,
            milestonesAchieved
        );

        PublicBookResponse.Cover cover = new PublicBookResponse.Cover(
            (firstName != null ? firstName : "Baby") + "'s Memory Book",
            resolveSubtitle(coverSubtitle, birthdate),
            coverPhotoUrl
        );

        return new PublicBookResponse(firstName, theme, cover, chapters, pageData);
    }

    // ── helpers ──────────────────────────────────────────────────────────────────

    /** Mirror BookCover.jsx: a saved subtitle wins; else "Born {date}" when known; else a generic line. */
    private String resolveSubtitle(String coverSubtitle, String birthdate) {
        if (coverSubtitle != null) return coverSubtitle;
        if (birthdate != null) {
            try {
                return "A memory book · Born " + LocalDate.parse(birthdate).format(LONG_DATE);
            } catch (Exception ignored) {
                // fall through to the generic subtitle on any unparseable date
            }
        }
        return "A memory book";
    }

    private static String firstName(String fullName) {
        if (fullName == null || fullName.isBlank()) return null;
        return fullName.trim().split("\\s+")[0];
    }

    private static boolean isVersion2(Object version) {
        return version instanceof Number && ((Number) version).intValue() == 2;
    }

    private Map<String, Object> parseJsonObject(Object raw) {
        if (raw == null) return null;
        try {
            return objectMapper.readValue(raw.toString(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asPages(Object raw) {
        if (raw instanceof List<?>) {
            return (List<Map<String, Object>>) raw;
        }
        return List.of();
    }

    /** No token resolves to a shared book. Mapped to 404. */
    public static class NotFoundException extends RuntimeException {
        public NotFoundException(String message) {
            super(message);
        }
    }
}
