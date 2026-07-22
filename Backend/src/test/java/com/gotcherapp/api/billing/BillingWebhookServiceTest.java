package com.gotcherapp.api.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.LineItem;
import com.stripe.model.LineItemCollection;
import com.stripe.model.Price;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionRetrieveParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Payments P4 — the webhook's event-routing and parsing, isolated from Stripe's network and signature
 * crypto (both static: Webhook.constructEvent, Session.retrieve are mocked). Covers the three behaviors
 * verified by hand in P3: a bad signature aborts before any grant, an event type we don't fulfil is a
 * silent no-op, and a real checkout event grants with metadata parsed from the buyer + price.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BillingWebhookServiceTest {

    @Mock GrantService grantService;
    @Mock com.gotcherapp.api.print.PrintOrderFulfilmentService printOrderFulfilmentService;
    @Mock com.gotcherapp.api.print.PrintRefundService printRefundService;

    private BillingWebhookService service;

    private static final String SECRET = "whsec_test";
    private static final String PAYLOAD = "{\"id\":\"evt_1\"}";
    private static final String SIG = "t=1,v1=abc";

    @BeforeEach
    void setUp() {
        // The secret is a @Value String, not a bean — construct by hand rather than @InjectMocks.
        service = new BillingWebhookService(
            grantService, printOrderFulfilmentService, printRefundService, SECRET);
    }

    @Test
    void badSignature_propagates_andGrantsNothing() {
        try (MockedStatic<Webhook> webhook = mockStatic(Webhook.class)) {
            webhook.when(() -> Webhook.constructEvent(PAYLOAD, SIG, SECRET))
                .thenThrow(new SignatureVerificationException("bad sig", SIG));

            assertThrows(SignatureVerificationException.class, () -> service.handle(PAYLOAD, SIG));
            verifyNoInteractions(grantService);
        }
    }

    @Test
    void unhandledEventType_isNoOp_noGrant() throws Exception {
        Event event = mock(Event.class);
        when(event.getType()).thenReturn("payment_intent.succeeded");

        try (MockedStatic<Webhook> webhook = mockStatic(Webhook.class)) {
            webhook.when(() -> Webhook.constructEvent(PAYLOAD, SIG, SECRET)).thenReturn(event);

            service.handle(PAYLOAD, SIG);   // returns cleanly

            verifyNoInteractions(grantService);
        }
    }

    @Test
    void checkoutCompleted_grantsWithParsedMetadataAndCredits() throws Exception {
        // The event carries a stub session; fulfil() re-retrieves the full one via Session.retrieve.
        Session stubFromEvent = mock(Session.class);
        when(stubFromEvent.getId()).thenReturn("cs_123");

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.of(stubFromEvent));

        Event event = mock(Event.class);
        when(event.getType()).thenReturn("checkout.session.completed");
        when(event.getId()).thenReturn("evt_1");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);

        Session full = mockSession("42", "credits_50", "", 50);

        when(grantService.apply("evt_1", 42L, "credits_50", 50, null)).thenReturn(true);

        try (MockedStatic<Webhook> webhook = mockStatic(Webhook.class);
             MockedStatic<Session> session = mockStatic(Session.class)) {
            webhook.when(() -> Webhook.constructEvent(PAYLOAD, SIG, SECRET)).thenReturn(event);
            session.when(() -> Session.retrieve(eq("cs_123"), any(SessionRetrieveParams.class), isNull()))
                .thenReturn(full);

            service.handle(PAYLOAD, SIG);

            verify(grantService).apply("evt_1", 42L, "credits_50", 50, null);
        }
    }

    @Test
    void shareBundle_passesBookIdThrough() throws Exception {
        Session stubFromEvent = mock(Session.class);
        when(stubFromEvent.getId()).thenReturn("cs_777");

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.of(stubFromEvent));

        Event event = mock(Event.class);
        when(event.getType()).thenReturn("checkout.session.completed");
        when(event.getId()).thenReturn("evt_2");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);

        Session full = mockSession("99", "bundle_share_150", "7", 150);

        when(grantService.apply("evt_2", 99L, "bundle_share_150", 150, 7L)).thenReturn(true);

        try (MockedStatic<Webhook> webhook = mockStatic(Webhook.class);
             MockedStatic<Session> session = mockStatic(Session.class)) {
            webhook.when(() -> Webhook.constructEvent(PAYLOAD, SIG, SECRET)).thenReturn(event);
            session.when(() -> Session.retrieve(eq("cs_777"), any(SessionRetrieveParams.class), isNull()))
                .thenReturn(full);

            service.handle(PAYLOAD, SIG);

            verify(grantService).apply("evt_2", 99L, "bundle_share_150", 150, 7L);
        }
    }

    @Test
    void printOrder_routesToPrintFulfilment_notGrant() throws Exception {
        Session stubFromEvent = mock(Session.class);
        when(stubFromEvent.getId()).thenReturn("cs_print");

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.of(stubFromEvent));

        Event event = mock(Event.class);
        when(event.getType()).thenReturn("checkout.session.completed");
        when(event.getId()).thenReturn("evt_print");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);

        // A print session is recognised by metadata.type — it must NOT touch the credit ledger.
        Session full = mock(Session.class);
        when(full.getMetadata()).thenReturn(Map.of("type", "print_order", "printOrderId", "5"));

        try (MockedStatic<Webhook> webhook = mockStatic(Webhook.class);
             MockedStatic<Session> session = mockStatic(Session.class)) {
            webhook.when(() -> Webhook.constructEvent(PAYLOAD, SIG, SECRET)).thenReturn(event);
            session.when(() -> Session.retrieve(eq("cs_print"), any(SessionRetrieveParams.class), isNull()))
                .thenReturn(full);

            service.handle(PAYLOAD, SIG);

            verify(printOrderFulfilmentService).fulfil("evt_print", full);
            verifyNoInteractions(grantService);
        }
    }

    /** Build a fully-retrieved Session mock: buyer, metadata, and one line item whose price carries credits. */
    private Session mockSession(String clientRef, String sku, String bookId, int credits) {
        Price price = mock(Price.class);
        when(price.getMetadata()).thenReturn(Map.of("credits", String.valueOf(credits)));

        LineItem item = mock(LineItem.class);
        when(item.getPrice()).thenReturn(price);

        LineItemCollection lineItems = mock(LineItemCollection.class);
        when(lineItems.getData()).thenReturn(List.of(item));

        Session session = mock(Session.class);
        when(session.getId()).thenReturn("cs_full");
        when(session.getClientReferenceId()).thenReturn(clientRef);
        when(session.getMetadata()).thenReturn(Map.of("sku", sku, "bookId", bookId));
        when(session.getLineItems()).thenReturn(lineItems);
        return session;
    }
}
