package com.gotcherapp.api.upload;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImageUploadServiceTest {

    @Mock Cloudinary cloudinary;
    @Mock Uploader uploader;
    @InjectMocks ImageUploadService imageUploadService;

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
}
