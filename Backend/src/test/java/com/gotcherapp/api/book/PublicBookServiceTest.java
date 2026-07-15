package com.gotcherapp.api.book;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gotcherapp.api.baby.MilestoneService;
import com.gotcherapp.api.birthdetails.BirthDetails;
import com.gotcherapp.api.birthdetails.BirthDetailsService;
import com.gotcherapp.api.book.dto.PublicBookResponse;
import com.gotcherapp.api.family.FamilyMember;
import com.gotcherapp.api.family.FamilyMemberService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PublicBookServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock BirthDetailsService birthDetailsService;
    @Mock FamilyMemberService familyMemberService;
    @Mock MilestoneService milestoneService;
    final ObjectMapper objectMapper = new ObjectMapper();

    private static final String TOKEN = "tok-abc";
    private static final long BOOK_ID = 5L;
    private static final long PROFILE_ID = 9L;

    private PublicBookService service() {
        return new PublicBookService(jdbc, objectMapper, birthDetailsService, familyMemberService, milestoneService);
    }

    private void stubBook(String coverSubtitle, String birthdate) {
        Map<String, Object> row = new HashMap<>();
        row.put("book_id", BOOK_ID);
        row.put("baby_profile_id", PROFILE_ID);
        row.put("theme", "midnight");
        row.put("cover_photo_url", "http://img/cover.jpg");
        row.put("cover_subtitle", coverSubtitle);
        row.put("baby_name", "Lily Rose Gotcher");
        row.put("birthdate", birthdate);
        when(jdbc.queryForList(contains("book_share_tokens"), eq(TOKEN))).thenReturn(List.of(row));
    }

    private Map<String, Object> chapter(String anchorType, String anchorLabel, int version, String... templateIds) {
        StringBuilder pages = new StringBuilder("[");
        for (int i = 0; i < templateIds.length; i++) {
            if (i > 0) pages.append(",");
            pages.append("{\"templateId\":\"").append(templateIds[i]).append("\",\"blocks\":[]}");
        }
        pages.append("]");
        Map<String, Object> row = new HashMap<>();
        row.put("anchor_type", anchorType);
        row.put("anchor_label", anchorLabel);
        row.put("layout_data", "{\"version\":" + version + ",\"pages\":" + pages + "}");
        return row;
    }

    private void stubChapters(Map<String, Object>... rows) {
        when(jdbc.queryForList(contains("storybook_chapters"), eq(BOOK_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(rows));
    }

    // ── not found ────────────────────────────────────────────────────────────────

    @Test
    void getByToken_unknownToken_throwsNotFound() {
        when(jdbc.queryForList(contains("book_share_tokens"), eq(TOKEN))).thenReturn(List.of());
        assertThrows(PublicBookService.NotFoundException.class, () -> service().getByToken(TOKEN));
    }

    // ── scoping: include only what present pages need ──────────────────────────────

    @Test
    void getByToken_includesPageDataOnlyForPresentTemplates() {
        stubBook(null, "2026-03-02");
        stubChapters(
            chapter("guided", "The Beginning", 2, "birth_day"),
            chapter("guided", "Your People", 2, "people"),
            chapter("guided", "How You Grew", 2, "milestones")
        );
        when(birthDetailsService.getByProfileId(PROFILE_ID)).thenReturn(BirthDetails.empty());
        when(familyMemberService.findByProfileId(PROFILE_ID)).thenReturn(List.of(
            new FamilyMember(1L, PROFILE_ID, "Grandma", "Grandmother", "grandparent", null, null, 0, null)));
        when(milestoneService.getAchievedByProfileId(PROFILE_ID)).thenReturn(List.of(Map.of("key", "0-0", "achievedAt", "2026-04-01")));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals("Lily", res.babyName());              // first name only
        assertEquals("midnight", res.theme());
        assertEquals(3, res.chapters().size());
        assertNotNull(res.pageData().birthDetails());
        assertNotNull(res.pageData().familyMembers());
        assertNotNull(res.pageData().milestonesAchieved());
        assertEquals("2026-03-02", res.pageData().birthdate());   // birth_day page present
        assertEquals("Lily", res.pageData().babyName());
    }

    @Test
    void getByToken_omitsPageDataWhenNoTemplateNeedsIt() {
        stubBook(null, "2026-03-02");
        stubChapters(chapter("guided", "A Letter", 2, "letter"));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertNull(res.pageData().birthDetails());
        assertNull(res.pageData().familyMembers());
        assertNull(res.pageData().milestonesAchieved());
        assertNull(res.pageData().birthdate());              // no birth_day page → birthdate withheld
        verifyNoInteractions(birthDetailsService, familyMemberService, milestoneService);
    }

    // ── v2-only filtering ──────────────────────────────────────────────────────────

    @Test
    void getByToken_skipsNonV2Chapters() {
        stubBook(null, null);
        stubChapters(
            chapter("guided", "Classic", 1, "letter"),   // v1 → skipped
            chapter("guided", "Modern", 2, "gallery")
        );

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals(1, res.chapters().size());
        assertEquals("Modern", res.chapters().get(0).anchorLabel());
    }

    @Test
    void getByToken_noQualifyingChapters_returnsEmptyChapters() {
        stubBook(null, null);
        stubChapters(chapter("guided", "Classic", 1, "letter"));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertTrue(res.chapters().isEmpty());
    }

    // ── cover subtitle baking ───────────────────────────────────────────────────────

    @Test
    void cover_bakesBornSubtitleFromBirthdate() {
        stubBook(null, "2026-03-02");
        stubChapters(chapter("guided", "A Letter", 2, "letter"));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals("Lily's Memory Book", res.cover().title());
        assertEquals("A memory book · Born March 2, 2026", res.cover().subtitle());
    }

    @Test
    void cover_customSubtitleWins() {
        stubBook("Our little miracle", "2026-03-02");
        stubChapters(chapter("guided", "A Letter", 2, "letter"));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals("Our little miracle", res.cover().subtitle());
    }

    @Test
    void cover_genericSubtitleWhenNoBirthdate() {
        stubBook(null, null);
        stubChapters(chapter("guided", "A Letter", 2, "letter"));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals("A memory book", res.cover().subtitle());
    }
}
