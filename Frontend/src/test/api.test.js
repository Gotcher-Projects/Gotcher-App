import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must be imported after vi.mock calls
let apiRequest, apiUpload;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
  // Re-import after reset so module-level state (refreshing) is fresh
  const mod = await import('../lib/api.js');
  apiRequest = mod.apiRequest;
  apiUpload = mod.apiUpload;
});

// ── apiUpload ──────────────────────────────────────────────────────────────

describe('apiUpload', () => {
  it('makes a POST request by default with no Content-Type header', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://res.cloudinary.com/img.jpg' }),
    });

    const form = new FormData();
    form.append('file', new Blob(['data']), 'test.jpg');
    const result = await apiUpload('/upload', form);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/upload');
    expect(options.method).toBe('POST');
    expect(options.body).toBe(form);
    expect(options.headers).toBeUndefined();
    expect(result).toEqual({ url: 'https://res.cloudinary.com/img.jpg' });
  });

  it('uses the provided method (PATCH)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
    });

    const form = new FormData();
    await apiUpload('/journal/1/image', form, 'PATCH');

    expect(fetch.mock.calls[0][1].method).toBe('PATCH');
  });

  it('sends credentials: include', async () => {
    fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({}),
    });

    await apiUpload('/upload', new FormData());

    expect(fetch.mock.calls[0][1].credentials).toBe('include');
  });

  it('throws with error message on non-200 response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ error: 'File too large' }),
    });

    await expect(apiUpload('/upload', new FormData())).rejects.toThrow('File too large');
  });

  it('retries after 401 and returns result on success', async () => {
    // First call: 401
    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    // Refresh call
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    // Retry: success
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ url: 'https://img' }) });

    const result = await apiUpload('/upload', new FormData());

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ url: 'https://img' });
  });
});

// ── apiRequest ─────────────────────────────────────────────────────────────

describe('apiRequest', () => {
  it('makes a GET request with JSON Content-Type', async () => {
    fetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ([{ id: 1 }]),
    });

    const result = await apiRequest('/journal');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/journal');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(result).toEqual([{ id: 1 }]);
  });

  it('returns null for 204 No Content', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 204 });

    const result = await apiRequest('/journal/1', { method: 'DELETE' });

    expect(result).toBeNull();
  });

  it('throws with error message on failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: 'Bad request' }),
    });

    await expect(apiRequest('/journal', { method: 'POST', body: '{}' }))
      .rejects.toThrow('Bad request');
  });

  it('fires session-expired event when refresh fails', async () => {
    const listener = vi.fn();
    window.addEventListener('session-expired', listener);

    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }); // refresh fails

    await expect(apiRequest('/journal')).rejects.toThrow();
    expect(listener).toHaveBeenCalled();

    window.removeEventListener('session-expired', listener);
  });

  it('deduplicates concurrent 401s — refresh is called exactly once', async () => {
    // Both requests get 401 simultaneously, but only one refresh should fire.
    fetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }) // req A: 401
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }) // req B: 401
      .mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({}) }) // refresh
      .mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({ a: 1 }) }) // retry A
      .mockResolvedValueOnce({ ok: true,  status: 200, json: async () => ({ b: 2 }) }); // retry B

    const [a, b] = await Promise.all([apiRequest('/a'), apiRequest('/b')]);

    // Three fetch calls total: 401-A, refresh, retry-A  — plus 401-B and retry-B = 5
    // But refresh deduplication means both A and B await the same refresh promise.
    // Exact call count depends on ordering, but refresh must appear exactly once.
    const calls = fetch.mock.calls.map(c => c[0]);
    const refreshCalls = calls.filter(url => url.includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    expect(a).toEqual({ a: 1 });
    expect(b).toEqual({ b: 2 });
  });
});
