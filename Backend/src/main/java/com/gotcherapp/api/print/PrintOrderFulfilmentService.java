package com.gotcherapp.api.print;

import com.stripe.model.Address;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
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
 * errors, the row stays {@code paid} (money taken, no book). s14a-1 made that state legible rather than a log
 * line — the row now records {@code parked_reason} (D3: a kill-switch park is resumable, a Lulu error needs a
 * human) and {@code submit_attempts}, an operator is emailed when it needs attention, and
 * {@link PrintOrderStatusService#reconcile()} resumes the resumable ones. We still do NOT rethrow, because the
 * claim already recorded payment and a Stripe retry would only hit the no-op claim.
 */
@Service
public class PrintOrderFulfilmentService {

    private static final Logger log = LoggerFactory.getLogger(PrintOrderFulfilmentService.class);

    /** Kill switch off — the book is fine, we simply weren't accepting jobs. Resume it, never refund it (D3). */
    public static final String PARKED_PRINT_DISABLED = "print_disabled";
    /** Lulu refused the submit. Needs a human: it may be our payload, their outage, or a dead PDF url. */
    public static final String PARKED_SUBMIT_FAILED = "submit_failed";
    /** The pre-checkout-rendered PDFs aged out (pr3's TTL) while parked — no submit can succeed without a re-render. */
    public static final String PARKED_PDF_EXPIRED = "pdf_expired";

    private final JdbcTemplate jdbc;
    private final LuluPrintService luluPrintService;
    private final PrintOperatorAlert alerts;

    public PrintOrderFulfilmentService(JdbcTemplate jdbc, LuluPrintService luluPrintService,
                                       PrintOperatorAlert alerts) {
        this.jdbc = jdbc;
        this.luluPrintService = luluPrintService;
        this.alerts = alerts;
    }

    /** Fulfil the paid print order named in {@code session.metadata.printOrderId}. Idempotent (see class doc). */
    public void fulfil(String eventId, Session session) {
        long orderId = Long.parseLong(session.getMetadata().get("printOrderId"));
        LuluPrintService.Address addr = readAddress(session);

        // Atomic claim: ONLY the first delivery flips pending→paid and records the address + paying event. A
        // redelivery affects 0 rows → we never submit a second Lulu job. Nothing fallible runs between this and
        // the submit, so a paid order is always either submitted or left visibly 'paid' for the sweep.
        //
        // s14a-1: the PaymentIntent is captured HERE, inside the existing claim, rather than by a second write —
        // the Session is already in hand, it costs one bind parameter, and the claim's atomicity is load-bearing.
        // Without it no refund can be issued at all (Refund.create needs a PaymentIntent or charge id).
        int claimed = jdbc.update(
            "UPDATE print_orders SET status = 'paid', stripe_event_id = ?, stripe_payment_intent = ?, " +
            "ship_name = ?, ship_street1 = ?, ship_street2 = ?, ship_city = ?, ship_state_code = ?, " +
            "ship_postcode = ?, ship_country_code = ?, ship_phone = ?, updated_at = NOW() " +
            "WHERE id = ? AND status = 'pending'",
            eventId, session.getPaymentIntent(), addr.name(), addr.street1(), addr.street2(), addr.city(),
            addr.stateCode(), addr.postcode(), addr.countryCode(), addr.phone(), orderId);
        if (claimed == 0) {
            log.info("Print order {} already fulfilled (event {} redelivery) — no second Lulu job.", orderId, eventId);
            return;
        }

        Map<String, Object> order = jdbc.queryForMap(
            "SELECT quantity, interior_pdf_url, cover_pdf_url FROM print_orders WHERE id = ?", orderId);
        submit(orderId,
            ((Number) order.get("quantity")).intValue(),
            (String) order.get("interior_pdf_url"),
            (String) order.get("cover_pdf_url"),
            addr,
            "event " + eventId);
    }

    /**
     * s14a-1 — re-submit a PAID order that never reached Lulu, called by the reconciliation sweep. This is the
     * "flip {@code PRINT_ENABLED} back on after the vacation and in-flight orders resume" path (D3): the sweep
     * only calls this for a {@code print_disabled} park, and only while print is enabled.
     *
     * <p>The address is read back off the row (the Stripe session is long gone). A no-longer-eligible order —
     * already submitted, already failed, claimed by a concurrent pass — matches nothing and is a silent no-op.
     *
     * <p><b>Expired PDFs are a dead end, not a retry.</b> pr3 gives a rendered PDF a 24h TTL, so an order parked
     * across a long kill-switch window has {@code source_url}s that now 404. Submitting anyway would buy a
     * guaranteed Lulu rejection, so it parks as {@code pdf_expired} and asks for a human instead.
     */
    public void resubmitParked(long orderId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT quantity, interior_pdf_url, cover_pdf_url, (pdf_expires_at <= NOW()) AS pdf_expired, " +
            "ship_name, ship_street1, ship_street2, ship_city, ship_state_code, ship_postcode, " +
            "ship_country_code, ship_phone " +
            "FROM print_orders WHERE id = ? AND status = 'paid' AND lulu_job_id IS NULL", orderId);
        if (rows.isEmpty()) {
            log.debug("Print order {} is no longer eligible for resume — skipping.", orderId);
            return;
        }
        Map<String, Object> o = rows.get(0);

        if (Boolean.TRUE.equals(o.get("pdf_expired"))) {
            String reason = "The rendered interior/cover PDFs expired (pr3 TTL) while the order was parked, so "
                + "Lulu can no longer fetch them. The book must be re-rendered before this order can be submitted.";
            park(orderId, PARKED_PDF_EXPIRED, reason);
            alerts.orderNeedsAttention(orderId, "paid order can't be submitted (PDFs expired)", reason);
            log.error("Print order {} is PAID but its PDFs expired while parked — needs a re-render.", orderId);
            return;
        }

        LuluPrintService.Address addr = new LuluPrintService.Address(
            (String) o.get("ship_name"), (String) o.get("ship_street1"), (String) o.get("ship_street2"),
            (String) o.get("ship_city"), (String) o.get("ship_state_code"), (String) o.get("ship_postcode"),
            (String) o.get("ship_country_code"), (String) o.get("ship_phone"));
        submit(orderId,
            ((Number) o.get("quantity")).intValue(),
            (String) o.get("interior_pdf_url"),
            (String) o.get("cover_pdf_url"),
            addr,
            "sweep resume");
    }

    /**
     * Submit the PAID Lulu job and record the outcome on the row. {@code external_id} = the order id → Lulu-side
     * dedup (a double-submit would be two physical books). Every exit leaves the row telling the truth: submitted
     * with a job id, or parked at 'paid' with a reason.
     */
    private void submit(long orderId, int quantity, String interiorUrl, String coverUrl,
                        LuluPrintService.Address addr, String context) {
        // Bumped BEFORE the call: an attempt that dies mid-flight still counts, so the resume cap can't be
        // defeated by a submit that hangs or throws something we didn't anticipate.
        jdbc.update("UPDATE print_orders SET submit_attempts = submit_attempts + 1, updated_at = NOW() " +
            "WHERE id = ?", orderId);
        try {
            LuluClient.PrintJob job = luluPrintService.submitOrder(
                "print-order-" + orderId, interiorUrl, coverUrl, quantity, addr);
            jdbc.update(
                "UPDATE print_orders SET status = 'submitted', lulu_job_id = ?, parked_reason = NULL, " +
                "failure_reason = NULL, updated_at = NOW() WHERE id = ?",
                job.id(), orderId);
            log.info("Print order {} submitted to Lulu as job {} (status {}, {}).",
                orderId, job.id(), job.status(), context);
        } catch (LuluClient.PrintDisabledException e) {
            // Kill switch off: money taken, no book — but the book is FINE. Park as resumable and do NOT alert;
            // this is an expected state while print is deliberately off, and the sweep will pick it up.
            park(orderId, PARKED_PRINT_DISABLED, e.getMessage());
            log.warn("Print order {} is PAID but print is disabled (kill switch) — parked, resumable ({}): {}",
                orderId, context, e.getMessage());
        } catch (LuluClient.LuluApiException e) {
            // Lulu rejected/errored the submit itself. Not resumable on its own — get a human looking at it.
            park(orderId, PARKED_SUBMIT_FAILED, e.getMessage());
            alerts.orderNeedsAttention(orderId, "Lulu submit failed on a PAID order", e.getMessage());
            log.error("Print order {} is PAID but the Lulu submit failed — parked ({}): {}",
                orderId, context, e.getMessage(), e);
        }
    }

    /** Record WHY a paid order is sitting unsubmitted (D3). Leaves {@code status} at 'paid' — parked ≠ failed. */
    private void park(long orderId, String parkedReason, String detail) {
        jdbc.update("UPDATE print_orders SET parked_reason = ?, failure_reason = ?, updated_at = NOW() " +
            "WHERE id = ?", parkedReason, detail, orderId);
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
