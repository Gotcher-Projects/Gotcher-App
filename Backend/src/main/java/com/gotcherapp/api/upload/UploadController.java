package com.gotcherapp.api.upload;

import com.gotcherapp.api.common.ApiError;
import com.gotcherapp.api.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
        String validationError = ImageUploadService.imageValidationError(file);
        if (validationError != null) {
            return ApiError.badRequest(validationError);
        }
        String folder = UploadFolder.fromContext(context).folderName();
        try {
            String url = imageUploadService.upload(file, folder, principal.userId());
            return ResponseEntity.ok(Map.of("url", url));
        } catch (Exception e) {
            return ApiError.serverError("Upload failed: " + e.getMessage());
        }
    }
}
