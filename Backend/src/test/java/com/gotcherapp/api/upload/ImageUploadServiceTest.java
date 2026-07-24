package com.gotcherapp.api.upload;

import com.cloudinary.Api;
import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.cloudinary.utils.ObjectUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImageUploadServiceTest {

    @Mock Cloudinary cloudinary;
    @Mock Uploader uploader;
    @Mock Api api;
    @InjectMocks ImageUploadService imageUploadService;

    // Every folder the app actually writes into — must match what deleteAllForUser sweeps.
    private static final Set<String> WRITTEN_FOLDERS =
        Set.of("journal", "marketplace", "bump_photos", "babies", "storybook", "misc");

    @Captor ArgumentCaptor<Map<?, ?>> optionsCaptor;

    private static final String SECURE_URL = "https://res.cloudinary.com/test/image/upload/gotcherapp/journal/42/abc.jpg";

    @Test
    void upload_returnsSecureUrl() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", new byte[]{1, 2, 3});
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), any())).thenReturn(Map.of("secure_url", SECURE_URL));

        String result = imageUploadService.upload(file, "journal", 42L);

        assertEquals(SECURE_URL, result);
    }

    @Test
    void upload_buildsCorrectFolderPath_forJournal() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", new byte[]{1});
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), any())).thenReturn(Map.of("secure_url", SECURE_URL));

        imageUploadService.upload(file, "journal", 42L);

        verify(uploader).upload(any(byte[].class), optionsCaptor.capture());
        assertEquals("gotcherapp/journal/42", optionsCaptor.getValue().get("folder"));
    }

    @Test
    void upload_buildsCorrectFolderPath_forMarketplace() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", new byte[]{1});
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), any())).thenReturn(Map.of("secure_url", SECURE_URL));

        imageUploadService.upload(file, "marketplace", 7L);

        verify(uploader).upload(any(byte[].class), optionsCaptor.capture());
        assertEquals("gotcherapp/marketplace/7", optionsCaptor.getValue().get("folder"));
    }

    @Test
    void upload_includesFileBytes() throws Exception {
        byte[] content = {10, 20, 30};
        MockMultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", content);
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), any())).thenReturn(Map.of("secure_url", SECURE_URL));

        imageUploadService.upload(file, "journal", 1L);

        ArgumentCaptor<byte[]> bytesCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(uploader).upload(bytesCaptor.capture(), any());
        assertEquals(content, bytesCaptor.getValue());
    }

    // ── deleteAllForUser ────────────────────────────────────────────────────────

    @Test
    void deleteAllForUser_sweepsEveryWrittenFolder() throws Exception {
        when(cloudinary.api()).thenReturn(api);
        // deleteResourcesByPrefix's return value is ignored by the service, so leave it unstubbed.

        Map<String, Object> results = imageUploadService.deleteAllForUser(42L);

        // The set of folders cleaned must be exactly the set of folders written — no orphans,
        // no dead entries. This is the regression guard for the cleanup-taxonomy drift bug.
        assertEquals(WRITTEN_FOLDERS, results.keySet());
        results.values().forEach(v -> assertEquals("ok", v));
        for (String folder : WRITTEN_FOLDERS) {
            verify(api).deleteResourcesByPrefix("gotcherapp/" + folder + "/42", ObjectUtils.emptyMap());
        }
    }

    @Test
    void deleteAllForUser_isBestEffort_continuesAfterFailure() throws Exception {
        when(cloudinary.api()).thenReturn(api);
        // Only the journal call throws; every other call returns the mock default (null), which the
        // service ignores. This proves one folder's failure doesn't abort the rest of the sweep.
        when(api.deleteResourcesByPrefix(contains("/journal/"), any()))
            .thenThrow(new RuntimeException("cloudinary down"));

        Map<String, Object> results = imageUploadService.deleteAllForUser(7L);

        // Every folder is still reported, the failing one records an error, the rest succeed.
        assertEquals(WRITTEN_FOLDERS, results.keySet());
        assertTrue(results.get("journal").toString().startsWith("error:"));
        assertEquals("ok", results.get("misc"));
        assertEquals("ok", results.get("storybook"));
    }

    // ── imageValidationError ────────────────────────────────────────────────────

    @Test
    void imageValidationError_acceptsValidImage() {
        MockMultipartFile file = new MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[]{1, 2});
        assertNull(ImageUploadService.imageValidationError(file));
    }

    @Test
    void imageValidationError_rejectsEmpty() {
        MockMultipartFile file = new MockMultipartFile("file", new byte[]{});
        assertEquals("No file provided", ImageUploadService.imageValidationError(file));
    }

    @Test
    void imageValidationError_rejectsNonImage() {
        MockMultipartFile file = new MockMultipartFile("file", "n.txt", "text/plain", new byte[]{1});
        assertEquals("File must be an image", ImageUploadService.imageValidationError(file));
    }

    @Test
    void imageValidationError_rejectsOversize() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getContentType()).thenReturn("image/png");
        when(file.getSize()).thenReturn(ImageUploadService.MAX_FILE_SIZE_BYTES + 1);
        assertEquals("Image must be 10MB or smaller", ImageUploadService.imageValidationError(file));
    }
}
