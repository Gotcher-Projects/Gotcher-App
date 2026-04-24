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

    public ImageUploadService(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    public String upload(MultipartFile file, String folder, Long userId) throws IOException {
        Map<?, ?> result = cloudinary.uploader().upload(
            file.getBytes(),
            ObjectUtils.asMap("folder", "gotcherapp/" + folder + "/" + userId)
        );
        return (String) result.get("secure_url");
    }

    // Deletes all assets for a user across every upload folder. Best-effort — never throws.
    // Returns a map of folder → "ok" or "error: <message>" for reporting.
    public Map<String, Object> deleteAllForUser(Long userId) {
        String[] folders = { "journal", "misc", "marketplace", "babies", "first-times" };
        Map<String, Object> results = new LinkedHashMap<>();
        for (String folder : folders) {
            try {
                cloudinary.api().deleteResourcesByPrefix(
                    "gotcherapp/" + folder + "/" + userId,
                    ObjectUtils.emptyMap()
                );
                results.put(folder, "ok");
            } catch (Exception e) {
                log.error("Cloudinary cleanup failed for user {} folder {}: {}", userId, folder, e.getMessage());
                results.put(folder, "error: " + e.getMessage());
            }
        }
        return results;
    }
}
