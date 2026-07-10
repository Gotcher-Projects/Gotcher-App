package com.gotcherapp.api.storybook;

import com.gotcherapp.api.storybook.dto.AssistFieldRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Coverage for the per-field AI assist (sv2-s10): the credit gate (purely balance-based, no tier),
 * the atomic 1-credit charge, the charge-then-refund-on-failure path, and promptType validation.
 * Claude + DB are mocked.
 */
@ExtendWith(MockitoExtension.class)
class AiAssistServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock ClaudeClient claudeClient;
    @InjectMocks AiAssistService service;

    private static final Long USER_ID = 1L;

    private AssistFieldRequest req() {
        return new AssistFieldRequest("letter", Map.of("babyName", "Lily", "parentName", "Sam"));
    }

    @Test
    void unknownPromptType_throwsIllegalArgument_beforeAnyChargeOrCall() {
        var bad = new AssistFieldRequest("not_a_type", Map.of());
        assertThrows(IllegalArgumentException.class, () -> service.assistField(USER_ID, bad));
        verifyNoInteractions(jdbc);
        verify(claudeClient, never()).generateText(anyString(), anyString(), anyInt());
    }

    @Test
    void nullPromptType_throwsIllegalArgument() {
        var bad = new AssistFieldRequest(null, Map.of());
        assertThrows(IllegalArgumentException.class, () -> service.assistField(USER_ID, bad));
    }

    @Test
    void notConfigured_throwsIllegalState() {
        when(claudeClient.isConfigured()).thenReturn(false);
        assertThrows(IllegalStateException.class, () -> service.assistField(USER_ID, req()));
        verifyNoInteractions(jdbc);
    }

    @Test
    void insufficientCredits_whenChargeAffectsZeroRows() {
        when(claudeClient.isConfigured()).thenReturn(true);
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining - 1"), eq(USER_ID)))
            .thenReturn(0);

        assertThrows(StorybookService.InsufficientCreditsException.class,
            () -> service.assistField(USER_ID, req()));
        verify(claudeClient, never()).generateText(anyString(), anyString(), anyInt());
    }

    @Test
    void happyPath_chargesOneCredit_andReturnsTrimmedText() {
        when(claudeClient.isConfigured()).thenReturn(true);
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining - 1"), eq(USER_ID)))
            .thenReturn(1);
        when(claudeClient.generateText(anyString(), anyString(), anyInt()))
            .thenReturn("  Dear Lily,\n\nWelcome.  ");

        String text = service.assistField(USER_ID, req());

        assertEquals("Dear Lily,\n\nWelcome.", text);
        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining - 1"), eq(USER_ID));
        // Success → no refund.
        verify(jdbc, never()).update(contains("ai_credits_remaining = ai_credits_remaining + 1"), eq(USER_ID));
    }

    @Test
    void refundsCredit_whenClaudeFails() {
        when(claudeClient.isConfigured()).thenReturn(true);
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining - 1"), eq(USER_ID)))
            .thenReturn(1);
        when(claudeClient.generateText(anyString(), anyString(), anyInt()))
            .thenThrow(new RuntimeException("Claude API timeout"));

        assertThrows(RuntimeException.class, () -> service.assistField(USER_ID, req()));
        // The credit charged up front is returned.
        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining + 1"), eq(USER_ID));
    }

    @Test
    void refundsCredit_andThrows_whenModelRefuses() {
        when(claudeClient.isConfigured()).thenReturn(true);
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining - 1"), eq(USER_ID)))
            .thenReturn(1);
        when(claudeClient.generateText(anyString(), anyString(), anyInt()))
            .thenReturn("I can't write this for a parent without a note to work from.");

        assertThrows(AiAssistService.AssistUnavailableException.class,
            () -> service.assistField(USER_ID, req()));
        // A refusal is not a real draft → the charged credit is refunded.
        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining + 1"), eq(USER_ID));
    }

    @Test
    void refundsCredit_andThrows_whenModelReturnsEmpty() {
        when(claudeClient.isConfigured()).thenReturn(true);
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining - 1"), eq(USER_ID)))
            .thenReturn(1);
        when(claudeClient.generateText(anyString(), anyString(), anyInt())).thenReturn("   ");

        assertThrows(AiAssistService.AssistUnavailableException.class,
            () -> service.assistField(USER_ID, req()));
        verify(jdbc).update(contains("ai_credits_remaining = ai_credits_remaining + 1"), eq(USER_ID));
    }

    @Test
    void allowsValidLetterOpening_notFlaggedAsRefusal() {
        // "I can't wait" must NOT be treated as a refusal — it's a valid heartfelt line.
        when(claudeClient.isConfigured()).thenReturn(true);
        when(jdbc.update(contains("ai_credits_remaining = ai_credits_remaining - 1"), eq(USER_ID)))
            .thenReturn(1);
        when(claudeClient.generateText(anyString(), anyString(), anyInt()))
            .thenReturn("I can't wait to watch you grow, my darling Lily.");

        String text = service.assistField(USER_ID, req());

        assertEquals("I can't wait to watch you grow, my darling Lily.", text);
        verify(jdbc, never()).update(contains("ai_credits_remaining = ai_credits_remaining + 1"), eq(USER_ID));
    }
}
