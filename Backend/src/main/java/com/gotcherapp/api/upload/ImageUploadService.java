package com.gotcherapp.api.upload;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ImageUploadService {

    private static final Logger log = LoggerFactory.getLogger(ImageUploadService.class);

    private final Cloudinary cloudinary;

    // Keep in sync with spring.servlet.multipart.max-file-size in application.properties. The
    // multipart limit rejects oversize files at parse time (handled as a 400 by ApiExceptionHandler);
    // this explicit guard catches them earlier with the same friendly message at the controllers.
    public static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024;

    public ImageUploadService(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    /**
     * Validates an uploaded file is a non-empty, in-size-limit image. Returns a client-facing error
     * message when the file should be rejected with a 400, or {@code null} when it's acceptable.
     * Shared by every upload controller so the rules can't drift between surfaces.
     */
    public static String imageValidationError(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return "No file provided";
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            return "File must be an image";
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            return "Image must be 10MB or smaller";
        }
        return null;
    }

    public String upload(MultipartFile file, String folder, Long userId) throws IOException {
        Map<?, ?> result = cloudinary.uploader().upload(
            file.getBytes(),
            ObjectUtils.asMap("folder", "gotcherapp/" + folder + "/" + userId)
        );
        return (String) result.get("secure_url");
    }

    // Deletes all assets for a user across every upload folder. Best-effort — never throws.
    // Iterates UploadFolder so the cleanup set stays in lock-step with the folders actually written.
    // Returns a map of folder → "ok" or "error: <message>" for reporting.
    public Map<String, Object> deleteAllForUser(Long userId) {
        Map<String, Object> results = new LinkedHashMap<>();
        for (UploadFolder folder : UploadFolder.values()) {
            String name = folder.folderName();
            try {
                cloudinary.api().deleteResourcesByPrefix(
                    "gotcherapp/" + name + "/" + userId,
                    ObjectUtils.emptyMap()
                );
                results.put(name, "ok");
            } catch (Exception e) {
                log.error("Cloudinary cleanup failed for user {} folder {}: {}", userId, name, e.getMessage());
                results.put(name, "error: " + e.getMessage());
            }
        }
        return results;
    }
}
