package com.gotcherapp.api.print;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Print s14a-1 — the SINGLE interpretation of a Lulu print-job payload. Both status feeds run through here:
 * the signed webhook ({@link LuluWebhookService}) and the reconciliation sweep
 * ({@link PrintOrderStatusService#reconcile()}). If status logic ever gets written twice, this class is
 * factored wrong — the two feeds diverging is exactly the bug that would strand a paying customer.
 *
 * <p>Pure: JSON in, a {@link JobUpdate} out. No DB, no HTTP, no side effects — which is what makes the
 * rejection/shipped shapes testable from fixtures instead of from a real sandbox order.
 *
 * <p><b>Where the real rejection reason lives</b> (verified on our own REJECTED sandbox jobs 314960 + 314931):
 * <pre>
 *   job.status              = { name: "REJECTED", message: "One or more line-items were rejected." }  ← useless
 *   job.line_items[].status = { name: "REJECTED",
 *                               messages: { printable_normalization: { interior: [ "&lt;the real reason&gt;" ] } } }
 * </pre>
 * So we flatten the LINE-ITEM messages and keep the interior/cover label; the job-level text is only a fallback.
 */
@Component
public class LuluJobStatusMapper {

    /** Our order status for a terminal Lulu failure — money is in, no book is coming. */
    public static final String STATUS_FAILED = "failed";
    /** Our order status once Lulu hands the parcel off (tracking arrives on the same payload). */
    public static final String STATUS_SHIPPED = "shipped";

    // A stored reason is for a human reading an alert email; a pathological payload must not bloat the row.
    private static final int MAX_REASON_CHARS = 4000;

    /**
     * What one Lulu payload tells us about an order.
     *
     * @param orderStatus the status WE should move to — {@link #STATUS_FAILED}, {@link #STATUS_SHIPPED}, or
     *                    {@code null} for every in-flight status (UNPAID, PRODUCTION_DELAYED, IN_PRODUCTION,
     *                    DELIVERED…), which we record but never act on.
     */
    public record JobUpdate(
        long jobId, String externalId, String luluStatus, String orderStatus,
        String failureReason, String trackingId, String trackingUrls, String carrierName
    ) {
        /** False for a payload with no usable job id (Lulu's {@code /webhooks/{id}/test/} dummy, say). */
        public boolean isActionable() { return jobId > 0; }
    }

    /** Interpret a print-job object (the webhook's {@code data}, or a {@code GET /print-jobs/{id}/} body). */
    public JobUpdate parse(JsonNode job) {
        if (job == null || !job.hasNonNull("id")) {
            return new JobUpdate(0L, null, null, null, null, null, null, null);
        }
        long jobId = job.path("id").asLong();
        String externalId = job.hasNonNull("external_id") ? job.path("external_id").asText() : null;
        String luluStatus = job.path("status").path("name").asText(null);

        boolean failed = isFailure(luluStatus) || anyLineItemFailed(job);
        boolean shipped = "SHIPPED".equals(luluStatus);

        // A job that is BOTH (a partly-rejected multi-item job) is a failure: we'd rather look at it than
        // quietly call it shipped. Our jobs are single-line-item anyway, so this is belt-and-braces.
        if (failed) {
            return new JobUpdate(jobId, externalId, luluStatus, STATUS_FAILED,
                failureReason(job, luluStatus), null, null, null);
        }
        if (shipped) {
            Tracking t = tracking(job);
            return new JobUpdate(jobId, externalId, luluStatus, STATUS_SHIPPED, null,
                t.id(), t.urls(), t.carrier());
        }
        return new JobUpdate(jobId, externalId, luluStatus, null, null, null, null, null);
    }

    // ── failure ────────────────────────────────────────────────────────────────────────────────────────

    private static boolean isFailure(String jobStatus) {
        return "REJECTED".equals(jobStatus) || "CANCELED".equals(jobStatus) || "ERROR".equals(jobStatus);
    }

    /** Line-item statuses are CREATED/ACCEPTED/REJECTED/IN_PRODUCTION/ERROR/SHIPPED — two of those are fatal. */
    private static boolean anyLineItemFailed(JsonNode job) {
        for (JsonNode li : job.path("line_items")) {
            String s = li.path("status").path("name").asText(null);
            if ("REJECTED".equals(s) || "ERROR".equals(s)) return true;
        }
        return false;
    }

    /**
     * Flatten every message off the failed line items, labelled by where it came from
     * ({@code interior: …} / {@code cover: …}). Falls back to the job-level message only when the line items
     * gave us nothing, since on its own it says nothing actionable.
     */
    private static String failureReason(JsonNode job, String luluStatus) {
        List<String> parts = new ArrayList<>();
        for (JsonNode li : job.path("line_items")) {
            String s = li.path("status").path("name").asText(null);
            if (!"REJECTED".equals(s) && !"ERROR".equals(s)) continue;
            collectMessages(li.path("status").path("messages"), null, parts);
        }
        if (parts.isEmpty()) {
            String jobMessage = job.path("status").path("message").asText(null);
            if (jobMessage != null && !jobMessage.isBlank()) parts.add(jobMessage);
        }
        if (parts.isEmpty()) {
            parts.add("Lulu reported " + (luluStatus == null ? "a failure" : luluStatus) + " with no message.");
        }
        String joined = String.join(" | ", parts);
        return joined.length() > MAX_REASON_CHARS ? joined.substring(0, MAX_REASON_CHARS) + "…" : joined;
    }

    /**
     * Walk the {@code messages} object generically. The shape we've actually seen is
     * {@code printable_normalization.interior[]}, but Lulu nests other message groups the same way, so recursing
     * over objects/arrays collects a reason we've never seen before instead of dropping it on the floor.
     */
    private static void collectMessages(JsonNode node, String label, List<String> out) {
        if (node == null || node.isMissingNode() || node.isNull()) return;
        if (node.isTextual()) {
            String text = node.asText().trim();
            if (!text.isEmpty()) out.add(label == null ? text : label + ": " + text);
            return;
        }
        if (node.isArray()) {
            for (JsonNode child : node) collectMessages(child, label, out);
            return;
        }
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> f = fields.next();
                // Label with the leaf key ("interior"/"cover"), not the grouping object
                // ("printable_normalization") — an object is a wrapper, an array or string is the message itself.
                collectMessages(f.getValue(), f.getValue().isObject() ? label : f.getKey(), out);
            }
        }
    }

    // ── shipped ────────────────────────────────────────────────────────────────────────────────────────

    private record Tracking(String id, String urls, String carrier) {}

    /**
     * Tracking rides the SHIPPED line item. We read it from the line item itself AND from its
     * {@code status.messages} — our sandbox jobs stop at UNPAID, so this shape comes from Lulu's docs rather
     * than from a payload we've held, and checking both places costs nothing.
     */
    private static Tracking tracking(JsonNode job) {
        for (JsonNode li : job.path("line_items")) {
            for (JsonNode src : List.of(li, li.path("status").path("messages"))) {
                String id = src.path("tracking_id").asText(null);
                String carrier = src.path("carrier_name").asText(null);
                List<String> urls = new ArrayList<>();
                for (JsonNode u : src.path("tracking_urls")) {
                    if (u.isTextual() && !u.asText().isBlank()) urls.add(u.asText());
                }
                if (id != null || carrier != null || !urls.isEmpty()) {
                    return new Tracking(id, urls.isEmpty() ? null : String.join("\n", urls), carrier);
                }
            }
        }
        return new Tracking(null, null, null);
    }
}
