package com.gotcherapp.api.common;

import com.gotcherapp.api.storybook.StorybookService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.NoSuchElementException;

/**
 * App-wide safety net that maps exceptions escaping any controller to a proper {@link ApiError}
 * response. Without this, an uncaught RuntimeException re-dispatches to {@code /error}, which runs
 * unauthenticated and surfaces as a misleading 401 instead of the real status (project-wide gotcha).
 *
 * <p>This is additive: controllers that already catch and return {@link ApiError} keep doing so and
 * win — this advice only handles what they let propagate. Spring Security's own 401/403 are thrown
 * earlier in the filter chain and are not affected.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(StorybookService.ForbiddenException.class)
    public ResponseEntity<ApiError> handleForbidden(StorybookService.ForbiddenException ex) {
        return ApiError.forbidden(ex.getMessage());
    }

    @ExceptionHandler(StorybookService.InsufficientCreditsException.class)
    public ResponseEntity<ApiError> handleInsufficientCredits(StorybookService.InsufficientCreditsException ex) {
        return ResponseEntity.status(402).body(new ApiError(ex.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ApiError> handleNotFound(NoSuchElementException ex) {
        return ApiError.notFound(ex.getMessage());
    }

    @ExceptionHandler({ IllegalArgumentException.class, HttpMessageNotReadableException.class })
    public ResponseEntity<ApiError> handleBadRequest(Exception ex) {
        return ApiError.badRequest(ex.getMessage());
    }

    // A file above spring.servlet.multipart.max-file-size is rejected during multipart parsing,
    // before the controller's own size guard runs. Map it to a clean 400 with a friendly message
    // instead of letting it fall through to the 500 catch-all.
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return ApiError.badRequest("Image must be 10MB or smaller");
    }

    // Catch-all: this is the one place that sees genuinely unexpected errors (SQL, NPE, …).
    // Log the detail server-side; return a generic message so internals aren't leaked to clients.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("Unhandled exception reached the controller boundary", ex);
        return ApiError.serverError("An unexpected error occurred");
    }
}
