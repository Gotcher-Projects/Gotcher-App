package com.gotcherapp.api.upload;

/**
 * Single source of truth for the Cloudinary folder names this app writes into. Every upload surface
 * resolves its destination through this enum, and {@link ImageUploadService#deleteAllForUser}
 * iterates the full set on account deletion — so adding a new upload destination here automatically
 * wires it into cleanup, which is exactly the bug this enum exists to prevent (orphaned assets that
 * were never removed because the cleanup list drifted from the folders actually written).
 */
public enum UploadFolder {
    JOURNAL("journal"),
    MARKETPLACE("marketplace"),
    BUMP_PHOTOS("bump_photos"),
    BABIES("babies"),
    STORYBOOK("storybook"),
    MISC("misc");

    private final String folderName;

    UploadFolder(String folderName) {
        this.folderName = folderName;
    }

    public String folderName() {
        return folderName;
    }

    /**
     * Maps an upload {@code context} request param to its destination folder. Unknown or null
     * contexts — including {@code first_times}, which has no dedicated folder — fall back to
     * {@link #MISC}, which {@link ImageUploadService#deleteAllForUser} also covers.
     */
    public static UploadFolder fromContext(String context) {
        if (context == null) return MISC;
        return switch (context) {
            case "journal"     -> JOURNAL;
            case "marketplace" -> MARKETPLACE;
            case "bump_photos" -> BUMP_PHOTOS;
            default            -> MISC;
        };
    }
}
