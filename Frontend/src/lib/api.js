import { Capacitor } from '@capacitor/core';
import { getNativeTokens } from './auth.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const isNative = Capacitor.isNativePlatform();

let refreshing = null;

async function doRefresh() {
  if (isNative) {
    const { refreshToken } = getNativeTokens();
    if (!refreshToken) {
      window.dispatchEvent(new Event('session-expired'));
      throw new Error('Session expired');
    }
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem('cradlehq_access_token');
      localStorage.removeItem('cradlehq_refresh_token');
      localStorage.removeItem('gotcherapp_user');
      localStorage.removeItem('babyStepsData');
      window.dispatchEvent(new Event('session-expired'));
      throw new Error('Session expired');
    }
    const data = await res.json();
    localStorage.setItem('cradlehq_access_token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('cradlehq_refresh_token', data.refreshToken);
  } else {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      localStorage.removeItem('gotcherapp_user');
      localStorage.removeItem('babyStepsData');
      window.dispatchEvent(new Event('session-expired'));
      throw new Error('Session expired');
    }
  }
}

function authHeaders() {
  if (!isNative) return {};
  const token = localStorage.getItem('cradlehq_access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function apiUpload(path, formData, method = 'POST') {
  const makeReq = () => fetch(`${API_BASE}${path}`, {
    method,
    credentials: isNative ? 'omit' : 'include',
    headers: authHeaders(),
    body: formData,
  });

  let res = await makeReq();

  if (res.status === 401) {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => { refreshing = null; });
    }
    await refreshing;
    res = await makeReq();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: isNative ? 'omit' : 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => { refreshing = null; });
    }
    await refreshing;

    const retry = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: isNative ? 'omit' : 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...options.headers,
      },
    });

    if (!retry.ok) {
      const body = await retry.json().catch(() => ({}));
      const err = new Error(body.error || `Request failed: ${retry.status}`);
      err.status = retry.status;
      throw err;
    }
    return retry.status === 204 ? null : retry.json();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
