package com.gotcherapp.api.print;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Print pr5/pr7 — the Lulu-domain layer: builds the create-print-job payload and submits it (via
 * {@link LuluClient#createPrintJob}, which owns the kill switch), plus the cover-dimension cross-check. It does
 * NOT touch {@code print_orders}, Stripe, or the webhook — the fulfilment orchestration (idempotency, status
 * transitions, reading the address off the Stripe session) lives in {@link PrintOrderFulfilmentService}, which
 * calls {@link #submitOrder} once a checkout is paid. The PDFs are rendered pre-checkout (pr7 commit a), so this
 * only hands Lulu the already-persisted {@code source_url}s.
 */
@Service
public class LuluPrintService {

    private static final Logger log = LoggerFactory.getLogger(LuluPrintService.class);

    // Mirror PrintCoverPage.jsx's geometry so the backend can reproduce our computed wrap dims and cross-check
    // them against Lulu's cover-dimensions API (pr4 follow-up: verify PAPER_PPI / SPINE_PAD_IN / bleed / trim).
    // Lulu returns the FULL outside-wrap size = 2·bleed + 2·trim-width + spine  ×  2·bleed + trim-height.
    private static final double TRIM_W_IN = 8.5;
    private static final double TRIM_H_IN = 11.0;
    private static final double BLEED_IN = 0.125;
    private static final double PAPER_PPI = 444.0;   // pages-per-inch of the SKU's 80# stock (the "444" in …444G)
    private static final double SPINE_PAD_IN = 0.06; // Lulu's published softcover perfect-bound spine pad
    private static final double DIM_TOLERANCE_IN = 0.02; // Lulu rounds to 3dp — allow a hair of drift

    // Where Lulu sends print-job notifications: OUR company address (we're the Lulu account holder), not the buyer.
    private static final String CONTACT_EMAIL = "print@cradlehq.app";

    // ⚠ Shipping level is a fixed single level, LOCKED to MAIL (pr6). pr0.5 assumed "GROUND", but shipping-options /
    // cost-calc for THIS SKU→US do NOT offer plain GROUND (only GROUND_HD / MAIL / PRIORITY_MAIL / EXPEDITED /
    // EXPRESS) — a GROUND print job is REJECTED (verified 2026-07-18, sandbox job 314931). MAIL is the cheapest
    // valid US option ($5.69), already baked into the pr6 flat retail price. There is no per-order level selector.
    private static final String SHIPPING_LEVEL = "MAIL";

    private final LuluClient lulu;
    private final String podPackageId;

    public LuluPrintService(LuluClient lulu, @Value("${lulu.pod-package-id:}") String podPackageId) {
        this.lulu = lulu;
        this.podPackageId = podPackageId;
    }

    /** A US shipping address for a print job (Lulu's field names). Collected by Stripe Checkout, read in the webhook. */
    public record Address(String name, String street1, String street2, String city,
                          String stateCode, String postcode, String countryCode, String phone) {}

    /** Cover-dimension cross-check: our computed wrap dims vs Lulu's calc for the SKU + page count. */
    public record CoverCheck(int pageCount, double luluWidth, double luluHeight,
                             double computedWidth, double computedHeight, boolean matches) {}

    /**
     * Submit a PAID Lulu print job for an order: the already-rendered interior/cover {@code source_url}s + copies
     * + the buyer's shipping address. {@code externalId} = the {@code print_orders.id} (Lulu-side dedup: a
     * double-submit would be two physical books). The kill switch in {@link LuluClient#createPrintJob} refuses
     * (throws {@link LuluClient.PrintDisabledException}) when print is off — nothing reaches Lulu.
     */
    public LuluClient.PrintJob submitOrder(String externalId, String interiorUrl, String coverUrl,
                                           int quantity, Address addr) {
        Map<String, Object> body = buildJobBody(externalId, interiorUrl, coverUrl, quantity, addr);
        return lulu.createPrintJob(body);
    }

    /**
     * Cross-check our computed cover wrap against Lulu's authoritative cover-dimensions calc for the given
     * interior page count. A wrong spine = a Lulu reject, so we verify rather than trust the constants. Logs
     * OK/MISMATCH and returns both numbers so the caller can surface (or reconcile) a divergence — never a
     * silent mismatched cover.
     */
    public CoverCheck crossCheckCover(int interiorPageCount) {
        LuluClient.CoverDimensions dims = lulu.coverDimensions(podPackageId, interiorPageCount);
        double spineIn = interiorPageCount / PAPER_PPI + SPINE_PAD_IN;
        double computedWidth = 2 * BLEED_IN + 2 * TRIM_W_IN + spineIn;
        double computedHeight = 2 * BLEED_IN + TRIM_H_IN;
        boolean matches = Math.abs(dims.width() - computedWidth) <= DIM_TOLERANCE_IN
                       && Math.abs(dims.height() - computedHeight) <= DIM_TOLERANCE_IN;
        if (matches) {
            log.info("Lulu cover-dimension cross-check OK for {} pages: Lulu {}x{} in ≈ computed {}x{} in.",
                interiorPageCount, dims.width(), dims.height(), computedWidth, computedHeight);
        } else {
            log.warn("Lulu cover-dimension MISMATCH for {} pages: Lulu {}x{} in vs computed {}x{} in — reconcile "
                    + "PrintCoverPage.jsx constants (PAPER_PPI / SPINE_PAD_IN / BLEED / trim) before real orders.",
                interiorPageCount, dims.width(), dims.height(), computedWidth, computedHeight);
        }
        return new CoverCheck(interiorPageCount, dims.width(), dims.height(), computedWidth, computedHeight, matches);
    }

    /**
     * Build the Lulu create-print-job payload. Lulu fetches {@code interior}/{@code cover} from the public
     * {@code source_url}s server-side (no binary upload). Shape verified against the sandbox: line item carries
     * {@code interior}/{@code cover} directly (each {@code {source_url}}), qty, and the SKU; top-level carries
     * contact email, external id, shipping level, and the address.
     */
    private Map<String, Object> buildJobBody(String externalId, String interiorUrl, String coverUrl,
                                             int quantity, Address addr) {
        Map<String, Object> lineItem = new LinkedHashMap<>();
        lineItem.put("title", "CradleHQ Memory Book");
        lineItem.put("quantity", quantity);
        lineItem.put("pod_package_id", podPackageId);
        lineItem.put("interior", Map.of("source_url", interiorUrl));
        lineItem.put("cover", Map.of("source_url", coverUrl));

        Map<String, Object> address = new LinkedHashMap<>();
        address.put("name", addr.name());
        address.put("street1", addr.street1());
        if (addr.street2() != null && !addr.street2().isBlank()) {
            address.put("street2", addr.street2());
        }
        address.put("city", addr.city());
        address.put("state_code", addr.stateCode());
        address.put("postcode", addr.postcode());
        address.put("country_code", addr.countryCode());
        address.put("phone_number", addr.phone());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contact_email", CONTACT_EMAIL);
        body.put("external_id", externalId);
        body.put("shipping_level", SHIPPING_LEVEL);
        body.put("line_items", List.of(lineItem));
        body.put("shipping_address", address);
        return body;
    }
}
