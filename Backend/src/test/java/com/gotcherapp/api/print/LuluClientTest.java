package com.gotcherapp.api.print;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Print pr5 — the kill switch is the whole point of this test: with {@code app.print.enabled=false}, the client
 * must HARD-REFUSE a paid-job submit BEFORE any network call (so it works even with blank creds / no server).
 */
class LuluClientTest {

    private LuluClient client(boolean printEnabled) {
        // Blank creds + a bogus base: if the kill switch ever let a request through, the test would fail on a
        // network/credential error instead of the expected PrintDisabledException — which is exactly what we want
        // to catch (a submit reaching Lulu when print is off).
        return new LuluClient("https://api.sandbox.lulu.com", "", "", printEnabled);
    }

    @Test
    void createPrintJob_refusesWhenPrintDisabled() {
        LuluClient client = client(false);
        assertThrows(LuluClient.PrintDisabledException.class,
            () -> client.createPrintJob(Map.of("line_items", java.util.List.of())));
    }

    @Test
    void createPrintJob_whenEnabled_getsPastTheKillSwitch() {
        // Enabled + blank creds → it must move past the flag and fail trying to authenticate, NOT refuse. This
        // proves the flag (not something else) is what blocks the disabled case.
        LuluClient client = client(true);
        // assertThrows on LuluApiException (which PrintDisabledException does NOT extend) already proves the flag
        // was passed rather than refusing; the message confirms it failed at auth, not at the kill switch.
        LuluClient.LuluApiException e = assertThrows(LuluClient.LuluApiException.class,
            () -> client.createPrintJob(Map.of("line_items", java.util.List.of())));
        assertTrue(e.getMessage().toLowerCase().contains("credentials"));
    }
}
