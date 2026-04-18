package com.gotcherapp.api.baby;

import com.gotcherapp.api.baby.dto.BabyProfileRequest;
import com.gotcherapp.api.baby.dto.BabyProfileResponse;
import com.gotcherapp.api.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BabyProfileControllerTest {

    @Mock BabyProfileService babyProfileService;
    @InjectMocks BabyProfileController babyProfileController;

    private static final Long USER_ID    = 1L;
    private static final String EMAIL    = "test@example.com";
    private static final Long PROFILE_ID = 42L;
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(USER_ID, EMAIL);

    private static final BabyProfileResponse PROFILE = new BabyProfileResponse(
        PROFILE_ID, "Lily", "2025-06-01", "Jane", "555-0100", null
    );

    // ── GET /baby-profile ─────────────────────────────────────────────────────

    @Test
    void getProfile_returns200_whenProfileExists() {
        when(babyProfileService.getProfile(USER_ID)).thenReturn(Optional.of(PROFILE));

        var result = babyProfileController.getProfile(PRINCIPAL);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(PROFILE, result.getBody());
    }

    @Test
    void getProfile_returns404_whenNoProfile() {
        when(babyProfileService.getProfile(USER_ID)).thenReturn(Optional.empty());

        var result = babyProfileController.getProfile(PRINCIPAL);

        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
    }

    // ── PUT /baby-profile ─────────────────────────────────────────────────────

    @Test
    void upsertProfile_returns200_withSavedProfile() {
        when(babyProfileService.upsert(eq(USER_ID), any())).thenReturn(PROFILE);
        var req = new BabyProfileRequest("Lily", "2025-06-01", "Jane", "555-0100", null);

        var result = babyProfileController.upsertProfile(PRINCIPAL, req);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(PROFILE, result.getBody());
    }

    @Test
    void upsertProfile_delegatesToService() {
        when(babyProfileService.upsert(eq(USER_ID), any())).thenReturn(PROFILE);
        var req = new BabyProfileRequest("Lily", "2025-06-01", "Jane", "555-0100", null);

        babyProfileController.upsertProfile(PRINCIPAL, req);

        verify(babyProfileService).upsert(USER_ID, req);
    }
}
