import { createContext, useContext, useCallback, useMemo } from "react";

// One place that owns the user's AI-credit balance and how a spend syncs back to the user object,
// so per-field ✨ assist (AiAssistField) can drop in anywhere without prop-drilling `credits` /
// `onAssistSpend` through CradleHq → tab → editor. Gating is CREDITS-only (not subscription tier).
//
// Opening the buy-credits modal is NOT here — it moved to PurchaseContext's generalized `openPurchase`
// (Share s13c), since the same modal now also sells the share/bundle SKUs. Credits consumers read the
// balance here and `openPurchase` from usePurchase().
const AiCreditsContext = createContext(null);

// Mount once, high in the tree (CradleHq), with the user object + its update fn.
export function AiCreditsProvider({ user, onUserUpdate, children }) {
  const credits = user?.ai_credits_remaining ?? 0;

  const setCredits = useCallback(
    (n) => onUserUpdate?.({ ...user, ai_credits_remaining: Math.max(0, n) }),
    [user, onUserUpdate]
  );

  const value = useMemo(
    () => ({ credits, setCredits }),
    [credits, setCredits]
  );

  return <AiCreditsContext.Provider value={value}>{children}</AiCreditsContext.Provider>;
}

// Safe default so a field rendered outside a provider (e.g. a test) simply shows no credits.
export function useAiCredits() {
  return useContext(AiCreditsContext) ?? { credits: 0, setCredits: () => {} };
}
