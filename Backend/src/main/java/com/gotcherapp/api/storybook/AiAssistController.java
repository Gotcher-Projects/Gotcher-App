package com.gotcherapp.api.storybook;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import com.gotcherapp.api.storybook.dto.AssistFieldRequest;
import com.gotcherapp.api.storybook.dto.AssistFieldResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// Per-field AI assist endpoint (sv2-s10). Cross-feature (not chapter-scoped), so it lives in its own
// controller rather than StorybookController. Auth is covered by SecurityConfig's anyRequest().authenticated().
@RestController
public class AiAssistController {

    private final AiAssistService aiAssistService;

    public AiAssistController(AiAssistService aiAssistService) {
        this.aiAssistService = aiAssistService;
    }

    @PostMapping("/storybook/assist-field")
    public ResponseEntity<?> assistField(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody AssistFieldRequest req
    ) {
        try {
            String text = aiAssistService.assistField(principal.userId(), req);
            return ResponseEntity.ok(new AssistFieldResponse(text));
        } catch (StorybookService.InsufficientCreditsException e) {
            // 402 → the frontend shows the "get more credits" path (no credits left).
            return ResponseEntity.status(402).body(new ApiError(e.getMessage()));
        } catch (AiAssistService.AssistUnavailableException e) {
            // 422 → the model returned nothing usable (empty / refusal). Credit already refunded;
            // the frontend shows this message and offers no draft to accept.
            return ResponseEntity.status(422).body(new ApiError(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        } catch (Exception e) {
            // Catch Exception (not just IOException): an uncaught RuntimeException here would
            // re-dispatch to /error unauthenticated and surface as 401 instead of 500 (see CLAUDE.md).
            return ApiError.serverError(e.getMessage());
        }
    }
}
