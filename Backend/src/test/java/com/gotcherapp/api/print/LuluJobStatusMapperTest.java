package com.gotcherapp.api.print;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Print s14a-1 — the one interpretation both status feeds share. These pin the payload shapes we actually
 * observed on our own sandbox jobs, because getting them wrong is invisible until a real customer is out $35:
 * the rejection reason lives on the LINE ITEM (the job-level text is the useless "One or more line-items were
 * rejected."), and every in-flight status must map to "leave our status alone".
 */
class LuluJobStatusMapperTest {

    private final LuluJobStatusMapper mapper = new LuluJobStatusMapper();
    private final ObjectMapper json = new ObjectMapper();

    private LuluJobStatusMapper.JobUpdate parse(String body) throws Exception {
        return mapper.parse(json.readTree(body));
    }

    /** The shape of our real REJECTED job 314931 — a source url Lulu couldn't fetch. */
    @Test
    void rejection_takesTheReasonFromTheLineItem_notTheJob() throws Exception {
        LuluJobStatusMapper.JobUpdate u = parse("""
            {
              "id": 314931,
              "external_id": "print-order-6",
              "status": { "name": "REJECTED", "message": "One or more line-items were rejected." },
              "line_items": [{
                "status": {
                  "name": "REJECTED",
                  "messages": {
                    "printable_normalization": {
                      "interior": [ "Unexpected Http response for source url. Status code: 404" ]
                    }
                  }
                }
              }]
            }
            """);

        assertEquals(314931L, u.jobId());
        assertEquals("REJECTED", u.luluStatus());
        assertEquals(LuluJobStatusMapper.STATUS_FAILED, u.orderStatus());
        assertTrue(u.failureReason().contains("Status code: 404"), u.failureReason());
        assertTrue(u.failureReason().contains("interior"), "the panel label is what makes the reason usable");
        assertFalse(u.failureReason().contains("One or more line-items"), "the job-level text says nothing");
    }

    /** A line item can fail while the JOB still looks fine — that's the case nothing used to notice. */
    @Test
    void lineItemError_failsTheOrder_evenWhenTheJobStatusLooksHealthy() throws Exception {
        LuluJobStatusMapper.JobUpdate u = parse("""
            {
              "id": 42,
              "status": { "name": "IN_PRODUCTION" },
              "line_items": [{ "status": { "name": "ERROR",
                "messages": { "printable_normalization": { "cover": [ "Spine width mismatch" ] } } } }]
            }
            """);

        assertEquals(LuluJobStatusMapper.STATUS_FAILED, u.orderStatus());
        assertTrue(u.failureReason().contains("cover: Spine width mismatch"), u.failureReason());
    }

    /** Never invent a reason, but never store an empty one either — an alert with no text helps nobody. */
    @Test
    void rejectionWithNoMessages_stillCarriesSomethingReadable() throws Exception {
        LuluJobStatusMapper.JobUpdate u = parse("{ \"id\": 7, \"status\": { \"name\": \"CANCELED\" } }");

        assertEquals(LuluJobStatusMapper.STATUS_FAILED, u.orderStatus());
        assertNotNull(u.failureReason());
        assertTrue(u.failureReason().contains("CANCELED"), u.failureReason());
    }

    @Test
    void shipped_capturesTrackingFromTheLineItem() throws Exception {
        LuluJobStatusMapper.JobUpdate u = parse("""
            {
              "id": 900,
              "status": { "name": "SHIPPED" },
              "line_items": [{
                "status": { "name": "SHIPPED" },
                "tracking_id": "1Z999",
                "carrier_name": "UPS",
                "tracking_urls": [ "https://ups.com/1Z999", "https://ups.com/alt" ]
              }]
            }
            """);

        assertEquals(LuluJobStatusMapper.STATUS_SHIPPED, u.orderStatus());
        assertEquals("1Z999", u.trackingId());
        assertEquals("UPS", u.carrierName());
        assertEquals("https://ups.com/1Z999\nhttps://ups.com/alt", u.trackingUrls());
    }

    /** Lulu's docs nest tracking under the line-item status messages; we've never held one, so accept both. */
    @Test
    void shipped_alsoReadsTrackingNestedUnderStatusMessages() throws Exception {
        LuluJobStatusMapper.JobUpdate u = parse("""
            {
              "id": 901,
              "status": { "name": "SHIPPED" },
              "line_items": [{ "status": { "name": "SHIPPED",
                "messages": { "tracking_id": "9400", "carrier_name": "USPS",
                              "tracking_urls": [ "https://usps.com/9400" ] } } }]
            }
            """);

        assertEquals("9400", u.trackingId());
        assertEquals("USPS", u.carrierName());
        assertEquals("https://usps.com/9400", u.trackingUrls());
    }

    /** Every in-flight status: record where Lulu is, move nothing. DELIVERED included — 'shipped' is terminal for us. */
    @Test
    void inFlightStatuses_leaveOurStatusAlone() throws Exception {
        for (String status : new String[] {
            "CREATED", "UNPAID", "PAYMENT_IN_PROGRESS", "PRODUCTION_DELAYED",
            "PRODUCTION_READY", "IN_PRODUCTION", "DELIVERED"
        }) {
            LuluJobStatusMapper.JobUpdate u = parse(
                "{ \"id\": 1, \"status\": { \"name\": \"" + status + "\" }, " +
                "\"line_items\": [{ \"status\": { \"name\": \"ACCEPTED\" } }] }");
            assertNull(u.orderStatus(), status + " must not move our order status");
            assertEquals(status, u.luluStatus());
        }
    }

    /**
     * A payload with no job id must be inert. Lulu's {@code /webhooks/{id}/test/} fires dummy data, and five
     * consecutive delivery FAILURES deactivate the webhook — so "I can't act on this" has to be a quiet 200,
     * never an error.
     */
    @Test
    void payloadWithNoJobId_isNotActionable() throws Exception {
        assertFalse(parse("{ \"hello\": \"world\" }").isActionable());
        assertFalse(mapper.parse(null).isActionable());
    }
}
