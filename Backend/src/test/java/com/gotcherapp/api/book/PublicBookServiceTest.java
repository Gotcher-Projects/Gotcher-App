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

/** Share s13e-2 — content-based public visibility (freeform: all pages; guided: filled only) + finished flag. */
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

    // ── JSON builders (valid layout_data fragments) ──────────────────────────────

    private static String textBlock(String text) {
        return "{\"type\":\"text\",\"content\":{\"type\":\"doc\",\"content\":" +
            "[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"" + text + "\"}]}]}}";
    }
    private static final String EMPTY_TEXT =
        "{\"type\":\"text\",\"content\":{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}}";

    private static String page(String templateId, String... blocks) {
        return "{\"templateId\":\"" + templateId + "\",\"blocks\":[" + String.join(",", blocks) + "]}";
    }
    private static String layout(String... pages) {
        return "{\"version\":2,\"pages\":[" + String.join(",", pages) + "]}";
    }

    private Map<String, Object> chapterRow(String anchorType, String anchorLabel, String layoutJson) {
        Map<String, Object> row = new HashMap<>();
        row.put("anchor_type", anchorType);
        row.put("anchor_label", anchorLabel);
        row.put("layout_data", layoutJson);
        return row;
    }

    private void stubBook(String type, boolean finished, String coverSubtitle, String birthdate) {
        Map<String, Object> row = new HashMap<>();
        row.put("book_id", BOOK_ID);
        row.put("baby_profile_id", PROFILE_ID);
        row.put("type", type);
        row.put("theme", "midnight");
        row.put("cover_photo_url", null);
        row.put("cover_subtitle", coverSubtitle);
        row.put("finished", finished);
        row.put("baby_name", "Lily Rose");
        row.put("birthdate", birthdate);
        when(jdbc.queryForList(contains("book_share_tokens"), eq(TOKEN))).thenReturn(List.of(row));
    }

    @SafeVarargs
    private final void stubChapters(Map<String, Object>... rows) {
        when(jdbc.queryForList(contains("storybook_chapters"), eq(BOOK_ID), eq(PROFILE_ID)))
            .thenReturn(List.of(rows));
    }

    private static int totalPages(PublicBookResponse res) {
        return res.chapters().stream().mapToInt(c -> c.pages().size()).sum();
    }

    // ── not found ────────────────────────────────────────────────────────────────

    @Test
    void unknownToken_throwsNotFound() {
        when(jdbc.queryForList(contains("book_share_tokens"), eq(TOKEN))).thenReturn(List.of());
        assertThrows(PublicBookService.NotFoundException.class, () -> service().getByToken(TOKEN));
    }

    // ── freeform: show ALL pages ──────────────────────────────────────────────────

    @Test
    void freeform_showsAllPages_evenPartlyEmpty() {
        stubBook("freeform", false, null, null);
        // one freeform chapter, three pages: filled, empty, filled
        stubChapters(chapterRow("freeform", "Pages",
            layout(page("gallery", textBlock("hello")), page("gallery", EMPTY_TEXT), page("gallery", textBlock("world")))));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals("freeform", res.type());
        assertFalse(res.finished());
        assertEquals(1, res.chapters().size());
        assertEquals(3, totalPages(res));   // all pages, including the empty middle one
    }

    @Test
    void freeform_allEmpty_returnsEmptyChapters() {
        stubBook("freeform", false, null, null);
        stubChapters(chapterRow("freeform", "Pages", layout(page("gallery", EMPTY_TEXT), page("gallery"))));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertTrue(res.chapters().isEmpty());   // nothing filled → "still being written"
    }

    // ── guided: filled pages only ─────────────────────────────────────────────────

    @Test
    void guided_showsOnlyFilledPages() {
        stubBook("guided", false, null, null);
        stubChapters(
            chapterRow("guided", "A Letter", layout(page("letter", textBlock("Dear Lily")))),  // filled
            chapterRow("guided", "Empty Letter", layout(page("letter", EMPTY_TEXT)))            // empty → skipped
        );

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals(1, res.chapters().size());
        assertEquals("A Letter", res.chapters().get(0).anchorLabel());
    }

    @Test
    void guided_dataDrivenPages_includedByTheirData() {
        stubBook("guided", false, null, "2026-03-02");
        // data-driven pages carry only a placeholder — they're "filled" iff the underlying data exists.
        stubChapters(
            chapterRow("guided", "Birth Day", layout(page("birth_day", EMPTY_TEXT))),
            chapterRow("guided", "Your People", layout(page("people", EMPTY_TEXT))),
            chapterRow("guided", "Milestones", layout(page("milestones", EMPTY_TEXT)))
        );
        when(birthDetailsService.getByProfileId(PROFILE_ID)).thenReturn(
            new BirthDetails(1L, PROFILE_ID, null, "St. Mary's", null, null, null, null, null, null));
        when(familyMemberService.findByProfileId(PROFILE_ID)).thenReturn(List.of(
            new FamilyMember(1L, PROFILE_ID, "Grandma", "Grandmother", "grandparent", null, null, 0, null)));
        when(milestoneService.getAchievedByProfileId(PROFILE_ID)).thenReturn(
            List.of(Map.of("key", "0-0", "achievedAt", "2026-04-01")));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals(3, res.chapters().size());
        assertNotNull(res.pageData().birthDetails());
        assertNotNull(res.pageData().familyMembers());
        assertNotNull(res.pageData().milestonesAchieved());
        assertEquals("2026-03-02", res.pageData().birthdate());  // sent because a birth_day page shows
    }

    @Test
    void guided_dataDrivenPages_excludedWhenNoData() {
        stubBook("guided", false, null, "2026-03-02");
        stubChapters(chapterRow("guided", "Birth Day", layout(page("birth_day", EMPTY_TEXT))));
        when(birthDetailsService.getByProfileId(PROFILE_ID)).thenReturn(BirthDetails.empty());

        PublicBookResponse res = service().getByToken(TOKEN);

        assertTrue(res.chapters().isEmpty());
        assertNull(res.pageData().birthDetails());
        assertNull(res.pageData().birthdate());   // no birth_day page shown → withheld
    }

    // ── guided: dividers only when their section has a filled page ─────────────────

    @Test
    void guided_divider_shownOnlyWithFollowingContent() {
        stubBook("guided", false, null, null);
        stubChapters(
            chapterRow("guided", "The Party", layout(page("chapter_divider", textBlock("The Party")))),
            chapterRow("guided", "A Letter", layout(page("letter", textBlock("filled")))),   // section has content
            chapterRow("guided", "One Year", layout(page("chapter_divider", textBlock("One Year")))),
            chapterRow("guided", "Empty", layout(page("letter", EMPTY_TEXT)))                 // orphan divider → dropped
        );

        PublicBookResponse res = service().getByToken(TOKEN);

        // "The Party" divider + its letter show; the "One Year" divider (no filled page after it) is dropped.
        assertEquals(2, res.chapters().size());
        assertEquals("The Party", res.chapters().get(0).anchorLabel());
        assertEquals("A Letter", res.chapters().get(1).anchorLabel());
    }

    // ── finished flag + scoping ────────────────────────────────────────────────────

    @Test
    void finished_flagReflectsBook() {
        stubBook("guided", true, null, null);
        stubChapters(chapterRow("guided", "A Letter", layout(page("letter", textBlock("hi")))));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertTrue(res.finished());
        assertEquals("Lily", res.babyName());   // first name only
    }

    @Test
    void pageData_scoped_noFamilyWhenNoPeoplePage() {
        stubBook("guided", false, null, null);
        stubChapters(chapterRow("guided", "A Letter", layout(page("letter", textBlock("hi")))));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertNull(res.pageData().familyMembers());
        assertNull(res.pageData().milestonesAchieved());
        assertNull(res.pageData().birthDetails());
        // the data services are queried (needed for filled-checks) but nothing is exposed unless a page shows it
        verify(familyMemberService).findByProfileId(PROFILE_ID);
    }

    // ── cover subtitle baking (unchanged behavior) ──────────────────────────────────

    @Test
    void cover_bakesBornSubtitleFromBirthdate() {
        stubBook("guided", false, null, "2026-03-02");
        stubChapters(chapterRow("guided", "A Letter", layout(page("letter", textBlock("hi")))));

        PublicBookResponse res = service().getByToken(TOKEN);

        assertEquals("Lily's Memory Book", res.cover().title());
        assertEquals("A memory book · Born March 2, 2026", res.cover().subtitle());
    }

    @Test
    void cover_customSubtitleWins() {
        stubBook("guided", false, "Our little miracle", "2026-03-02");
        stubChapters(chapterRow("guided", "A Letter", layout(page("letter", textBlock("hi")))));

        assertEquals("Our little miracle", service().getByToken(TOKEN).cover().subtitle());
    }
}
