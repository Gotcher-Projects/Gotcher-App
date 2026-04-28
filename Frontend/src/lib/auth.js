import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const isNative = Capacitor.isNativePlatform();

const KEYS = {
  accessToken: 'cradlehq_access_token',
  refreshToken: 'cradlehq_refresh_token',
};

export function getNativeTokens() {
  return {
    accessToken: localStorage.getItem(KEYS.accessToken),
    refreshToken: localStorage.getItem(KEYS.refreshToken),
  };
}

function saveNativeTokens(data) {
  if (data.accessToken) localStorage.setItem(KEYS.accessToken, data.accessToken);
  if (data.refreshToken) localStorage.setItem(KEYS.refreshToken, data.refreshToken);
}

function clearNativeTokens() {
  localStorage.removeItem(KEYS.accessToken);
  localStorage.removeItem(KEYS.refreshToken);
}

export async function loginUser(email, password, rememberMe = false) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: isNative ? 'omit' : 'include',
    body: JSON.stringify({ email, password, rememberMe }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  if (isNative) saveNativeTokens(data);
  return data;
}

export async function registerUser(email, password, displayName) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: isNative ? 'omit' : 'include',
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  if (isNative) saveNativeTokens(data);
  return data;
}

export async function logoutUser() {
  try {
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit' };
    if (isNative) {
      const { refreshToken } = getNativeTokens();
      opts.body = refreshToken ? JSON.stringify({ refreshToken }) : undefined;
    } else {
      opts.credentials = 'include';
    }
    await fetch(`${API_BASE}/auth/logout`, opts);
  } catch {
    // Proceed with local logout even if request fails
  }
  clearNativeTokens();
  localStorage.removeItem('gotcherapp_user');
  localStorage.removeItem('babyStepsData');
}

export function saveSession(user) {
  localStorage.setItem('gotcherapp_user', JSON.stringify(user));
}

export function getStoredSession() {
  const userRaw = localStorage.getItem('gotcherapp_user');
  if (!userRaw) return null;
  return { user: JSON.parse(userRaw) };
}

export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  return data.message;
}

export async function resetPassword(token, newPassword) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Password reset failed');
  return data;
}

export async function validateSession() {
  try {
    if (isNative) {
      const { accessToken, refreshToken } = getNativeTokens();
      if (!accessToken) return false;

      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (meRes.ok) return true;
      if (meRes.status !== 401 || !refreshToken) return false;

      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!refreshRes.ok) { clearNativeTokens(); return false; }
      saveNativeTokens(await refreshRes.json());
      return true;
    }

    // Web: cookie-based
    const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (meRes.ok) return true;
    if (meRes.status !== 401) return false;

    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!refreshRes.ok) localStorage.removeItem('gotcherapp_user');
    return refreshRes.ok;
  } catch {
    return false;
  }
}
