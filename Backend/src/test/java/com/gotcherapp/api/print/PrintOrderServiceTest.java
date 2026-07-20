package com.gotcherapp.api.print;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Print pr7 (commit a) — the checkout GUARD paths, the ones that must refuse BEFORE any charge or render. The
 * happy path ends in a static {@code Session.create} against Stripe's network (verified by hand with a 4242 test
 * card + local webhook, like Payments P3), so these tests pin the pre-Stripe gates instead: the kill switch, the
 * quantity bounds, and the orderability gate all short-circuit before a PDF is rendered or a customer touched.
 */
@ExtendWith(MockitoExtension.class)
class PrintOrderServiceTest {

    private static final Long USER_ID = 42L;
    private static final Long BOOK_ID = 7L;

    @Mock PrintInteriorService printInteriorService;
    @Mock PrintRenderService renderService;

    /** Real pricing (pure, no deps); the collaborators that reach the network/DB are mocked. */
    private PrintOrderService service(boolean printEnabled) {
        return new PrintOrderService(null, printInteriorService, new PrintPricingService(),
            renderService, "sk_test", "http://localhost:3000", printEnabled);
    }

    private PrintInteriorService.Orderability tooFew(int pages) {
        return new PrintInteriorService.Orderability(pages, 32, 50, false, 32 - pages, 0, "freeform",
            PrintInteriorService.Reason.ADD_MORE);
    }

    @Test
    void killSwitchOff_refusesBeforeAnything() {
        assertThrows(LuluClient.PrintDisabledException.class,
            () -> service(false).createCheckout(USER_ID, BOOK_ID, 1));

        // Nothing is gated/priced/rendered when print is off — the refusal is the very first thing.
        verifyNoInteractions(printInteriorService, renderService);
    }

    @Test
    void quantityBelowOne_rejected() {
        assertThrows(IllegalArgumentException.class,
            () -> service(true).createCheckout(USER_ID, BOOK_ID, 0));
        verifyNoInteractions(printInteriorService, renderService);
    }

    @Test
    void quantityAboveMax_rejected() {
        assertThrows(IllegalArgumentException.class,
            () -> service(true).createCheckout(USER_ID, BOOK_ID, PrintOrderService.MAX_QUANTITY + 1));
        verifyNoInteractions(printInteriorService, renderService);
    }

    @Test
    void notOrderable_refusesBeforeRender() {
        when(printInteriorService.orderability(USER_ID, BOOK_ID)).thenReturn(tooFew(20));

        assertThrows(PrintOrderService.NotOrderableException.class,
            () -> service(true).createCheckout(USER_ID, BOOK_ID, 1));

        // The gate is checked, but we never render a PDF for an un-orderable book.
        verifyNoInteractions(renderService);
    }

    @Test
    void notOwned_propagatesAs404() {
        // orderability() does the IDOR check and throws when the book isn't owned — checkout must let it through.
        when(printInteriorService.orderability(USER_ID, BOOK_ID))
            .thenThrow(new PrintRenderService.BookNotAccessibleException("Book not found"));

        assertThrows(PrintRenderService.BookNotAccessibleException.class,
            () -> service(true).createCheckout(USER_ID, BOOK_ID, 1));
        verifyNoInteractions(renderService);
    }
}
