import { createContext, useContext } from "react";

// Share s13c — one generalized seam for opening the purchase modal, for BOTH credit packs and the
// share/bundle SKUs. Mounted once in App with `openPurchase({ skus, bookId, heading, subheading })`.
//
// `openPurchase` is left **undefined on native** (App doesn't pass it there), which is the Payments P9
// gate: every buy CTA that keys off it degrades to informational, and PurchaseModal isn't mounted.
// Consumers must treat `openPurchase` as optional (call `openPurchase?.()` / hide the CTA when absent).
const PurchaseContext = createContext({ openPurchase: undefined });

export function PurchaseProvider({ openPurchase, children }) {
  return <PurchaseContext.Provider value={{ openPurchase }}>{children}</PurchaseContext.Provider>;
}

export function usePurchase() {
  return useContext(PurchaseContext);
}
