package com.gotcherapp.api.print;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Print pr5 — orchestrates the Lulu submit: render interior + cover (pr3/pr4), cross-check the cover geometry
 * against Lulu's authoritative calc, then hand a built payload to {@link LuluClient#createPrintJob} (which owns
 * the kill switch). Stops at the client — no {@code print_orders}, address capture, Stripe, or webhook; those
 * are pr7. The {@link #submitTestJob} path is a THROWAWAY dev harness (canned sandbox address); pr7 deletes it
 * and moves the submit into the fulfil-on-paid Stripe webhook.
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

    // Canned sandbox order for the throwaway dev trigger (US-only). pr7 replaces this with the real customer +
    // captured address, and pr6/pr7 pick the customer-facing shipping level.
    private static final String TEST_CONTACT_EMAIL = "print@cradlehq.app";

    // ⚠ pr0.5 assumed a fixed "GROUND" level, but shipping-options / cost-calc for THIS SKU→US do NOT offer plain
    // GROUND (only GROUND_HD / MAIL / PRIORITY_MAIL / EXPEDITED / EXPRESS) — a GROUND print job is REJECTED (verified
    // 2026-07-18, sandbox job 314931). We default the throwaway harness to MAIL: the cheapest valid US option
    // ($5.69), closest to the "cheap ground" intent. The real level is a pr6/pr7 (cost-estimate/checkout) decision.
    private static final String TEST_SHIPPING_LEVEL = "MAIL";

    private final LuluClient lulu;
    private final PrintRenderService renderService;
    private final PrintInteriorService printInteriorService;
    private final String podPackageId;

    public LuluPrintService(
            LuluClient lulu,
            PrintRenderService renderService,
            PrintInteriorService printInteriorService,
            @Value("${lulu.pod-package-id:}") String podPackageId) {
        this.lulu = lulu;
        this.renderService = renderService;
        this.printInteriorService = printInteriorService;
        this.podPackageId = podPackageId;
    }

    /** Cover-dimension cross-check: our computed wrap dims vs Lulu's calc for the SKU + page count. */
    public record CoverCheck(int pageCount, double luluWidth, double luluHeight,
                             double computedWidth, double computedHeight, boolean matches) {}

    /** Result of the throwaway dev submit — the job + the URLs Lulu will fetch + the cover cross-check. */
    public record LuluTestResult(long jobId, String status, String interiorUrl, String coverUrl,
                                 CoverCheck coverCheck, List<LuluClient.LineItemStatus> lineItems) {}

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
     * THROWAWAY dev flow (pr7 deletes this): render interior + cover behind signed token URLs, cross-check the
     * cover, then submit a PAID sandbox print job with a canned US address + qty 1. The client kill switch
     * refuses the submit when print is off — so with the flag off this still renders + cross-checks, then throws
     * {@link LuluClient.PrintDisabledException} at the submit (nothing reaches Lulu).
     */
    public LuluTestResult submitTestJob(Long userId, Long bookId) {
        // 1. Render both PDFs pre-submit (pr0.5 "pre-checkout render") — persisted behind unguessable token URLs.
        PrintRenderService.RenderResult interior = renderService.renderInterior(userId, bookId);
        PrintRenderService.RenderResult cover = renderService.renderCover(userId, bookId);

        // 2. GATE (pr5.5, D2): a book must be orderable — ≥ 32 filled interior pages, within the type ceiling —
        //    before we ever submit. Same single source of truth pr6/pr8 use, so the harness enforces the real
        //    rule. The count = Σ filtered chapter pages (== what the interior PDF just rendered) and also drives
        //    the cover cross-check.
        PrintInteriorService.Orderability gate = printInteriorService.orderability(userId, bookId);
        if (!gate.orderable()) {
            throw new NotOrderableException(gate);
        }
        int pageCount = gate.pageCount();
        CoverCheck check = crossCheckCover(pageCount);

        // 3. Build + submit the paid job. external_id = the dedup seam pr7 ties to print_orders.id (double-submit
        //    = two physical books); here it's just a unique generated id.
        String externalId = "pr5-test-" + bookId + "-" + System.currentTimeMillis();
        Map<String, Object> body = buildJobBody(externalId, interior.pdfUrl(), cover.pdfUrl(), 1);
        LuluClient.PrintJob job = lulu.createPrintJob(body);

        return new LuluTestResult(job.id(), job.status(), interior.pdfUrl(), cover.pdfUrl(), check, job.lineItems());
    }

    /** Poll a job's async status (throwaway dev harness — pr7 owns real status handling). */
    public LuluClient.PrintJob getJobStatus(long jobId) {
        return lulu.getPrintJob(jobId);
    }

    /** A book that fails the print gate (too few / too many interior pages) — never reaches Lulu. Mapped to 409. */
    public static class NotOrderableException extends RuntimeException {
        private final transient PrintInteriorService.Orderability gate;
        public NotOrderableException(PrintInteriorService.Orderability gate) {
            super("Book is not orderable: " + gate.pageCount() + " filled pages (need "
                + gate.min() + "–" + gate.max() + "); reason=" + gate.reason());
            this.gate = gate;
        }
        public PrintInteriorService.Orderability gate() { return gate; }
    }

    /**
     * Build the Lulu create-print-job payload. Lulu fetches {@code interior}/{@code cover} from the public
     * {@code source_url}s server-side (no binary upload). Shape verified against the sandbox: line item carries
     * {@code interior}/{@code cover} directly (each {@code {source_url}}), qty, and the SKU; top-level carries
     * contact email, external id, shipping level, and the address.
     */
    private Map<String, Object> buildJobBody(String externalId, String interiorUrl, String coverUrl, int quantity) {
        Map<String, Object> lineItem = new LinkedHashMap<>();
        lineItem.put("title", "CradleHQ Memory Book");
        lineItem.put("quantity", quantity);
        lineItem.put("pod_package_id", podPackageId);
        lineItem.put("interior", Map.of("source_url", interiorUrl));
        lineItem.put("cover", Map.of("source_url", coverUrl));

        Map<String, Object> address = new LinkedHashMap<>();
        address.put("name", "CradleHQ Sandbox Test");
        address.put("street1", "123 Test Street");
        address.put("city", "Los Angeles");
        address.put("state_code", "CA");
        address.put("postcode", "90001");
        address.put("country_code", "US");
        address.put("phone_number", "5551234567");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contact_email", TEST_CONTACT_EMAIL);
        body.put("external_id", externalId);
        body.put("shipping_level", TEST_SHIPPING_LEVEL);
        body.put("line_items", List.of(lineItem));
        body.put("shipping_address", address);
        return body;
    }
}
