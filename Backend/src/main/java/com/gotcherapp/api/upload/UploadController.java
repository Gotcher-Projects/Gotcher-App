package com.gotcherapp.api.upload;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/upload")
public class UploadController {

    private final ImageUploadService imageUploadService;

    public UploadController(ImageUploadService imageUploadService) {
        this.imageUploadService = imageUploadService;
    }

    @PostMapping
    public ResponseEntity<?> upload(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "context", defaultValue = "misc") String context) {
        if (file.isEmpty()) {
            return ApiError.badRequest("No file provided");
        }
        String folder = switch (context) {
            case "journal"     -> "journal";
            case "marketplace" -> "marketplace";
            default            -> "misc";
        };
        try {
            String url = imageUploadService.upload(file, folder, principal.userId());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (Exception e) {
            return ApiError.serverError("Upload failed: " + e.getMessage());
        }
    }
}
