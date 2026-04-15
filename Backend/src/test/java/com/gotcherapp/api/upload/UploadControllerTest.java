package com.gotcherapp.api.upload;

import com.gotcherapp.api.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UploadControllerTest {

    @Mock ImageUploadService imageUploadService;
    @InjectMocks UploadController uploadController;

    private final AuthPrincipal principal = new AuthPrincipal(1L, "test@example.com");

    @Test
    void upload_returns400_whenFileIsEmpty() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", new byte[]{});
        var response = uploadController.upload(principal, emptyFile, "journal");
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verifyNoInteractions(imageUploadService);
    }

    @Test
    void upload_routesToJournalFolder() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "img.jpg", "image/jpeg", new byte[]{1});
        when(imageUploadService.upload(file, "journal", 1L)).thenReturn("https://url");

        var response = uploadController.upload(principal, file, "journal");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(imageUploadService).upload(file, "journal", 1L);
    }

    @Test
    void upload_routesToMarketplaceFolder() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "img.jpg", "image/jpeg", new byte[]{1});
        when(imageUploadService.upload(file, "marketplace", 1L)).thenReturn("https://url");

        var response = uploadController.upload(principal, file, "marketplace");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(imageUploadService).upload(file, "marketplace", 1L);
    }

    @Test
    void upload_unknownContext_routesToMisc() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "img.jpg", "image/jpeg", new byte[]{1});
        when(imageUploadService.upload(file, "misc", 1L)).thenReturn("https://url");

        var response = uploadController.upload(principal, file, "unknownctx");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(imageUploadService).upload(file, "misc", 1L);
    }

    @Test
    void upload_returns500_whenUploadThrows() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "img.jpg", "image/jpeg", new byte[]{1});
        when(imageUploadService.upload(any(), any(), any())).thenThrow(new java.io.IOException("Cloudinary error"));

        var response = uploadController.upload(principal, file, "journal");

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
    }

    @Test
    void upload_responseContainsUrl() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "img.jpg", "image/jpeg", new byte[]{1});
        when(imageUploadService.upload(file, "journal", 1L)).thenReturn("https://res.cloudinary.com/test/img.jpg");

        var response = uploadController.upload(principal, file, "journal");

        @SuppressWarnings("unchecked")
        var body = (java.util.Map<String, Object>) response.getBody();
        assertEquals("https://res.cloudinary.com/test/img.jpg", body.get("url"));
    }
}
