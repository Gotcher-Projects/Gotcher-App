const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Upload a file via multipart form. On 401 deduplicates and awaits a single token refresh,
 * then retries once. Fires 'session-expired' window event and throws if refresh fails.
 * @param {string} path
 * @param {FormData} formData
 * @param {'POST'|'PATCH'} [method='POST']
 * @returns {Promise<any>} parsed JSON response
 */
export async function apiUpload(path, formData, method = 'POST') {
  const makeReq = () => fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    body: formData,
    // No Content-Type header — browser sets it with the multipart boundary
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

let refreshing = null;

async function doRefresh() {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    localStorage.removeItem('gotcherapp_user');
    window.dispatchEvent(new Event('session-expired'));
    throw new Error('Session expired');
  }

  // New access_token cookie is set by the server response automatically
}

/**
 * Authenticated JSON fetch. On 401 deduplicates and awaits a single token refresh shared
 * across all concurrent callers, then retries once. If refresh fails, fires a
 * 'session-expired' window event (App.jsx handles logout) and throws.
 * Returns null for 204 No Content.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any|null>}
 */
export async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => { refreshing = null; });
    }
    await refreshing;

    // Retry with the new cookie
    const retry = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!retry.ok) {
      const data = await retry.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${retry.status}`);
    }
    return retry.status === 204 ? null : retry.json();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}
