package com.gotcherapp.api.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

public record ApiError(String error) {

    public static ResponseEntity<ApiError> badRequest(String msg) {
        return ResponseEntity.badRequest().body(new ApiError(msg));
    }

    public static ResponseEntity<ApiError> unauthorized(String msg) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError(msg));
    }

    public static ResponseEntity<ApiError> forbidden(String msg) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError(msg));
    }

    public static ResponseEntity<ApiError> notFound(String msg) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(msg));
    }

    public static ResponseEntity<ApiError> conflict(String msg) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(msg));
    }

    public static ResponseEntity<ApiError> serverError(String msg) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiError(msg));
    }
}
