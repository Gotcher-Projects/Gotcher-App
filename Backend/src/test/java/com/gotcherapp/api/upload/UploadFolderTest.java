package com.gotcherapp.api.upload;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UploadFolderTest {

    @Test
    void fromContext_mapsKnownContexts() {
        assertEquals(UploadFolder.JOURNAL, UploadFolder.fromContext("journal"));
        assertEquals(UploadFolder.MARKETPLACE, UploadFolder.fromContext("marketplace"));
        assertEquals(UploadFolder.BUMP_PHOTOS, UploadFolder.fromContext("bump_photos"));
    }

    @Test
    void fromContext_fallsBackToMisc_forUnknownNullAndFirstTimes() {
        assertEquals(UploadFolder.MISC, UploadFolder.fromContext("first_times"));
        assertEquals(UploadFolder.MISC, UploadFolder.fromContext("anything-else"));
        assertEquals(UploadFolder.MISC, UploadFolder.fromContext(null));
    }

    @Test
    void folderName_matchesCloudinaryConvention() {
        assertEquals("journal", UploadFolder.JOURNAL.folderName());
        assertEquals("bump_photos", UploadFolder.BUMP_PHOTOS.folderName());
        assertEquals("babies", UploadFolder.BABIES.folderName());
        assertEquals("storybook", UploadFolder.STORYBOOK.folderName());
        assertEquals("misc", UploadFolder.MISC.folderName());
    }
}
