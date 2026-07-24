package com.gotcherapp.api.billing;

/**
 * The four one-time SKUs CradleHQ sells — the single source of truth for what checkout accepts and
 * whether a purchase attaches to a specific book. Credit amounts intentionally live NOT here but on
 * each Stripe price's metadata (set in the dashboard, read by the webhook in P3), so the dollar
 * amount and the credits granted can never drift apart in two places.
 *
 * NOTE: an enum is the right shape for four fixed SKUs. If this set grows a lot, or SKUs start
 * needing per-item behavior beyond (wireName, requiresBookId), move to a config-driven map instead.
 */
public enum Sku {
    CREDITS_50("credits_50", false),
    CREDITS_125("credits_125", false),
    BUNDLE_SHARE_150("bundle_share_150", true),
    SHARE_ONLY("share_only", true);

    private final String wireName;      // the value the API/frontend uses and Stripe metadata carries
    private final boolean requiresBookId;

    Sku(String wireName, boolean requiresBookId) {
        this.wireName = wireName;
        this.requiresBookId = requiresBookId;
    }

    public String wireName() {
        return wireName;
    }

    /** True for the share SKUs (a specific book is unlocked); false for the account-scoped credit packs. */
    public boolean requiresBookId() {
        return requiresBookId;
    }

    /** Resolve a wire value to a SKU, or throw for anything unrecognized (→ 400 at the controller). */
    public static Sku fromWire(String wire) {
        if (wire != null) {
            for (Sku sku : values()) {
                if (sku.wireName.equals(wire)) {
                    return sku;
                }
            }
        }
        throw new IllegalArgumentException("Unknown sku: " + wire);
    }
}
