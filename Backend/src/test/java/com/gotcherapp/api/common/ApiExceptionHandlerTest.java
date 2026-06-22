package com.gotcherapp.api.common;

import com.gotcherapp.api.storybook.StorybookService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.NoSuchElementException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies the global advice maps each exception type to the expected HTTP status, and that the
 * catch-all does not leak internal exception messages to the client.
 */
class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void forbidden_maps403() {
        ResponseEntity<ApiError> r = handler.handleForbidden(
            new StorybookService.ForbiddenException("nope"));
        assertEquals(HttpStatus.FORBIDDEN, r.getStatusCode());
        assertEquals("nope", r.getBody().error());
    }

    @Test
    void insufficientCredits_maps402() {
        ResponseEntity<ApiError> r = handler.handleInsufficientCredits(
            new StorybookService.InsufficientCreditsException("broke"));
        assertEquals(HttpStatus.PAYMENT_REQUIRED, r.getStatusCode());
        assertEquals("broke", r.getBody().error());
    }

    @Test
    void noSuchElement_maps404() {
        ResponseEntity<ApiError> r = handler.handleNotFound(new NoSuchElementException("missing"));
        assertEquals(HttpStatus.NOT_FOUND, r.getStatusCode());
    }

    @Test
    void illegalArgument_maps400() {
        ResponseEntity<ApiError> r = handler.handleBadRequest(new IllegalArgumentException("bad"));
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        assertEquals("bad", r.getBody().error());
    }

    @Test
    void malformedBody_maps400() {
        ResponseEntity<ApiError> r = handler.handleBadRequest(
            new HttpMessageNotReadableException("unreadable"));
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
    }

    @Test
    void maxUploadSize_maps400_withFriendlyMessage() {
        ResponseEntity<ApiError> r = handler.handleMaxUploadSize(
            new MaxUploadSizeExceededException(10L * 1024 * 1024));
        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        assertEquals("Image must be 10MB or smaller", r.getBody().error());
    }

    @Test
    void unexpected_maps500_andHidesInternalMessage() {
        ResponseEntity<ApiError> r = handler.handleUnexpected(
            new RuntimeException("SQLSTATE 42P01: relation does not exist"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, r.getStatusCode());
        assertEquals("An unexpected error occurred", r.getBody().error());
        assertFalse(r.getBody().error().contains("SQLSTATE"));
    }
}
