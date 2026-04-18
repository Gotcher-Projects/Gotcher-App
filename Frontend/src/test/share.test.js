import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareFirstTime } from '../lib/share.js';

const BASE = { label: 'smile', occurredDate: '2026-04-01', babyName: 'Lily' };

describe('shareFirstTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete navigator.share;
    delete navigator.canShare;
    delete navigator.clipboard;
  });

  it('calls navigator.share when Web Share API is available and canShare returns true', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    navigator.share = shareMock;
    navigator.canShare = vi.fn().mockReturnValue(true);

    const result = await shareFirstTime(BASE);

    expect(shareMock).toHaveBeenCalledOnce();
    const [shareData] = shareMock.mock.calls[0];
    expect(shareData.text).toContain('Lily');
    expect(shareData.text).toContain('smile');
    expect(result).toBeUndefined();
  });

  it('includes imageUrl as share url when provided', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    navigator.share = shareMock;
    navigator.canShare = vi.fn().mockReturnValue(true);

    await shareFirstTime({ ...BASE, imageUrl: 'https://img.example.com/photo.jpg' });

    const [shareData] = shareMock.mock.calls[0];
    expect(shareData.url).toBe('https://img.example.com/photo.jpg');
  });

  it('falls back to clipboard and returns "copied" when Web Share is unavailable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    navigator.clipboard = { writeText: writeTextMock };

    const result = await shareFirstTime(BASE);

    expect(writeTextMock).toHaveBeenCalledOnce();
    const [text] = writeTextMock.mock.calls[0];
    expect(text).toContain('Lily');
    expect(text).toContain('smile');
    expect(result).toBe('copied');
  });

  it('appends imageUrl to clipboard text when provided', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    navigator.clipboard = { writeText: writeTextMock };

    await shareFirstTime({ ...BASE, imageUrl: 'https://img.example.com/photo.jpg' });

    const [text] = writeTextMock.mock.calls[0];
    expect(text).toContain('https://img.example.com/photo.jpg');
  });

  it('falls back to clipboard when canShare returns false', async () => {
    navigator.share = vi.fn();
    navigator.canShare = vi.fn().mockReturnValue(false);
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    navigator.clipboard = { writeText: writeTextMock };

    const result = await shareFirstTime(BASE);

    expect(navigator.share).not.toHaveBeenCalled();
    expect(writeTextMock).toHaveBeenCalled();
    expect(result).toBe('copied');
  });
});
