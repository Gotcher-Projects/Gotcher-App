package com.gotcherapp.api.upload;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ImageUploadService {

    private final Cloudinary cloudinary;

    public ImageUploadService(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    /** Best-effort: deletes all Cloudinary assets for a user across known folders. Never throws. */
    public Map<String, Object> deleteAllForUser(Long userId) {
        Map<String, Object> result = new LinkedHashMap<>();
        String[] folders = {"journal", "marketplace", "misc", "babies", "first-times"};
        for (String folder : folders) {
            String prefix = "gotcherapp/" + folder + "/" + userId;
            try {
                Map<?, ?> res = cloudinary.api().deleteResourcesByPrefix(prefix, ObjectUtils.emptyMap());
                result.put(folder, res.get("deleted_counts"));
            } catch (Exception e) {
                result.put(folder, "skipped: " + e.getMessage());
            }
        }
        return result;
    }

    public String upload(MultipartFile file, String folder, Long userId) throws IOException {
        Map<?, ?> result = cloudinary.uploader().upload(
            file.getBytes(),
            ObjectUtils.asMap("folder", "gotcherapp/" + folder + "/" + userId)
        );
        return (String) result.get("secure_url");
    }
}
