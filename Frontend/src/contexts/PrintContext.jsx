import { createContext, useContext } from "react";

// Print pr8 — the print kill switch (backend `app.print.enabled`) surfaced to the UI so the
// "Order a printed book" entry point renders only when print is on. Rides `user.print_enabled`
// (/auth/me), mounted once in App and read wherever a print CTA lives.
//
// This is UX only — the real guarantees are pr7's checkout gate (refuses to open a Stripe session
// when off) and pr5's Lulu-client backstop (refuses to submit a paid job). Unlike the digital
// purchase seam (PurchaseContext, undefined on native), print IS available on native: a printed
// book is a physical good, so it must not be gated off the App Store build.
const PrintContext = createContext({ printEnabled: false });

export function PrintProvider({ printEnabled, children }) {
  return <PrintContext.Provider value={{ printEnabled: !!printEnabled }}>{children}</PrintContext.Provider>;
}

export function usePrintEnabled() {
  return useContext(PrintContext).printEnabled;
}
