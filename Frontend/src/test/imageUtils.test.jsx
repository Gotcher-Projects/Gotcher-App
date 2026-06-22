import { describe, it, expect, vi, afterEach } from 'vitest';
import { openCropModal } from '../lib/imageUtils.jsx';

// Regression guard for the crash where a non-image file (e.g. a .txt selected via the OS dialog's
// "All files" filter) reached the cropper: the <img> never decoded, and ReactCrop blew up on the
// resulting NaN crop dimensions. openCropModal must reject non-images before mounting the modal.
describe('openCropModal — non-image guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('rejects a .txt file without opening the cropper', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    const close = openCropModal(txt, onComplete, onCancel);

    expect(alertSpy).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    expect(typeof close).toBe('function');
    // Nothing was mounted, so calling close() is a safe no-op.
    expect(close).not.toThrow();
  });

  it('rejects a file with no MIME type', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const onCancel = vi.fn();

    openCropModal(new File([new Uint8Array([1, 2, 3])], 'blob.bin', { type: '' }), vi.fn(), onCancel);

    expect(alertSpy).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('opens the cropper for a valid image type', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const img = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' });

    const close = openCropModal(img, vi.fn(), vi.fn());

    expect(alertSpy).not.toHaveBeenCalled();
    expect(typeof close).toBe('function');
    close(); // unmount the modal we just opened
  });
});
