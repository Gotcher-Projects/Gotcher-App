const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function registerUser(email, password, displayName) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function logoutUser() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
  } catch {
    // Proceed with local logout even if request fails
  }
  localStorage.removeItem('gotcherapp_user');
}

export function saveSession(user) {
  localStorage.setItem('gotcherapp_user', JSON.stringify(user));
}

export function getStoredSession() {
  const userRaw = localStorage.getItem('gotcherapp_user');
  if (!userRaw) return null;
  return { user: JSON.parse(userRaw) };
}

// Validates the current session against the server.
// Tries /auth/me; if the access token is expired (401) attempts a silent refresh.
// Returns true if the session is (or becomes) valid, false if the user must log in again.
export async function validateSession() {
  try {
    const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (meRes.ok) return true;
    if (meRes.status !== 401) return false;

    // Access token expired — attempt silent refresh
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!refreshRes.ok) {
      localStorage.removeItem('gotcherapp_user');
    }
    return refreshRes.ok;
  } catch {
    return false;
  }
}
