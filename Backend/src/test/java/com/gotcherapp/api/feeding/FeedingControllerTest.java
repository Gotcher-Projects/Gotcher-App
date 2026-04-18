package com.gotcherapp.api.feeding;

import com.gotcherapp.api.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedingControllerTest {

    @Mock FeedingService feedingService;
    @InjectMocks FeedingController feedingController;

    private static final Long USER_ID = 1L;
    private static final Long LOG_ID  = 7L;
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(USER_ID, "test@example.com");

    private static final FeedingLog LOG = new FeedingLog(
        LOG_ID, "breast_left", "2026-03-27T10:00:00Z", null, null, null
    );

    // ── GET /feeding ──────────────────────────────────────────────────────────

    @Test
    void getLogs_returns200_withList() {
        when(feedingService.getLogs(USER_ID, 7)).thenReturn(List.of(LOG));

        var result = feedingController.getLogs(PRINCIPAL, 7);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(1, result.getBody().size());
    }

    @Test
    void getLogs_returns200_withEmptyList_whenNoProfile() {
        when(feedingService.getLogs(USER_ID, 7)).thenReturn(List.of());

        var result = feedingController.getLogs(PRINCIPAL, 7);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertTrue(result.getBody().isEmpty());
    }

    // ── POST /feeding ─────────────────────────────────────────────────────────

    @Test
    void startFeed_returns201_onSuccess() {
        when(feedingService.startFeed(eq(USER_ID), any())).thenReturn(LOG);
        var req = new StartFeedRequest("breast_left", null);

        var result = feedingController.startFeed(PRINCIPAL, req);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(LOG, result.getBody());
    }

    @Test
    void startFeed_returns400_whenNoProfile() {
        when(feedingService.startFeed(eq(USER_ID), any()))
            .thenThrow(new IllegalStateException("No baby profile found"));
        var req = new StartFeedRequest("breast_left", null);

        var result = feedingController.startFeed(PRINCIPAL, req);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
    }

    @Test
    void startFeed_returns400_whenInvalidType() {
        when(feedingService.startFeed(eq(USER_ID), any()))
            .thenThrow(new IllegalArgumentException("Invalid feed type: coffee"));
        var req = new StartFeedRequest("coffee", null);

        var result = feedingController.startFeed(PRINCIPAL, req);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
    }

    // ── PATCH /feeding/{id} ───────────────────────────────────────────────────

    @Test
    void stopFeed_returns200_onSuccess() {
        FeedingLog completed = new FeedingLog(LOG_ID, "breast_left", "2026-03-27T10:00:00Z", "2026-03-27T10:20:00Z", null, null);
        when(feedingService.stopFeed(eq(USER_ID), eq(LOG_ID), any())).thenReturn(Optional.of(completed));
        var req = new StopFeedRequest("2026-03-27T10:20:00Z", null, null);

        var result = feedingController.stopFeed(PRINCIPAL, LOG_ID, req);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void stopFeed_returns404_whenLogNotFound() {
        when(feedingService.stopFeed(eq(USER_ID), eq(LOG_ID), any())).thenReturn(Optional.empty());
        var req = new StopFeedRequest(null, null, null);

        var result = feedingController.stopFeed(PRINCIPAL, LOG_ID, req);

        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
    }

    // ── DELETE /feeding/{id} ──────────────────────────────────────────────────

    @Test
    void deleteFeed_returns204_onSuccess() {
        when(feedingService.deleteFeed(USER_ID, LOG_ID)).thenReturn(true);

        var result = feedingController.deleteFeed(PRINCIPAL, LOG_ID);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
    }

    @Test
    void deleteFeed_returns404_whenNotFound() {
        when(feedingService.deleteFeed(USER_ID, LOG_ID)).thenReturn(false);

        var result = feedingController.deleteFeed(PRINCIPAL, LOG_ID);

        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
    }
}
