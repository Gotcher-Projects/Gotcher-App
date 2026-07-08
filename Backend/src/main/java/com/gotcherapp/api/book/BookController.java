package com.gotcherapp.api.book;

import com.gotcherapp.api.book.dto.CreateBookRequest;
import com.gotcherapp.api.book.dto.UpdateBookRequest;
import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import com.gotcherapp.api.upload.ImageUploadService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

@RestController
@RequestMapping("/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    @GetMapping
    public ResponseEntity<List<Book>> list(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(bookService.list(principal.userId()));
    }

    @PostMapping
    public ResponseEntity<?> create(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody CreateBookRequest req
    ) {
        try {
            Book book = bookService.create(principal.userId(), req);
            return ResponseEntity.status(201).body(book);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestBody UpdateBookRequest req
    ) {
        try {
            Optional<Book> updated = bookService.update(principal.userId(), id, req);
            if (updated.isEmpty()) return ApiError.notFound("Book not found");
            return ResponseEntity.ok(updated.get());
        } catch (IllegalArgumentException e) {
            return ApiError.badRequest(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    @PostMapping("/{id}/cover-photo")
    public ResponseEntity<?> uploadCoverPhoto(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file
    ) {
        String validationError = ImageUploadService.imageValidationError(file);
        if (validationError != null) return ApiError.badRequest(validationError);
        try {
            String url = bookService.uploadCoverPhoto(principal.userId(), id, file);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (NoSuchElementException e) {
            return ApiError.notFound(e.getMessage());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<?> duplicate(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        try {
            Optional<Book> copy = bookService.duplicate(principal.userId(), id);
            if (copy.isEmpty()) return ApiError.notFound("Book not found");
            return ResponseEntity.status(201).body(copy.get());
        } catch (Exception e) {
            return ApiError.serverError(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable Long id
    ) {
        boolean deleted = bookService.delete(principal.userId(), id);
        if (!deleted) return ApiError.notFound("Book not found");
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/order")
    public ResponseEntity<?> reorder(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        List<Number> rawIds = (List<Number>) body.get("orderedIds");
        if (rawIds == null || rawIds.isEmpty()) return ApiError.badRequest("orderedIds is required");
        List<Long> orderedIds = rawIds.stream().map(Number::longValue).toList();
        bookService.reorder(principal.userId(), orderedIds);
        return ResponseEntity.noContent().build();
    }
}
