package com.gotcherapp.api.growth;

import com.gotcherapp.api.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GrowthControllerTest {

    @Mock GrowthService growthService;
    @InjectMocks GrowthController growthController;

    private static final Long USER_ID    = 1L;
    private static final Long RECORD_ID  = 10L;
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(USER_ID, "test@example.com");

    private static final GrowthRecord RECORD = new GrowthRecord(
        RECORD_ID, "2026-01-15", new BigDecimal("12.50"), new BigDecimal("21.5"), null, null
    );

    // ── GET /growth ───────────────────────────────────────────────────────────

    @Test
    void getRecords_returns200_withList() {
        when(growthService.getRecords(USER_ID)).thenReturn(List.of(RECORD));

        var result = growthController.getRecords(PRINCIPAL);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(1, result.getBody().size());
    }

    @Test
    void getRecords_returns200_withEmptyList_whenNoProfile() {
        when(growthService.getRecords(USER_ID)).thenReturn(List.of());

        var result = growthController.getRecords(PRINCIPAL);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertTrue(result.getBody().isEmpty());
    }

    // ── POST /growth ──────────────────────────────────────────────────────────

    @Test
    void addRecord_returns201_onSuccess() {
        when(growthService.addRecord(eq(USER_ID), any())).thenReturn(RECORD);
        var req = new GrowthRequest("2026-01-15", new BigDecimal("12.50"), null, null, null);

        var result = growthController.addRecord(PRINCIPAL, req);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(RECORD, result.getBody());
    }

    @Test
    void addRecord_returns400_whenNoProfile() {
        when(growthService.addRecord(eq(USER_ID), any()))
            .thenThrow(new IllegalStateException("No baby profile found"));
        var req = new GrowthRequest("2026-01-15", null, null, null, null);

        var result = growthController.addRecord(PRINCIPAL, req);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
    }

    @Test
    void addRecord_returns400_whenDateMissing() {
        when(growthService.addRecord(eq(USER_ID), any()))
            .thenThrow(new IllegalArgumentException("recordedDate is required"));
        var req = new GrowthRequest(null, null, null, null, null);

        var result = growthController.addRecord(PRINCIPAL, req);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
    }

    // ── DELETE /growth/{id} ───────────────────────────────────────────────────

    @Test
    void deleteRecord_returns204_onSuccess() {
        when(growthService.deleteRecord(USER_ID, RECORD_ID)).thenReturn(true);

        var result = growthController.deleteRecord(PRINCIPAL, RECORD_ID);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
    }

    @Test
    void deleteRecord_returns404_whenNotFound() {
        when(growthService.deleteRecord(USER_ID, RECORD_ID)).thenReturn(false);

        var result = growthController.deleteRecord(PRINCIPAL, RECORD_ID);

        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
    }
}
