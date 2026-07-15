package com.gotcherapp.api.book.dto;

/**
 * Response of the /books/{bookId}/share endpoints (Share s13a).
 * When no token exists (GET on a book that was never shared), both fields are null.
 */
public record ShareResponse(String token, String shareUrl) {}
