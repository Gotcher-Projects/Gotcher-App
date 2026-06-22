package com.gotcherapp.api.bump;

import com.gotcherapp.api.bump.dto.CreateBumpPhotoRequest;
import com.gotcherapp.api.bump.dto.UpdateBumpPhotoRequest;
import com.gotcherapp.api.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Maps BumpPhotoService outcomes to HTTP status codes. Service fully mocked.
 */
@ExtendWith(MockitoExtension.class)
class BumpPhotoControllerTest {

    @Mock BumpPhotoService service;
    @InjectMocks BumpPhotoController controller;

    private static final Long USER_ID = 1L;
    private static final Long BP_ID   = 10L;
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(USER_ID, "test@example.com");

    private static final BumpPhoto SAMPLE = new BumpPhoto(
        BP_ID, 99L, 20, "https://img/bump.jpg", "kicks!", "2026-05-01", "portrait", "2026-05-01T00:00:00Z");

    // ── GET /bump-photos ──────────────────────────────────────────────────────────

    @Test
    void getAll_returns200_withList() {
        when(service.findAll(USER_ID)).thenReturn(List.of(SAMPLE));
        var r = controller.getAll(PRINCIPAL);
        assertEquals(HttpStatus.OK, r.getStatusCode());
        assertEquals(1, r.getBody().size());
    }

    // ── POST /bump-photos ─────────────────────────────────────────────────────────

    @Test
    void create_returns201_onSuccess() {
        when(service.create(eq(USER_ID), any())).thenReturn(SAMPLE);
        var req = new CreateBumpPhotoRequest(20, "https://img", null, null, null);
        assertEquals(HttpStatus.CREATED, controller.create(PRINCIPAL, req).getStatusCode());
    }

    @Test
    void create_returns400_onIllegalArgument() {
        when(service.create(eq(USER_ID), any()))
            .thenThrow(new IllegalArgumentException("a photo or a note is required"));
        var req = new CreateBumpPhotoRequest(20, null, null, null, null);
        assertEquals(HttpStatus.BAD_REQUEST, controller.create(PRINCIPAL, req).getStatusCode());
    }

    @Test
    void create_returns400_onIllegalState() {
        when(service.create(eq(USER_ID), any()))
            .thenThrow(new IllegalStateException("No baby profile found"));
        var req = new CreateBumpPhotoRequest(20, "https://img", null, null, null);
        assertEquals(HttpStatus.BAD_REQUEST, controller.create(PRINCIPAL, req).getStatusCode());
    }

    // ── PATCH /bump-photos/{id} ───────────────────────────────────────────────────

    @Test
    void update_returns200_whenPresent() {
        when(service.update(eq(USER_ID), eq(BP_ID), any())).thenReturn(Optional.of(SAMPLE));
        var req = new UpdateBumpPhotoRequest(21, null, null, null, null);
        assertEquals(HttpStatus.OK, controller.update(PRINCIPAL, BP_ID, req).getStatusCode());
    }

    @Test
    void update_returns404_whenEmpty() {
        when(service.update(eq(USER_ID), eq(BP_ID), any())).thenReturn(Optional.empty());
        var req = new UpdateBumpPhotoRequest(21, null, null, null, null);
        assertEquals(HttpStatus.NOT_FOUND, controller.update(PRINCIPAL, BP_ID, req).getStatusCode());
    }

    // ── DELETE /bump-photos/{id} ──────────────────────────────────────────────────

    @Test
    void delete_returns204_whenDeleted() {
        when(service.delete(USER_ID, BP_ID)).thenReturn(true);
        assertEquals(HttpStatus.NO_CONTENT, controller.delete(PRINCIPAL, BP_ID).getStatusCode());
    }

    @Test
    void delete_returns404_whenNotFound() {
        when(service.delete(USER_ID, BP_ID)).thenReturn(false);
        assertEquals(HttpStatus.NOT_FOUND, controller.delete(PRINCIPAL, BP_ID).getStatusCode());
    }
}
