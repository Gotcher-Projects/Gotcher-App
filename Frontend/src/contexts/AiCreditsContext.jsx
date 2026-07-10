import { createContext, useContext, useCallback, useMemo } from "react";

// One place that owns the user's AI-credit balance and how a spend syncs back to the user object,
// so per-field ✨ assist (AiAssistField) can drop in anywhere without prop-drilling `credits` /
// `onAssistSpend` through CradleHq → tab → editor. Gating is CREDITS-only (not subscription tier).
const AiCreditsContext = createContext(null);

// Mount once, high in the tree (CradleHq), with the user object + its update fn.
//   onGetCredits – optional; invoked when a field is clicked with no credits (buy-credits flow).
//   Left undefined until Payments ships, so the out-of-credits state is informational only.
export function AiCreditsProvider({ user, onUserUpdate, onGetCredits, children }) {
  const credits = user?.ai_credits_remaining ?? 0;

  const setCredits = useCallback(
    (n) => onUserUpdate?.({ ...user, ai_credits_remaining: Math.max(0, n) }),
    [user, onUserUpdate]
  );

  const value = useMemo(
    () => ({ credits, setCredits, onGetCredits }),
    [credits, setCredits, onGetCredits]
  );

  return <AiCreditsContext.Provider value={value}>{children}</AiCreditsContext.Provider>;
}

// Safe default so a field rendered outside a provider (e.g. a test) simply shows no credits.
export function useAiCredits() {
  return useContext(AiCreditsContext) ?? { credits: 0, setCredits: () => {}, onGetCredits: undefined };
}
