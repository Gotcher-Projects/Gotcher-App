package com.gotcherapp.api.baby;

import com.gotcherapp.api.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MilestoneControllerTest {

    @Mock MilestoneService milestoneService;
    @InjectMocks MilestoneController milestoneController;

    private static final Long USER_ID = 1L;
    private static final String EMAIL = "test@example.com";
    private static final String KEY   = "4-1";
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(USER_ID, EMAIL);

    // ── GET /milestones ───────────────────────────────────────────────────────

    @Test
    void getAll_returns200_withKeys() {
        when(milestoneService.getKeys(USER_ID)).thenReturn(List.of("4-0", "4-1"));

        var result = milestoneController.getAll(PRINCIPAL);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        @SuppressWarnings("unchecked")
        var body = (Map<String, Object>) result.getBody();
        assertNotNull(body);
        assertEquals(List.of("4-0", "4-1"), body.get("keys"));
    }

    @Test
    void getAll_returns200_withEmptyList_whenNoProfile() {
        when(milestoneService.getKeys(USER_ID)).thenReturn(List.of());

        var result = milestoneController.getAll(PRINCIPAL);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        @SuppressWarnings("unchecked")
        var body = (Map<String, Object>) result.getBody();
        assertNotNull(body);
        assertEquals(List.of(), body.get("keys"));
    }

    // ── POST /milestones/{key} ────────────────────────────────────────────────

    @Test
    void achieve_returns200_onSuccess() {
        var result = milestoneController.achieve(PRINCIPAL, KEY);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        @SuppressWarnings("unchecked")
        var body = (Map<String, Object>) result.getBody();
        assertNotNull(body);
        assertEquals(KEY, body.get("key"));
    }

    @Test
    void achieve_returns400_whenNoProfile() {
        doThrow(new IllegalStateException("No baby profile found. Save a baby profile first."))
            .when(milestoneService).achieve(USER_ID, KEY);

        var result = milestoneController.achieve(PRINCIPAL, KEY);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
    }

    @Test
    void achieve_isIdempotent_returnsOk_onDuplicate() {
        // ON CONFLICT DO NOTHING — service does not throw on duplicate
        doNothing().when(milestoneService).achieve(USER_ID, KEY);

        var result = milestoneController.achieve(PRINCIPAL, KEY);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    // ── DELETE /milestones/{key} ──────────────────────────────────────────────

    @Test
    void unachieve_returns204_onSuccess() {
        var result = milestoneController.unachieve(PRINCIPAL, KEY);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(milestoneService).unachieve(USER_ID, KEY);
    }

    @Test
    void unachieve_returns204_evenWhenNoProfile() {
        // unachieve is a no-op when no profile — service doesn't throw
        doNothing().when(milestoneService).unachieve(USER_ID, KEY);

        var result = milestoneController.unachieve(PRINCIPAL, KEY);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
    }
}
