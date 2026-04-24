import { useState, useEffect } from "react";
import CradleHq from "./components/CradleHq";
import LoginPage from "./components/LoginPage";
import { getStoredSession, logoutUser, saveSession, validateSession } from "./lib/auth";

export default function App() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [verifiedBanner, setVerifiedBanner] = useState(null); // 'success' | 'error' | null
  const [resetToken, setResetToken] = useState(null);

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
          // Apply email_verified flag from redirect if present
          const userToSet = ev === 'true'
            ? { ...session.user, email_verified: true }
            : session.user;
          if (ev === 'true') saveSession(userToSet);
          setUser(userToSet);
        }
        // If !valid, validateSession already cleared localStorage; user stays null → login
      }

      setChecked(true);
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

  if (!checked) return null;

  if (!user) {
    return (
      <LoginPage
        onLogin={setUser}
        verifiedBanner={verifiedBanner}
        onDismissBanner={() => setVerifiedBanner(null)}
        resetToken={resetToken}
        onResetConsumed={() => setResetToken(null)}
      />
    );
  }

  return (
    <CradleHq
      user={user}
      onLogout={handleLogout}
      verifiedBanner={verifiedBanner}
      onDismissBanner={() => setVerifiedBanner(null)}
      onUserUpdate={(updated) => {
        saveSession(updated);
        setUser(updated);
      }}
    />
  );
}
