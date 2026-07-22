import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import CradleHq from "./components/CradleHq";
import LoginPage from "./components/LoginPage";
import PublicBookPage from "./components/PublicBookPage";
import PrintBookPage from "./components/PrintBookPage";
import PrintCoverPage from "./components/PrintCoverPage";
import PurchaseModal from "./components/PurchaseModal";
import UpgradeConfirm from "./components/UpgradeConfirm";
import PrintOrderConfirm from "./components/PrintOrderConfirm";
import { getStoredSession, logoutUser, saveSession, validateSession } from "./lib/auth";
import { apiRequest } from "./lib/api";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AiCreditsProvider } from "./contexts/AiCreditsContext";
import { PurchaseProvider } from "./contexts/PurchaseContext";
import { PrintProvider } from "./contexts/PrintContext";

export default function App() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [verifiedBanner, setVerifiedBanner] = useState(null); // 'success' | 'error' | null
  const [resetToken, setResetToken] = useState(null);
  // Share s13c — the generalized purchase seam. Params { skus, bookId, heading, subheading } (null = closed);
  // credits open it with no args (defaults), share opens it with SHARE_SKUS + the active bookId.
  const [purchaseParams, setPurchaseParams] = useState(null);
  const [upgradeStatus, setUpgradeStatus] = useState(null); // Payments P7 — 'confirming' | 'done' | 'slow'
  // Print pr9 — return from a PRINT checkout ({ bookId, sessionId } | null). Separate from upgradeStatus: a
  // printed book is a physical order with its own details to show, so it gets its own confirmation.
  const [printConfirm, setPrintConfirm] = useState(null);

  // Payments P9 — native gate. No purchase UI or call-to-action in the iOS/Android builds: our App Store
  // exemption (3.1.3(f), free companion app) holds only if there's none. One seam: leave openPurchase
  // undefined on native so every consumer's buy CTA becomes informational, and don't mount PurchaseModal.
  const isNative = Capacitor.isNativePlatform();
  const openPurchase = isNative ? undefined : (params = {}) => setPurchaseParams(params);

  // Public shared-book route (sv2-s13), served OUTSIDE the auth gate. Lightweight routing per Payments P5:
  // a pathname branch, no router. On native the pathname is "/", so this is a no-op there.
  const bookTokenMatch = window.location.pathname.match(/^\/book\/([^/]+)/);
  const publicBookToken = bookTokenMatch ? decodeURIComponent(bookTokenMatch[1]) : null;

  // Print pr2 — the print-view route for the sidecar (headless Chrome), served OUTSIDE the auth gate like the
  // public book branch above. `/print/book/{token}` renders the full interior at trim+bleed with no app chrome.
  const printTokenMatch = window.location.pathname.match(/^\/print\/book\/([^/]+)/);
  const printBookToken = printTokenMatch ? decodeURIComponent(printTokenMatch[1]) : null;

  // Print pr4 — the COVER print-view route (separate wrap PDF). `/print/cover/{token}` renders back|spine|front.
  const printCoverMatch = window.location.pathname.match(/^\/print\/cover\/([^/]+)/);
  const printCoverToken = printCoverMatch ? decodeURIComponent(printCoverMatch[1]) : null;

  useEffect(() => {
    async function boot() {
      const params = new URLSearchParams(window.location.search);

      // Handle email verification redirect (?email_verified=true/error)
      const ev = params.get('email_verified');
      if (ev === 'true') {
        setVerifiedBanner('success');
        window.history.replaceState({}, '', '/');
      } else if (ev === 'error') {
        setVerifiedBanner('error');
        window.history.replaceState({}, '', '/');
      }

      // Handle password reset redirect (?reset_token=<token>)
      const rt = params.get('reset_token');
      if (rt) {
        setResetToken(rt);
        window.history.replaceState({}, '', '/');
      }

      const session = getStoredSession();
      if (session) {
        const valid = await validateSession();
        if (valid) {
          // Re-read session after validate — validateSession may have refreshed user data (e.g. tier)
          const freshSession = getStoredSession();
          const baseUser = freshSession?.user ?? session.user;
          const userToSet = ev === 'true'
            ? { ...baseUser, email_verified: true }
            : baseUser;
          if (ev === 'true') saveSession(userToSet);
          setUser(userToSet);
        }
        // If !valid, validateSession already cleared localStorage; user stays null → login
      }

      setChecked(true);

      // Payments P7 — return from Stripe (?upgrade=success|cancelled). Confirmation only; the P3 webhook is
      // the sole grant path. Query-param return per the P5 lightweight-routing decision.
      const upgrade = params.get('upgrade');
      if (upgrade === 'success') {
        window.history.replaceState({}, '', '/');
        confirmUpgrade();
      } else if (upgrade === 'cancelled') {
        window.history.replaceState({}, '', '/');
      }

      // Print pr9 — return from a print checkout (?print=success&book_id=&session_id=). Same discipline as
      // above: confirmation only, the pr7 webhook is what actually submits the Lulu job. On native the return
      // pathname carries no query, so this is a natural no-op there.
      const print = params.get('print');
      if (print === 'success') {
        const rawBookId = params.get('book_id');
        const sessionId = params.get('session_id');
        window.history.replaceState({}, '', '/');
        if (rawBookId && sessionId) setPrintConfirm({ bookId: Number(rawBookId), sessionId });
      } else if (print === 'cancelled') {
        window.history.replaceState({}, '', '/');   // abandoned checkout — back to the app, no UI
      }
    }

    // Confirm the webhook's grant on return from Stripe (s13e-1). The right signal depends on what was bought
    // (stashed in pendingBuy): a credits pack grows the balance; a share unlock flips the book's shareUnlocked;
    // a bundle grants both, so either signal confirms it. Never claims success without a real signal; degrades
    // to "on its way", never a false failure (reaching this page already means Stripe accepted the payment).
    async function confirmUpgrade() {
      let stash = null;
      try {
        const raw = sessionStorage.getItem('pendingBuy');
        if (raw) stash = JSON.parse(raw);
      } catch { /* ignore */ }

      const sku = stash?.sku ?? null;
      const bookId = stash?.bookId ?? null;
      const before = stash?.before ?? null;
      const kind = sku === 'share_only' ? 'share' : sku === 'bundle_share_150' ? 'bundle' : 'credits';
      const watchCredits = kind === 'credits' || kind === 'bundle';
      const watchUnlock = kind === 'share' || kind === 'bundle';

      if (stash == null) {
        // No stash (e.g. URL opened directly) — refresh once, show a soft state, never claim a grant.
        try {
          const me = await apiRequest('/auth/me');
          if (me?.user) { saveSession(me.user); setUser(me.user); }
        } catch { /* ignore */ }
        setUpgradeStatus({ phase: 'slow', kind, bookId });
        return;
      }

      setUpgradeStatus({ phase: 'confirming', kind, bookId });
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        let creditsGrew = false, unlocked = false;
        if (watchCredits) {
          try {
            const me = await apiRequest('/auth/me');
            const fresh = me?.user;
            if (fresh) {
              saveSession(fresh);
              setUser(fresh);
              if (before != null && (fresh.ai_credits_remaining ?? 0) > before) creditsGrew = true;
            }
          } catch { /* keep polling */ }
        }
        if (watchUnlock) {
          try {
            const books = await apiRequest('/books');
            if (Array.isArray(books) && books.some((b) => b.id === bookId && b.shareUnlocked)) unlocked = true;
          } catch { /* keep polling */ }
        }
        if (creditsGrew || unlocked) {
          sessionStorage.removeItem('pendingBuy');
          setUpgradeStatus({ phase: 'done', kind, bookId });
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      sessionStorage.removeItem('pendingBuy');   // webhook slow — surface "on its way", not a failure
      setUpgradeStatus({ phase: 'slow', kind, bookId });
    }

    boot();

    const onExpired = () => setUser(null);
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, []);

  async function handleLogout() {
    await logoutUser();
    setUser(null);
  }

  // Print-view route — rendered before (and independent of) the session check, so headless Chrome doesn't
  // wait on session boot. Interior only; the cover is a separate PDF (pr4).
  if (printBookToken) {
    return (
      <ThemeProvider>
        <PrintBookPage token={printBookToken} />
      </ThemeProvider>
    );
  }

  // Cover print-view route (pr4) — a separate wrap PDF, same headless-Chrome discipline as the interior.
  if (printCoverToken) {
    return (
      <ThemeProvider>
        <PrintCoverPage token={printCoverToken} />
      </ThemeProvider>
    );
  }

  // Public book link opens for anyone — render it before (and independent of) the session check.
  if (publicBookToken) {
    return (
      <ThemeProvider>
        <PublicBookPage token={publicBookToken} />
      </ThemeProvider>
    );
  }

  if (!checked) return null;

  if (!user) {
    return (
      <ThemeProvider>
        <LoginPage
          onLogin={setUser}
          verifiedBanner={verifiedBanner}
          onDismissBanner={() => setVerifiedBanner(null)}
          resetToken={resetToken}
          onResetConsumed={() => setResetToken(null)}
        />
      </ThemeProvider>
    );
  }

  const handleUserUpdate = (updated) => {
    saveSession(updated);
    setUser(updated);
  };

  return (
    <ThemeProvider>
      <AiCreditsProvider user={user} onUserUpdate={handleUserUpdate}>
        <PurchaseProvider openPurchase={openPurchase}>
          <PrintProvider printEnabled={user?.print_enabled}>
            <CradleHq
              user={user}
              onLogout={handleLogout}
              verifiedBanner={verifiedBanner}
              onDismissBanner={() => setVerifiedBanner(null)}
              onUserUpdate={handleUserUpdate}
            />
            {!isNative && (
              <PurchaseModal
                open={!!purchaseParams}
                onClose={() => setPurchaseParams(null)}
                skus={purchaseParams?.skus}
                bookId={purchaseParams?.bookId}
                heading={purchaseParams?.heading}
                subheading={purchaseParams?.subheading}
              />
            )}
            <UpgradeConfirm
              status={upgradeStatus}
              credits={user?.ai_credits_remaining}
              onDismiss={() => setUpgradeStatus(null)}
            />
            <PrintOrderConfirm confirm={printConfirm} onDismiss={() => setPrintConfirm(null)} />
          </PrintProvider>
        </PurchaseProvider>
      </AiCreditsProvider>
    </ThemeProvider>
  );
}
