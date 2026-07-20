package com.gotcherapp.api.print;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Print pr5 — the cover-dimension cross-check. Verifies our computed wrap dims (mirrored from PrintCoverPage.jsx)
 * against Lulu's authoritative calc. The "match" numbers (17.535 × 11.250 for 100 pages) were confirmed against
 * the live sandbox during the build.
 */
@ExtendWith(MockitoExtension.class)
class LuluPrintServiceTest {

    private static final String POD = "0850X1100FCPREPB080CW444GXX";

    @Mock LuluClient lulu;

    private LuluPrintService service() {
        return new LuluPrintService(lulu, POD);
    }

    @Test
    void crossCheckCover_matchesLulusCalc() {
        // Lulu's real sandbox answer for 100 pages of this SKU.
        when(lulu.coverDimensions(POD, 100)).thenReturn(new LuluClient.CoverDimensions(17.535, 11.250, "inch"));

        LuluPrintService.CoverCheck check = service().crossCheckCover(100);

        assertTrue(check.matches(), "computed wrap should match Lulu within tolerance");
        assertEquals(17.535, check.computedWidth(), 0.01);
        assertEquals(11.250, check.computedHeight(), 0.01);
        assertEquals(17.535, check.luluWidth(), 0.0001);
    }

    @Test
    void crossCheckCover_flagsDivergence() {
        // Pretend Lulu computes a spine ~0.3" wider than our constants would — must be reported as a mismatch.
        when(lulu.coverDimensions(POD, 100)).thenReturn(new LuluClient.CoverDimensions(17.835, 11.250, "inch"));

        LuluPrintService.CoverCheck check = service().crossCheckCover(100);

        assertFalse(check.matches(), "a diverging Lulu width must not be reported as a match");
    }
}
