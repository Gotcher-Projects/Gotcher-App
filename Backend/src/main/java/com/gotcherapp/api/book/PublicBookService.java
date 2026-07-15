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
 * Share s13b/s13e-2 — assembles the public (no-auth) payload for a shared book from its revocable token.
 *
 * <p>The response is a PII-scoped projection. Visibility is CONTENT-based (s13e-2), not publish-status:
 * a <b>freeform</b> book shows all its pages; a <b>guided</b> book shows only <b>filled</b> pages (empty
 * template slots are skipped, dividers only when their section has content). Plus the data-driven-canvas
 * inputs the shown pages use. Account-level data (email, other babies, parentName) is never included.
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
            "SELECT b.id AS book_id, b.baby_profile_id, b.type, b.theme, b.cover_photo_url, b.cover_subtitle, " +
            "       (b.finished_at IS NOT NULL) AS finished, bp.baby_name, bp.birthdate::text AS birthdate " +
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
        String type = (String) book.get("type");
        String theme = (String) book.get("theme");
        String coverPhotoUrl = (String) book.get("cover_photo_url");
        String coverSubtitle = (String) book.get("cover_subtitle");
        String birthdate = (String) book.get("birthdate");
        boolean finished = Boolean.TRUE.equals(book.get("finished"));
        String firstName = firstName((String) book.get("baby_name"));

        // Data-driven-canvas inputs, fetched UP FRONT: a guided page's "is it filled?" decision for
        // birth_day / people / family_tree / milestones depends on whether this underlying data exists.
        BirthDetails birthDetails = birthDetailsService.getByProfileId(profileId);
        List<FamilyMember> familyMembers = familyMemberService.findByProfileId(profileId);
        List<Map<String, Object>> milestonesAchieved = milestoneService.getAchievedByProfileId(profileId);
        boolean birthFilled = birthDetailsHasData(birthDetails);
        boolean familyFilled = familyMembers != null && !familyMembers.isEmpty();
        boolean milestonesFilled = milestonesAchieved != null && !milestonesAchieved.isEmpty();

        boolean isFreeform = "freeform".equals(type);

        // Content-based selection (s13e-2): freeform → all pages; guided → filled pages only, with a divider
        // shown only when a filled page follows it in its section. v2-only; ordered.
        List<PublicBookResponse.Chapter> chapters = new ArrayList<>();
        Set<String> shown = new HashSet<>();
        PublicBookResponse.Chapter pendingDivider = null;   // guided: held until its section proves non-empty
        boolean anyContent = false;

        for (Map<String, Object> row : jdbc.queryForList(
            "SELECT anchor_type, anchor_label, layout_data FROM storybook_chapters " +
            "WHERE book_id = ? AND baby_profile_id = ? " +
            "ORDER BY COALESCE(sort_order, 999999), created_at",
            bookId, profileId
        )) {
            Map<String, Object> layout = parseJsonObject(row.get("layout_data"));
            if (layout == null || !isVersion2(layout.get("version"))) continue;
            List<Map<String, Object>> pages = asPages(layout.get("pages"));
            String anchorType = (String) row.get("anchor_type");
            String anchorLabel = (String) row.get("anchor_label");

            if (isFreeform) {
                if (pages.isEmpty()) continue;
                for (Map<String, Object> p : pages) {
                    collectTemplateId(p, shown);
                    if (pageIsFilled(p, birthFilled, familyFilled, milestonesFilled)) anyContent = true;
                }
                chapters.add(new PublicBookResponse.Chapter(anchorType, anchorLabel, pages));
                continue;
            }

            // guided
            boolean isDivider = pages.size() == 1 && "chapter_divider".equals(templateId(pages.get(0)));
            if (isDivider) {
                pendingDivider = new PublicBookResponse.Chapter(anchorType, anchorLabel, pages);
                continue;
            }
            List<Map<String, Object>> filled = new ArrayList<>();
            for (Map<String, Object> p : pages) {
                if (pageIsFilled(p, birthFilled, familyFilled, milestonesFilled)) filled.add(p);
            }
            if (filled.isEmpty()) continue;
            anyContent = true;
            if (pendingDivider != null) {                       // flush the divider that opens this section
                chapters.add(pendingDivider);
                for (Map<String, Object> p : pendingDivider.pages()) collectTemplateId(p, shown);
                pendingDivider = null;
            }
            for (Map<String, Object> p : filled) collectTemplateId(p, shown);
            chapters.add(new PublicBookResponse.Chapter(anchorType, anchorLabel, filled));
        }

        // A freeform book with only empty pages resolves to "still being written" (empty), like guided.
        if (!anyContent) {
            chapters.clear();
            shown.clear();
        }

        // pageData scoped to what the SHOWN pages render (scope, don't censor).
        boolean showBirth = shown.contains("birth_day");
        boolean showFamily = shown.contains("people") || shown.contains("family_tree");
        boolean showMilestones = shown.contains("milestones");

        PublicBookResponse.PageData pageData = new PublicBookResponse.PageData(
            firstName,
            coverPhotoUrl,
            showBirth ? birthdate : null,   // birth_day canvas formats the date itself; cover never needs it
            showBirth ? birthDetails : null,
            showFamily ? familyMembers : null,
            showMilestones ? milestonesAchieved : null
        );

        PublicBookResponse.Cover cover = new PublicBookResponse.Cover(
            (firstName != null ? firstName : "Baby") + "'s Memory Book",
            resolveSubtitle(coverSubtitle, birthdate),
            coverPhotoUrl
        );

        return new PublicBookResponse(firstName, type, finished, theme, cover, chapters, pageData);
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

    // ── content-based "is this page filled?" (s13e-2) ─────────────────────────────

    private static String templateId(Map<String, Object> page) {
        Object t = page.get("templateId");
        return t != null ? t.toString() : null;
    }

    private static void collectTemplateId(Map<String, Object> page, Set<String> into) {
        String t = templateId(page);
        if (t != null) into.add(t);
    }

    /**
     * Data-driven pages (birth_day/people/family_tree/milestones) render from pageData, so they're "filled"
     * iff that underlying data exists — NOT by their placeholder title block. Everything else is filled iff a
     * block carries real content. Mirrors the frontend chapterHasContent rule (lib/guidedBook.js).
     */
    private boolean pageIsFilled(Map<String, Object> page, boolean birthFilled, boolean familyFilled, boolean milestonesFilled) {
        String t = templateId(page);
        if ("birth_day".equals(t)) return birthFilled;
        if ("people".equals(t) || "family_tree".equals(t)) return familyFilled;
        if ("milestones".equals(t)) return milestonesFilled;
        return hasBlockContent(page);
    }

    @SuppressWarnings("unchecked")
    private boolean hasBlockContent(Map<String, Object> page) {
        Object blocks = page.get("blocks");
        if (!(blocks instanceof List<?>)) return false;
        for (Object b : (List<Object>) blocks) {
            if (!(b instanceof Map)) continue;
            Map<String, Object> block = (Map<String, Object>) b;
            String type = block.get("type") == null ? null : block.get("type").toString();
            if ("photo".equals(type)) {
                if (nonBlank(block.get("url"))) return true;
            } else if ("text".equals(type)) {
                if (jsonHasText(block.get("content"))) return true;
            } else if ("l-wrap".equals(type)) {
                if (nonBlank(block.get("url")) || jsonHasText(block.get("content"))) return true;
            }
        }
        return false;
    }

    /** Walk a Tiptap doc ({type,content:[…]} tree) for any non-blank leaf "text" node. */
    private boolean jsonHasText(Object node) {
        if (node instanceof Map<?, ?> m) {
            Object txt = m.get("text");
            if (txt instanceof String s && !s.isBlank()) return true;
            return jsonHasText(m.get("content"));
        }
        if (node instanceof List<?> list) {
            for (Object el : list) if (jsonHasText(el)) return true;
        }
        return false;
    }

    private static boolean birthDetailsHasData(BirthDetails bd) {
        if (bd == null) return false;
        return bd.birthTime() != null || bd.hospital() != null || bd.weightLbs() != null
            || bd.heightIn() != null || bd.headIn() != null || bd.birthType() != null
            || bd.birthStory() != null || bd.birthPhotoUrl() != null;
    }

    private static boolean nonBlank(Object o) {
        return o instanceof String s && !s.isBlank();
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
