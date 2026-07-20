package com.gotcherapp.api.print;

import com.stripe.model.Address;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Print pr7 (commit b) — fulfils a PAID print checkout by submitting the Lulu job. Called from
 * {@link com.gotcherapp.api.billing.BillingWebhookService} when a {@code checkout.session.completed} event carries
 * {@code metadata.type == "print_order"} (the credit/share branch is untouched). Same "fulfil on the signed
 * webhook, never on the browser return" discipline as Payments P3; the webhook NEVER renders (the PDFs were
 * rendered pre-checkout in commit a) so it returns fast.
 *
 * <p><b>Idempotency</b> is an atomic claim on the order row: only the delivery that flips {@code pending → paid}
 * submits the Lulu job. A Stripe redelivery (retries, "Resend") finds the row no longer {@code pending} and is a
 * no-op — the analogue of the credit ledger's {@code ON CONFLICT DO NOTHING}. Submitting twice would print two
 * physical books, so this guard is load-bearing.
 *
 * <p><b>Paid-but-not-submitted</b> is a real state we never drop: if the Lulu submit refuses (kill switch off) or
 * errors, the row stays {@code paid} (money taken, no book) and is logged for the s14a refund/retry path — we do
 * NOT rethrow, because the claim already recorded payment and a Stripe retry would only hit the no-op claim.
 */
@Service
public class PrintOrderFulfilmentService {

    private static final Logger log = LoggerFactory.getLogger(PrintOrderFulfilmentService.class);

    private final JdbcTemplate jdbc;
    private final LuluPrintService luluPrintService;

    public PrintOrderFulfilmentService(JdbcTemplate jdbc, LuluPrintService luluPrintService) {
        this.jdbc = jdbc;
        this.luluPrintService = luluPrintService;
    }

    /** Fulfil the paid print order named in {@code session.metadata.printOrderId}. Idempotent (see class doc). */
    public void fulfil(String eventId, Session session) {
        long orderId = Long.parseLong(session.getMetadata().get("printOrderId"));
        LuluPrintService.Address addr = readAddress(session);

        // Atomic claim: ONLY the first delivery flips pending→paid and records the address + paying event. A
        // redelivery affects 0 rows → we never submit a second Lulu job. Nothing fallible runs between this and
        // the submit, so a paid order is always either submitted or left visibly 'paid' for s14a.
        int claimed = jdbc.update(
            "UPDATE print_orders SET status = 'paid', stripe_event_id = ?, " +
            "ship_name = ?, ship_street1 = ?, ship_street2 = ?, ship_city = ?, ship_state_code = ?, " +
            "ship_postcode = ?, ship_country_code = ?, ship_phone = ?, updated_at = NOW() " +
            "WHERE id = ? AND status = 'pending'",
            eventId, addr.name(), addr.street1(), addr.street2(), addr.city(), addr.stateCode(),
            addr.postcode(), addr.countryCode(), addr.phone(), orderId);
        if (claimed == 0) {
            log.info("Print order {} already fulfilled (event {} redelivery) — no second Lulu job.", orderId, eventId);
            return;
        }

        Map<String, Object> order = jdbc.queryForMap(
            "SELECT quantity, interior_pdf_url, cover_pdf_url FROM print_orders WHERE id = ?", orderId);
        int quantity = ((Number) order.get("quantity")).intValue();
        String interiorUrl = (String) order.get("interior_pdf_url");
        String coverUrl = (String) order.get("cover_pdf_url");

        // Submit the PAID Lulu job. external_id = the order id → Lulu-side dedup (double-submit = two books).
        try {
            LuluClient.PrintJob job = luluPrintService.submitOrder(
                "print-order-" + orderId, interiorUrl, coverUrl, quantity, addr);
            jdbc.update(
                "UPDATE print_orders SET status = 'submitted', lulu_job_id = ?, updated_at = NOW() WHERE id = ?",
                job.id(), orderId);
            log.info("Print order {} submitted to Lulu as job {} (status {}, event {}).",
                orderId, job.id(), job.status(), eventId);
        } catch (LuluClient.PrintDisabledException e) {
            // Kill switch off: money taken, no book. Park at 'paid' for s14a — don't drop it, don't retry-storm.
            log.warn("Print order {} is PAID but print is disabled (kill switch) — parked at 'paid' for s14a "
                + "(event {}): {}", orderId, eventId, e.getMessage());
        } catch (LuluClient.LuluApiException e) {
            // Lulu rejected/errored: same posture — the paid order is visible at 'paid' for the s14a retry/refund.
            log.error("Print order {} is PAID but the Lulu submit failed — parked at 'paid' for s14a (event {}): {}",
                orderId, eventId, e.getMessage(), e);
        }
    }

    /** Read the Stripe-collected US shipping address + phone off the completed session into Lulu's field shape. */
    private LuluPrintService.Address readAddress(Session session) {
        Session.CollectedInformation collected = session.getCollectedInformation();
        Session.CollectedInformation.ShippingDetails ship =
            (collected == null) ? null : collected.getShippingDetails();
        Address a = (ship == null) ? null : ship.getAddress();
        String name = (ship == null) ? null : ship.getName();
        String phone = (session.getCustomerDetails() == null) ? null : session.getCustomerDetails().getPhone();
        return new LuluPrintService.Address(
            name,
            a == null ? null : a.getLine1(),
            a == null ? null : a.getLine2(),
            a == null ? null : a.getCity(),
            a == null ? null : a.getState(),      // US 2-letter code (Lulu's state_code)
            a == null ? null : a.getPostalCode(),
            a == null ? null : a.getCountry(),     // ISO 2-letter (Lulu's country_code)
            phone);
    }
}
