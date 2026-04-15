import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser, registerUser, logoutUser, saveSession, getStoredSession } from '../lib/auth.js';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
});

// ── loginUser ──────────────────────────────────────────────────────────────

describe('loginUser', () => {
  it('POSTs to /auth/login with email and password', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, email: 'test@test.com', display_name: 'Test' }),
    });

    await loginUser('test@test.com', 'password123');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/auth/login');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ email: 'test@test.com', password: 'password123' });
  });

  it('returns user data on success', async () => {
    const userData = { id: 1, email: 'test@test.com', display_name: 'Test' };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => userData });

    const result = await loginUser('test@test.com', 'password123');

    expect(result).toEqual(userData);
  });

  it('throws with error message on failed login', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    await expect(loginUser('test@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  it('throws generic message when no error field returned', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await expect(loginUser('test@test.com', 'wrong')).rejects.toThrow('Login failed');
  });
});

// ── registerUser ───────────────────────────────────────────────────────────

describe('registerUser', () => {
  it('POSTs to /auth/register with email, password, and display_name', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 2, email: 'new@test.com', display_name: 'New User' }),
    });

    await registerUser('new@test.com', 'pass123', 'New User');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/auth/register');
    expect(JSON.parse(options.body)).toEqual({
      email: 'new@test.com',
      password: 'pass123',
      display_name: 'New User',
    });
  });

  it('throws on registration failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Email already in use' }),
    });

    await expect(registerUser('dup@test.com', 'pass', 'Dup')).rejects.toThrow('Email already in use');
  });
});

// ── logoutUser ─────────────────────────────────────────────────────────────

describe('logoutUser', () => {
  it('removes gotcherapp_user from localStorage', async () => {
    localStorage.setItem('gotcherapp_user', JSON.stringify({ id: 1 }));
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await logoutUser();

    expect(localStorage.getItem('gotcherapp_user')).toBeNull();
  });

  it('still clears localStorage even if the fetch fails', async () => {
    localStorage.setItem('gotcherapp_user', JSON.stringify({ id: 1 }));
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await logoutUser();

    expect(localStorage.getItem('gotcherapp_user')).toBeNull();
  });
});

// ── saveSession / getStoredSession ─────────────────────────────────────────

describe('saveSession / getStoredSession', () => {
  it('round-trips a user object through localStorage', () => {
    const user = { id: 1, email: 'test@test.com', display_name: 'Test' };
    saveSession(user);
    const session = getStoredSession();
    expect(session).toEqual({ user });
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredSession()).toBeNull();
  });
});
